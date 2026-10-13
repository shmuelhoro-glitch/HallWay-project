import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import express from "express";
import { useFakeRepos } from "./helpers.js";

// Too many wrong passwords lock the login for a few seconds.
// The login tests go through the real route, over HTTP on this computer only.

process.env.JWT_SECRET = "test-secret";

const { supabaseRepo, resetData } = useFakeRepos();

const {
  MAX_ATTEMPTS,
  WINDOW_MS,
  clearAllAttempts,
  getLoginKey,
  getRemainingSeconds,
  isLocked,
  recordFailedAttempt,
  resetFailedAttempts,
} = await import("../middleware/loginRateLimiter.js");

const { errorHandler } = await import("../middleware/errorHandler.js");
const { default: authRoutes } = await import("../routes/auth.routes.js");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use(errorHandler);

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

beforeEach(async () => {
  await resetData();
  clearAllAttempts();
  mock.method(console, "error", () => {});

  // 4 rounds: fast, and the tests only need a hash that matches
  for (const name of ["dana", "noa"]) {
    await supabaseRepo.insertOne("users", {
      username: name,
      email: `${name}@example.com`,
      hashPassword: await bcrypt.hash("Correct123", 4),
      role: "visitor",
      buildingIds: [],
    });
  }
});

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: response.status, body: await response.json(), retryAfter: response.headers.get("retry-after") };
}

async function failTimes(email, times) {
  for (let i = 0; i < times; i++) {
    await login(email, "wrong-password");
  }
}

// ---------- The count itself ----------

test("a key is locked only from the 5th wrong password, and for what is left of the 15 seconds", () => {
  const start = 1_000_000;

  for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
    recordFailedAttempt("key", start + i * 1000);
  }
  assert.equal(isLocked("key", start + 4000), false);

  recordFailedAttempt("key", start + 4000);
  assert.equal(isLocked("key", start + 4000), true);
  assert.equal(getRemainingSeconds("key", start + 4000), 11); // the first wrong password leaves after 15 seconds
});

test("when the window passes the key is free again, without anyone freeing it", () => {
  const start = 1_000_000;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    recordFailedAttempt("key", start);
  }

  assert.equal(isLocked("key", start + WINDOW_MS - 1), true);
  assert.equal(isLocked("key", start + WINDOW_MS), false);
  assert.equal(getRemainingSeconds("key", start + WINDOW_MS), 0);
});

test("a wrong password that is older than the window does not count", () => {
  const start = 1_000_000;
  recordFailedAttempt("key", start);
  for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
    recordFailedAttempt("key", start + WINDOW_MS + i);
  }

  assert.equal(isLocked("key", start + WINDOW_MS + 10), false);
});

test("one key does not lock another, and a reset frees only its own key", () => {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    recordFailedAttempt("first");
    recordFailedAttempt("second");
  }

  resetFailedAttempts("first");

  assert.equal(isLocked("first"), false);
  assert.equal(isLocked("second"), true);
  assert.equal(isLocked("third"), false);
});

test("the key is the address with the email, whatever the letters of the email", () => {
  const key = getLoginKey({ ip: "::ffff:10.0.0.7", body: { email: " Dana@Example.com " } });

  assert.equal(key, "10.0.0.7|dana@example.com");
  assert.notEqual(key, getLoginKey({ ip: "10.0.0.7", body: { email: "noa@example.com" } }));
  assert.notEqual(key, getLoginKey({ ip: "10.0.0.8", body: { email: "dana@example.com" } }));
});

// ---------- The login route ----------

test("after 5 wrong passwords the login is refused, also with the right password", async () => {
  await failTimes("dana@example.com", MAX_ATTEMPTS);

  const result = await login("dana@example.com", "Correct123");

  assert.equal(result.status, 429);
  assert.equal(result.body.error.code, "ACCOUNT_LOCKED");
  assert.ok(Number(result.retryAfter) >= 1 && Number(result.retryAfter) <= 15);
});

test("4 wrong passwords do not lock, and a login after them starts the count again", async () => {
  await failTimes("dana@example.com", MAX_ATTEMPTS - 1);

  const ok = await login("dana@example.com", "Correct123");
  assert.equal(ok.status, 200);

  await failTimes("dana@example.com", MAX_ATTEMPTS - 1);
  const stillOpen = await login("dana@example.com", "Correct123");
  assert.equal(stillOpen.status, 200);
});

test("wrong passwords for one account do not lock another account from the same address", async () => {
  await failTimes("dana@example.com", MAX_ATTEMPTS);

  const other = await login("noa@example.com", "Correct123");

  assert.equal(other.status, 200);
});

test("a login of another account does not free a locked one", async () => {
  await failTimes("dana@example.com", MAX_ATTEMPTS);
  await login("noa@example.com", "Correct123");

  const result = await login("dana@example.com", "Correct123");

  assert.equal(result.status, 429);
});

test("an email that is not registered is counted too, so nobody learns who is registered", async () => {
  await failTimes("nobody@example.com", MAX_ATTEMPTS);

  const result = await login("nobody@example.com", "whatever");

  assert.equal(result.status, 429);
});
