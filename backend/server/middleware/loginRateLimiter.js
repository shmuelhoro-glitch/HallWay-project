// Slows down guessing of passwords: after 5 wrong passwords in 15 seconds, the same visitor
// can't try the same account again until the 15 seconds pass.
// Kept in memory: enough for one server, and a restart only forgets a few seconds.

export const WINDOW_MS = 15 * 1000;
export const MAX_ATTEMPTS = 5;

// key -> the times of the wrong passwords inside the window
const failures = new Map();

export function getClientIp(req) {
  const ip = req?.ip || req?.socket?.remoteAddress || "unknown";
  return String(ip).replace(/^::ffff:/, "");
}

// Who is counted: this address trying this account.
// The address alone is not enough: behind a proxy many visitors can share one, and then the wrong
// passwords of one visitor would lock everyone out (and a login of another would free him).
export function getLoginKey(req) {
  const email = String(req?.body?.email ?? "").trim().toLowerCase();
  return `${getClientIp(req)}|${email}`;
}

// The wrong passwords of this key that still count. Old ones are dropped on the way.
function recentFailures(key, now) {
  const recent = (failures.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length === 0) {
    failures.delete(key);
  } else {
    failures.set(key, recent);
  }
  return recent;
}

export function recordFailedAttempt(key, now = Date.now()) {
  failures.set(key, [...recentFailures(key, now), now]);
}

// A successful login starts the count again
export function resetFailedAttempts(key) {
  failures.delete(key);
}

// How many seconds until this key may try again. 0 = it may try now.
export function getRemainingSeconds(key, now = Date.now()) {
  const recent = recentFailures(key, now);
  if (recent.length < MAX_ATTEMPTS) return 0;

  // Free again when the 5th newest wrong password leaves the window
  const blockingTime = recent[recent.length - MAX_ATTEMPTS];
  return Math.max(1, Math.ceil((blockingTime + WINDOW_MS - now) / 1000));
}

export function isLocked(key, now = Date.now()) {
  return getRemainingSeconds(key, now) > 0;
}

// For the tests
export function clearAllAttempts() {
  failures.clear();
}

// Keys that nobody asked about again would stay forever. unref: the timer never keeps the server alive.
setInterval(() => {
  const now = Date.now();
  for (const key of failures.keys()) {
    recentFailures(key, now);
  }
}, WINDOW_MS).unref();

// Before the login controller: a locked key is refused without checking the password
export function checkLoginRateLimit(req, res, next) {
  const remainingSeconds = getRemainingSeconds(getLoginKey(req));
  if (remainingSeconds === 0) {
    return next();
  }

  res.set("Retry-After", String(remainingSeconds));
  next({ status: 429, code: "ACCOUNT_LOCKED", message: `Too many failed login attempts. Try again in ${remainingSeconds} seconds.` });
}
