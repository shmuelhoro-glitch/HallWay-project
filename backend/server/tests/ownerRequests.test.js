import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { useFakeRepos } from "./helpers.js";

// A visitor asks to manage a building, and we (super) read the requests.
// The tests go through the real routes, over HTTP on this computer only.

process.env.JWT_SECRET = "test-secret";

const { supabaseRepo, resetData } = useFakeRepos();

const { errorHandler } = await import("../middleware/errorHandler.js");
const { default: ownerRequestsRoutes } = await import("../routes/ownerRequests.routes.js");

// The same path as server.js
const app = express();
app.use(express.json());
app.use("/api/owner-requests", ownerRequestsRoutes);
app.use(errorHandler);

const REQUEST = {
  full_name: "דנה לוי",
  phone: "050-1234567",
  building_name: "קניון הצפון",
  building_type: "mall",
  city: "חיפה",
  message: "אני מנהלת את הקניון ורוצה להוסיף אותו.",
};

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
  mock.method(console, "error", () => {});
});

async function addUser(role, username = `user_${role}`) {
  const user = await supabaseRepo.insertOne("users", {
    username,
    email: `${username}@example.com`,
    hashPassword: "secret-hash",
    role,
    buildingIds: [],
  });
  const token = jwt.sign({ userId: user.id, role }, process.env.JWT_SECRET);
  return { id: user.id, token };
}

async function request(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(baseUrl + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => null);
  return { status: response.status, body: data };
}

function send(user, body = REQUEST) {
  return request("POST", "/api/owner-requests", { token: user.token, body });
}

// ---------- Sending a request ----------

test("a logged-in visitor sends a request, and it is saved as new, under his user", async () => {
  const visitor = await addUser("visitor");

  const result = await send(visitor);

  assert.equal(result.status, 201);
  assert.deepEqual(supabaseRepo.all("owner_requests"), [{ id: 1, user_id: visitor.id, status: "new", ...REQUEST }]);
});

test("without logging in, a request can't be sent", async () => {
  const result = await request("POST", "/api/owner-requests", { body: REQUEST });

  assert.equal(result.status, 401);
  assert.equal(supabaseRepo.all("owner_requests").length, 0);
});

test("the phone and the message are optional, and an empty one is not saved", async () => {
  const visitor = await addUser("visitor");

  const result = await send(visitor, { ...REQUEST, phone: "", message: "" });

  assert.equal(result.status, 201);
  const saved = supabaseRepo.all("owner_requests")[0];
  assert.equal("phone" in saved, false);
  assert.equal("message" in saved, false);
});

test("a request without a name, a building or a city is refused, and so is a wrong phone or type", async () => {
  const visitor = await addUser("visitor");

  const results = await Promise.all([
    send(visitor, { ...REQUEST, full_name: " " }),
    send(visitor, { ...REQUEST, building_name: "" }),
    send(visitor, { ...REQUEST, city: undefined }),
    send(visitor, { ...REQUEST, phone: "call me" }),
    send(visitor, { ...REQUEST, building_type: "castle" }),
  ]);

  assert.deepEqual(results.map((result) => result.body.error.code), Array(5).fill("VALIDATION_ERROR"));
  assert.equal(supabaseRepo.all("owner_requests").length, 0);
});

test("the user of the request is the one who is logged in, whatever the request says", async () => {
  const visitor = await addUser("visitor");
  const other = await addUser("visitor", "someone_else");

  await send(visitor, { ...REQUEST, user_id: other.id, status: "handled" });

  const saved = supabaseRepo.all("owner_requests")[0];
  assert.equal(saved.user_id, visitor.id);
  assert.equal(saved.status, "new");
});

test("a user with an open request can't send another one, until we handle the first", async () => {
  const visitor = await addUser("visitor");
  await send(visitor);

  const again = await send(visitor);
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, "REQUEST_EXISTS");

  await supabaseRepo.updateOne("owner_requests", { id: 1 }, { status: "handled" });

  const afterHandled = await send(visitor);
  assert.equal(afterHandled.status, 201);
});

// ---------- "My request" ----------

test("a user sees his newest request, and only his", async () => {
  const visitor = await addUser("visitor");
  const other = await addUser("visitor", "someone_else");
  await send(visitor);
  await supabaseRepo.updateOne("owner_requests", { id: 1 }, { status: "handled" });
  await send(other);
  await send(visitor, { ...REQUEST, building_name: "קניון חדש" });

  const mine = await request("GET", "/api/owner-requests/mine", { token: visitor.token });

  assert.equal(mine.status, 200);
  assert.equal(mine.body.building_name, "קניון חדש");
  assert.equal(mine.body.user_id, visitor.id);
});

test("a user who never sent a request gets nothing", async () => {
  const visitor = await addUser("visitor");

  const mine = await request("GET", "/api/owner-requests/mine", { token: visitor.token });

  assert.equal(mine.status, 200);
  assert.equal(mine.body, null);
});

// ---------- The list, for us only ----------

test("only a super reads the list of requests", async () => {
  const visitor = await addUser("visitor");
  const admin = await addUser("admin");
  await send(visitor);

  const asVisitor = await request("GET", "/api/owner-requests", { token: visitor.token });
  const asAdmin = await request("GET", "/api/owner-requests", { token: admin.token });
  const asNobody = await request("GET", "/api/owner-requests");

  assert.deepEqual([asVisitor.status, asAdmin.status, asNobody.status], [403, 403, 401]);
});

test("a super gets every request, the newest first, with who sent it - without his password", async () => {
  const owner = await addUser("super");
  const dana = await addUser("visitor", "dana_levi");
  const noa = await addUser("visitor", "noa_cohen");
  await send(dana);
  await send(noa, { ...REQUEST, building_name: "בית חולים הים", building_type: "hospital" });

  const list = await request("GET", "/api/owner-requests", { token: owner.token });

  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((item) => item.building_name), ["בית חולים הים", "קניון הצפון"]);
  assert.deepEqual(list.body[1].user, { id: dana.id, username: "dana_levi", email: "dana_levi@example.com", role: "visitor" });
  assert.equal(JSON.stringify(list.body).includes("secret-hash"), false);
});

test("a request of a user that was deleted is still listed", async () => {
  const owner = await addUser("super");
  const visitor = await addUser("visitor");
  await send(visitor);
  await supabaseRepo.deleteOne("users", { id: visitor.id });

  const list = await request("GET", "/api/owner-requests", { token: owner.token });

  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].user, null);
});

// ---------- Marking a request ----------

test("a super marks a request as handled, and back as new", async () => {
  const owner = await addUser("super");
  const visitor = await addUser("visitor");
  await send(visitor);

  const handled = await request("PATCH", "/api/owner-requests/1", { token: owner.token, body: { status: "handled" } });
  assert.equal(handled.status, 200);
  assert.equal(supabaseRepo.all("owner_requests")[0].status, "handled");

  const reopened = await request("PATCH", "/api/owner-requests/1", { token: owner.token, body: { status: "new" } });
  assert.equal(reopened.body.status, "new");
});

test("marking a request does not change anyone's role", async () => {
  const owner = await addUser("super");
  const visitor = await addUser("visitor");
  await send(visitor);

  await request("PATCH", "/api/owner-requests/1", { token: owner.token, body: { status: "handled" } });

  const savedVisitor = supabaseRepo.all("users").find((user) => user.id === visitor.id);
  assert.equal(savedVisitor.role, "visitor");
});

test("only a super marks requests, and only with a known status", async () => {
  const owner = await addUser("super");
  const visitor = await addUser("visitor");
  await send(visitor);

  const asVisitor = await request("PATCH", "/api/owner-requests/1", { token: visitor.token, body: { status: "handled" } });
  const badStatus = await request("PATCH", "/api/owner-requests/1", { token: owner.token, body: { status: "approved" } });
  const badId = await request("PATCH", "/api/owner-requests/abc", { token: owner.token, body: { status: "handled" } });
  const missing = await request("PATCH", "/api/owner-requests/999", { token: owner.token, body: { status: "handled" } });

  assert.equal(asVisitor.status, 403);
  assert.equal(badStatus.body.error.code, "VALIDATION_ERROR");
  assert.equal(badId.body.error.code, "VALIDATION_ERROR");
  assert.equal(missing.body.error.code, "REQUEST_NOT_FOUND");
  assert.equal(supabaseRepo.all("owner_requests")[0].status, "new");
});
