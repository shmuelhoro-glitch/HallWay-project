// In-memory rate limiting for login attempts.
// Locks an IP out after 5 failed login attempts within a 15-second window.

export const WINDOW_MS = 15 * 1000; // 15 seconds
export const MAX_ATTEMPTS = 5;
export const CLEANUP_INTERVAL_MS = 15 * 1000; // 15 seconds

// IP -> { count: number, firstAttempt: number, lastAttempt: number, timestamp: number, resetTime: number, timestamps: number[] }
const attempts = new Map();

export function getClientIp(req) {
  if (!req) return "unknown";
  const rawIp = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
  return typeof rawIp === "string" ? rawIp.replace(/^::ffff:/, "") : "unknown";
}

function resolveIp(ipOrReq) {
  if (!ipOrReq) return "unknown";
  if (typeof ipOrReq === "string") return ipOrReq.replace(/^::ffff:/, "");
  return getClientIp(ipOrReq);
}

// Records a failed attempt for the given IP (increments failure count and updates timestamp)
export function recordFailedAttempt(ipOrReq, now = Date.now()) {
  const ip = resolveIp(ipOrReq);
  const entry = attempts.get(ip);

  if (!entry) {
    const newEntry = {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
      timestamp: now,
      resetTime: now + WINDOW_MS,
      timestamps: [now],
    };
    attempts.set(ip, newEntry);
    return newEntry;
  }

  // Filter existing timestamps within the 15-second window
  const recent = entry.timestamps.filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  recent.sort((a, b) => a - b);

  entry.timestamps = recent;
  entry.count = recent.length;
  entry.firstAttempt = recent[0];
  entry.lastAttempt = now;
  entry.timestamp = now;
  entry.resetTime = (entry.count >= MAX_ATTEMPTS
    ? recent[recent.length - MAX_ATTEMPTS]
    : recent[0]) + WINDOW_MS;

  attempts.set(ip, entry);
  return entry;
}

// Resets failure count when an IP logs in successfully
export function resetFailedAttempts(ipOrReq) {
  const ip = resolveIp(ipOrReq);
  attempts.delete(ip);
}

// Checks whether an IP is currently locked out
export function isLocked(ipOrReq, now = Date.now()) {
  const ip = resolveIp(ipOrReq);
  const entry = attempts.get(ip);
  if (!entry) return false;

  const recent = entry.timestamps.filter((time) => now - time < WINDOW_MS);
  if (recent.length === 0) {
    attempts.delete(ip);
    return false;
  }
  return recent.length >= MAX_ATTEMPTS;
}

// Returns the remaining seconds until unlock for an IP (0 if not locked)
export function getRemainingSeconds(ipOrReq, now = Date.now()) {
  const ip = resolveIp(ipOrReq);
  const entry = attempts.get(ip);
  if (!entry) return 0;

  const recent = entry.timestamps.filter((time) => now - time < WINDOW_MS);
  if (recent.length < MAX_ATTEMPTS) {
    if (recent.length === 0) {
      attempts.delete(ip);
    }
    return 0;
  }

  const oldestBlockingTime = recent[recent.length - MAX_ATTEMPTS];
  const remainingMs = (oldestBlockingTime + WINDOW_MS) - now;
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

// Cleans up expired entries periodically so memory does not leak
export function cleanupExpiredAttempts(now = Date.now()) {
  for (const [ip, entry] of attempts.entries()) {
    const recent = entry.timestamps.filter((time) => now - time < WINDOW_MS);
    if (recent.length === 0) {
      attempts.delete(ip);
    } else {
      entry.timestamps = recent;
      entry.count = recent.length;
      entry.firstAttempt = recent[0];
      entry.lastAttempt = recent[recent.length - 1];
      entry.timestamp = entry.lastAttempt;
      entry.resetTime = (entry.count >= MAX_ATTEMPTS
        ? recent[recent.length - MAX_ATTEMPTS]
        : recent[0]) + WINDOW_MS;
    }
  }
}

// Clears all tracked attempts (useful for test resets)
export function clearAllAttempts() {
  attempts.clear();
}

// Periodic cleanup interval: unref so it won't keep the Node.js process alive
const cleanupTimer = setInterval(() => {
  cleanupExpiredAttempts();
}, CLEANUP_INTERVAL_MS);

if (cleanupTimer && typeof cleanupTimer.unref === "function") {
  cleanupTimer.unref();
}

export function stopCleanupTimer() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
}

// Middleware: blocks login requests if the client IP has >= 5 failed attempts in 15 seconds
export function checkLoginRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry) {
    return next();
  }

  const recent = entry.timestamps.filter((time) => now - time < WINDOW_MS);
  if (recent.length === 0) {
    attempts.delete(ip);
    return next();
  }

  entry.timestamps = recent;
  entry.count = recent.length;
  entry.firstAttempt = recent[0];
  entry.lastAttempt = recent[recent.length - 1];
  entry.timestamp = entry.lastAttempt;
  entry.resetTime = (entry.count >= MAX_ATTEMPTS
    ? entry.timestamps[entry.timestamps.length - MAX_ATTEMPTS]
    : entry.firstAttempt) + WINDOW_MS;

  if (entry.count < MAX_ATTEMPTS) {
    return next();
  }

  // Calculate remaining seconds until unlock
  const remainingSeconds = getRemainingSeconds(ip, now);

  if (typeof res.setHeader === "function") {
    res.setHeader("Retry-After", String(remainingSeconds));
  }
  if (typeof res.set === "function") {
    res.set("Retry-After", String(remainingSeconds));
  }

  return res.status(429).json({
    status: 429,
    code: "ACCOUNT_LOCKED",
    message: "Too many failed login attempts. Please try again in 15 seconds.",
    error: {
      code: "ACCOUNT_LOCKED",
      message: "Too many failed login attempts. Please try again in 15 seconds.",
    },
  });
}

export default checkLoginRateLimit;
