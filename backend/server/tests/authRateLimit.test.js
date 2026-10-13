import { beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { useFakeRepos } from "./helpers.js";

process.env.JWT_SECRET = "test-secret";

const { supabaseRepo, resetData } = useFakeRepos();

const {
  WINDOW_MS,
  MAX_ATTEMPTS,
  checkLoginRateLimit,
  recordFailedAttempt,
  resetFailedAttempts,
  isLocked,
  getRemainingSeconds,
  cleanupExpiredAttempts,
  clearAllAttempts,
  stopCleanupTimer,
} = await import("../middleware/loginRateLimiter.js");

const { login } = await import("../controllers/auth.controller.js");

beforeEach(async () => {
  await resetData();
  clearAllAttempts();
  mock.method(console, "error", () => {});
});

function callMiddleware(middleware, req) {
  const result = {
    statusCode: 200,
    headers: {},
    body: null,
    calledNext: false,
  };

  const res = {
    status(code) {
      result.statusCode = code;
      return res;
    },
    json(data) {
      result.body = data;
      return res;
    },
    setHeader(key, val) {
      result.headers[key.toLowerCase()] = String(val);
      return res;
    },
    set(key, val) {
      result.headers[key.toLowerCase()] = String(val);
      return res;
    },
  };

  middleware(req, res, () => {
    result.calledNext = true;
  });

  return result;
}

test("recordFailedAttempt increments failure count and updates timestamp", () => {
  const ip = "192.168.1.10";
  const now = 100000;

  const entry1 = recordFailedAttempt(ip, now);
  assert.equal(entry1.count, 1);
  assert.equal(entry1.timestamp, now);

  const entry2 = recordFailedAttempt(ip, now + 1000);
  assert.equal(entry2.count, 2);
  assert.equal(entry2.timestamp, now + 1000);
});

test("resetFailedAttempts clears failure count for an IP", () => {
  const ip = "192.168.1.11";
  recordFailedAttempt(ip);
  recordFailedAttempt(ip);
  assert.equal(isLocked(ip), false);

  resetFailedAttempts(ip);
  assert.equal(getRemainingSeconds(ip), 0);
  assert.equal(isLocked(ip), false);
});

test("allows requests when failed attempts are fewer than MAX_ATTEMPTS (5)", () => {
  const ip = "10.0.0.1";
  for (let i = 0; i < 4; i++) {
    recordFailedAttempt(ip);
  }

  const req = { ip };
  const res = callMiddleware(checkLoginRateLimit, req);

  assert.equal(res.calledNext, true);
  assert.equal(res.statusCode, 200);
});

test("locks out an IP after 5 failed attempts in 15 seconds with 429 and Retry-After", () => {
  const ip = "10.0.0.2";
  const baseTime = Date.now();

  for (let i = 0; i < 5; i++) {
    recordFailedAttempt(ip, baseTime + i * 1000);
  }

  assert.equal(isLocked(ip, baseTime + 5000), true);

  const req = { ip };
  const res = callMiddleware(checkLoginRateLimit, req);

  assert.equal(res.calledNext, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, "ACCOUNT_LOCKED");
  assert.equal(res.body.error.code, "ACCOUNT_LOCKED");
  assert.equal(res.body.message, "Too many failed login attempts. Please try again in 15 seconds.");
  assert.ok(res.headers["retry-after"], "Retry-After header must be set");

  const retryAfter = Number(res.headers["retry-after"]);
  assert.ok(retryAfter > 0 && retryAfter <= 15, "Retry-After should be within 15 seconds");
});

test("different IPs have independent attempt counts", () => {
  const ipA = "10.0.0.3";
  const ipB = "10.0.0.4";

  for (let i = 0; i < 5; i++) {
    recordFailedAttempt(ipA);
  }

  assert.equal(isLocked(ipA), true);
  assert.equal(isLocked(ipB), false);

  const resA = callMiddleware(checkLoginRateLimit, { ip: ipA });
  const resB = callMiddleware(checkLoginRateLimit, { ip: ipB });

  assert.equal(resA.calledNext, false);
  assert.equal(resA.statusCode, 429);

  assert.equal(resB.calledNext, true);
  assert.equal(resB.statusCode, 200);
});

test("attempts older than 15 seconds expire and do not lock out the IP", () => {
  const ip = "10.0.0.5";
  const t0 = 1000000;

  // 4 attempts at t0
  for (let i = 0; i < 4; i++) {
    recordFailedAttempt(ip, t0);
  }

  // 15 seconds + 1 second later
  const tLater = t0 + WINDOW_MS + 1000;
  // 5th attempt much later
  recordFailedAttempt(ip, tLater);

  // Since old 4 expired, only 1 recent attempt exists
  assert.equal(isLocked(ip, tLater), false);
  assert.equal(getRemainingSeconds(ip, tLater), 0);
});

test("cleanupExpiredAttempts removes entries whose attempts have expired", () => {
  const ip = "10.0.0.6";
  const t0 = 500000;
  recordFailedAttempt(ip, t0);

  const tLater = t0 + WINDOW_MS + 1000;
  cleanupExpiredAttempts(tLater);

  assert.equal(isLocked(ip, tLater), false);
  assert.equal(getRemainingSeconds(ip, tLater), 0);
});

test("login controller increments failed attempts on invalid credentials and resets on success", async () => {
  const ip = "10.0.0.7";
  const hashPassword = await bcrypt.hash("correct-pass", 10);
  await supabaseRepo.insertOne("users", {
    email: "test@example.com",
    username: "tester",
    hashPassword,
    role: "visitor",
    buildingIds: [],
  });

  // Attempt 1: wrong password
  let err1 = null;
  const req1 = { ip, body: { email: "test@example.com", password: "wrong-pass" } };
  await login(req1, {}, (err) => { err1 = err; });
  assert.equal(err1?.code, "INVALID_CREDENTIALS");
  assert.equal(getRemainingSeconds(ip), 0); // 1 fail, not locked yet

  // Attempt 2: non-existent email
  let err2 = null;
  const req2 = { ip, body: { email: "nonexistent@example.com", password: "pass" } };
  await login(req2, {}, (err) => { err2 = err; });
  assert.equal(err2?.code, "INVALID_CREDENTIALS");

  // Attempt 3..5: 3 more wrong passwords
  for (let i = 0; i < 3; i++) {
    await login(req1, {}, () => {});
  }

  // Now IP has 5 failures and should be locked
  assert.equal(isLocked(ip), true);
  assert.ok(getRemainingSeconds(ip) > 0);

  // Now simulate successful login with correct credentials from another IP to prove reset
  const ipSuccess = "10.0.0.8";
  for (let i = 0; i < 3; i++) {
    await login({ ip: ipSuccess, body: { email: "test@example.com", password: "wrong" } }, {}, () => {});
  }
  // Not locked yet, has 3 failures
  assert.equal(isLocked(ipSuccess), false);

  let successResult = null;
  const resSuccess = {
    json(data) {
      successResult = data;
    },
  };
  await login({ ip: ipSuccess, body: { email: "test@example.com", password: "correct-pass" } }, resSuccess, () => {});

  assert.ok(successResult?.token, "Successful login returns token");
  // Failures for ipSuccess must have been reset to 0
  assert.equal(getRemainingSeconds(ipSuccess), 0);
  assert.equal(isLocked(ipSuccess), false);
});

test("handles IP resolution from socket.remoteAddress and fallbacks safely", () => {
  const reqWithSocket = { socket: { remoteAddress: "172.16.0.1" } };
  recordFailedAttempt(reqWithSocket);
  assert.equal(isLocked("172.16.0.1"), false);

  const reqEmpty = {};
  recordFailedAttempt(reqEmpty);
  assert.equal(isLocked("unknown"), false);
});

test("normalizes IPv6-mapped IPv4 addresses so ::ffff:1.2.3.4 and 1.2.3.4 share limit", () => {
  const ipv4 = "192.168.20.1";
  const mapped = "::ffff:192.168.20.1";

  for (let i = 0; i < 3; i++) {
    recordFailedAttempt(mapped);
  }
  for (let i = 0; i < 2; i++) {
    recordFailedAttempt(ipv4);
  }

  // Combined attempts = 5, both forms should be locked
  assert.equal(isLocked(ipv4), true);
  assert.equal(isLocked(mapped), true);
  assert.ok(getRemainingSeconds(mapped) > 0);
  assert.equal(getRemainingSeconds(ipv4), getRemainingSeconds(mapped));

  resetFailedAttempts(mapped);
  assert.equal(isLocked(ipv4), false);
});

test("calculates exact remaining seconds when more than 5 attempts occur", () => {
  const ip = "10.0.0.99";
  const baseTime = 1000000;

  // 6 attempts at intervals of 1 second:
  // t0=1000000, t1=1001000, t2=1002000, t3=1003000, t4=1004000, t5=1005000
  for (let i = 0; i < 6; i++) {
    recordFailedAttempt(ip, baseTime + i * 1000);
  }

  // At now = baseTime + 6000 (6 seconds later):
  // With 6 attempts, unlocking occurs when attempt 1 (t1=1001000) expires,
  // because after attempt 0 expires, 5 attempts remain (still locked).
  // Unlock time = 1001000 + 15000 = 1016000.
  // Remaining ms = 1016000 - 1006000 = 10000 ms -> 10 seconds.
  const now = baseTime + 6000;
  assert.equal(isLocked(ip, now), true);
  assert.equal(getRemainingSeconds(ip, now), 10);
});

test("checkLoginRateLimit unlocks IP and allows request when 15-second window expires", () => {
  const ip = "10.0.0.88";
  const baseTime = 2000000;

  for (let i = 0; i < 5; i++) {
    recordFailedAttempt(ip, baseTime);
  }

  assert.equal(isLocked(ip, baseTime), true);

  // Still locked at baseTime + 14 seconds (14000 ms)
  const stillLockedRes = callMiddleware(
    (req, res, next) => {
      // Mock Date.now inside check
      const origNow = Date.now;
      Date.now = () => baseTime + 14000;
      try {
        checkLoginRateLimit(req, res, next);
      } finally {
        Date.now = origNow;
      }
    },
    { ip }
  );
  assert.equal(stillLockedRes.statusCode, 429);
  assert.equal(stillLockedRes.calledNext, false);

  // Unlocked at baseTime + WINDOW_MS + 1000 ms (expired)
  const unlockedRes = callMiddleware(
    (req, res, next) => {
      const origNow = Date.now;
      Date.now = () => baseTime + WINDOW_MS + 1000;
      try {
        checkLoginRateLimit(req, res, next);
      } finally {
        Date.now = origNow;
      }
    },
    { ip }
  );
  assert.equal(unlockedRes.statusCode, 200);
  assert.equal(unlockedRes.calledNext, true);
});

test("stopCleanupTimer stops interval without error", () => {
  assert.doesNotThrow(() => {
    stopCleanupTimer();
  });
});

