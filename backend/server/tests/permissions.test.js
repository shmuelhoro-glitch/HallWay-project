import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { BUILDING_ID, useFakeRepos } from "./helpers.js";

// Who may change what. These tests go through the real routes (over HTTP, on this computer only),
// so they also check that every route is protected by the right middleware.

process.env.JWT_SECRET = "test-secret";

const { mongoRepo, supabaseRepo, resetData } = useFakeRepos();

// Creating a building asks Nominatim for the location. Not in a test.
mock.module(new URL("../services/geocoding.service.js", import.meta.url).href, {
  namedExports: { geocodeAddress: async () => ({ lat: 32.08, lng: 34.78 }) },
});

const { errorHandler } = await import("../middleware/errorHandler.js");
const { default: authRoutes } = await import("../routes/auth.routes.js");
const { default: buildingsRoutes } = await import("../routes/buildings.routes.js");
const { default: placesRoutes } = await import("../routes/places.routes.js");
const { default: graphRoutes } = await import("../routes/graph.routes.js");

// The same paths as server.js (server.js itself can't be imported: it starts listening)
const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/buildings", buildingsRoutes);
app.use("/api/buildings/:buildingId/places", placesRoutes);
app.use("/api/buildings/:buildingId/graph", graphRoutes);
app.use(errorHandler);

const OTHER_BUILDING_ID = "22222222-2222-4222-8222-222222222222";

const NEW_PLACE = { floor: 0, name: "Sea Fashion", type: "store", category: "Fashion", x: 100, y: 100 };
const NEW_NODE = { floor: 0, x: 10, y: 20 };
const NEW_FLOOR = { floor: 0, name: "Ground", svg: '<svg viewBox="0 0 640 1000"></svg>' };
const NEW_BUILDING = {
  name: "North Mall",
  type: "mall",
  address: "Main 1",
  city: "Haifa",
  alert_area: "Haifa",
  floors_count: 2,
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
  await supabaseRepo.insertOne("buildings", { id: OTHER_BUILDING_ID, name: "Other Mall" });
  mock.method(console, "error", () => {});
});

// A user in the database, and a token for him. tokenRole: what the token says, when it is not the same.
async function addUser(role, buildingIds = [], tokenRole = role) {
  const user = await supabaseRepo.insertOne("users", { username: `user_${role}`, role, buildingIds });
  const token = jwt.sign({ userId: user.id, role: tokenRole }, process.env.JWT_SECRET);
  return { id: user.id, token };
}

async function request(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(baseUrl + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => null);
  return { status: response.status, body: data };
}

// Every change a manager can make in a building
function everyChange(buildingId, token) {
  return [
    request("POST", `/api/buildings/${buildingId}/places`, { token, body: NEW_PLACE }),
    request("POST", `/api/buildings/${buildingId}/graph/nodes`, { token, body: NEW_NODE }),
    request("POST", `/api/buildings/${buildingId}/floors`, { token, body: NEW_FLOOR }),
    request("GET", `/api/buildings/${buildingId}/graph`, { token }),
  ];
}

function nothingWasSaved() {
  assert.equal(mongoRepo.all("places").length, 0);
  assert.equal(mongoRepo.all("nodes").length, 0);
  assert.equal(mongoRepo.all("floors").length, 0);
}

// ---------- Sign up ----------

test("everyone signs up as a visitor, also when the request asks for admin", async () => {
  const result = await request("POST", "/api/auth/register", {
    body: { username: "dana_levi", email: "dana@example.com", password: "Demo12345", role: "admin" },
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.user.role, "visitor");
  assert.equal(jwt.verify(result.body.token, process.env.JWT_SECRET).role, "visitor");
  assert.equal(supabaseRepo.all("users")[0].role, "visitor");
});

// ---------- Who may change a building ----------

test("without a token every change is refused", async () => {
  const results = await Promise.all(everyChange(BUILDING_ID, null));

  assert.deepEqual(results.map((result) => result.status), [401, 401, 401, 401]);
  nothingWasSaved();
});

test("a visitor can't change a building", async () => {
  const visitor = await addUser("visitor");

  const results = await Promise.all(everyChange(BUILDING_ID, visitor.token));

  assert.deepEqual(results.map((result) => result.status), [403, 403, 403, 403]);
  nothingWasSaved();
});

test("an admin changes his own building", async () => {
  const admin = await addUser("admin", [BUILDING_ID]);

  const results = await Promise.all(everyChange(BUILDING_ID, admin.token));

  assert.deepEqual(results.map((result) => result.status), [201, 201, 201, 200]);
});

test("an admin can't change a building of another admin", async () => {
  const admin = await addUser("admin", [BUILDING_ID]);

  const results = await Promise.all(everyChange(OTHER_BUILDING_ID, admin.token));

  assert.deepEqual(results.map((result) => result.status), [403, 403, 403, 403]);
  nothingWasSaved();
});

test("a super changes every building", async () => {
  const owner = await addUser("super");

  const results = await Promise.all(everyChange(OTHER_BUILDING_ID, owner.token));

  assert.deepEqual(results.map((result) => result.status), [201, 201, 201, 200]);
});

// ---------- The database decides, not the token ----------

test("a manager we removed is refused, although his token still says admin", async () => {
  const removed = await addUser("visitor", [], "admin");

  const results = await Promise.all(everyChange(BUILDING_ID, removed.token));

  assert.deepEqual(results.map((result) => result.status), [403, 403, 403, 403]);
  nothingWasSaved();
});

test("a manager we added is allowed right away, although his token still says visitor", async () => {
  const added = await addUser("admin", [BUILDING_ID], "visitor");

  const result = await request("POST", `/api/buildings/${BUILDING_ID}/places`, { token: added.token, body: NEW_PLACE });

  assert.equal(result.status, 201);
});

test("a user that was deleted is refused", async () => {
  const admin = await addUser("admin", [BUILDING_ID]);
  await supabaseRepo.deleteOne("users", { id: admin.id });

  const result = await request("POST", `/api/buildings/${BUILDING_ID}/places`, { token: admin.token, body: NEW_PLACE });

  assert.equal(result.status, 403);
});

// ---------- A new building ----------

test("a visitor can't create a building", async () => {
  const visitor = await addUser("visitor");

  const result = await request("POST", "/api/buildings", { token: visitor.token, body: NEW_BUILDING });

  assert.equal(result.status, 403);
  assert.equal(supabaseRepo.all("buildings").length, 2);
});

test("a new building belongs to the admin who created it", async () => {
  const admin = await addUser("admin", [BUILDING_ID]);

  const created = await request("POST", "/api/buildings", { token: admin.token, body: NEW_BUILDING });
  assert.equal(created.status, 201);

  const savedAdmin = supabaseRepo.all("users")[0];
  assert.deepEqual(savedAdmin.buildingIds, [BUILDING_ID, created.body.id]);

  // And he can work on it right away
  const floor = await request("POST", `/api/buildings/${created.body.id}/floors`, { token: admin.token, body: NEW_FLOOR });
  assert.equal(floor.status, 201);
});

test("a spot the admin confirmed on the map is saved as it is, and not looked up again", async () => {
  const admin = await addUser("admin");

  const created = await request("POST", "/api/buildings", {
    token: admin.token,
    body: { ...NEW_BUILDING, lat: 31.5, lng: 35.1 },
  });

  assert.equal(created.status, 201);
  assert.deepEqual([created.body.lat, created.body.lng], [31.5, 35.1]); // the fake geocoder answers 32.08, 34.78
});

test("a super creates a building without adding it to a list", async () => {
  const owner = await addUser("super");

  const created = await request("POST", "/api/buildings", { token: owner.token, body: NEW_BUILDING });

  assert.equal(created.status, 201);
  assert.deepEqual(supabaseRepo.all("users")[0].buildingIds, []);
});

test("when the building can't be given to its manager, it is not left behind", async () => {
  const admin = await addUser("admin");
  supabaseRepo.failOn("updateOne", "users");

  const result = await request("POST", "/api/buildings", { token: admin.token, body: NEW_BUILDING });

  assert.equal(result.status, 500);
  assert.deepEqual(supabaseRepo.all("buildings").map((building) => building.name).sort(), ["Other Mall", "Sea Mall"]);
});

// ---------- The list in the admin home screen ----------

test("an admin gets only his buildings, a super gets all of them, a visitor none", async () => {
  const admin = await addUser("admin", [BUILDING_ID]);
  const owner = await addUser("super");
  const visitor = await addUser("visitor");

  const adminList = await request("GET", "/api/buildings/mine", { token: admin.token });
  const ownerList = await request("GET", "/api/buildings/mine", { token: owner.token });
  const visitorList = await request("GET", "/api/buildings/mine", { token: visitor.token });

  assert.deepEqual(adminList.body.map((building) => building.id), [BUILDING_ID]);
  assert.deepEqual(ownerList.body.map((building) => building.id).sort(), [BUILDING_ID, OTHER_BUILDING_ID]);
  assert.equal(visitorList.status, 403);
});

// ---------- What stays open ----------

test("the places and the list of buildings are still open to everyone", async () => {
  const places = await request("GET", `/api/buildings/${BUILDING_ID}/places`);
  const buildings = await request("GET", "/api/buildings");

  assert.equal(places.status, 200);
  assert.equal(buildings.status, 200);
  assert.equal(buildings.body.length, 2);
});
