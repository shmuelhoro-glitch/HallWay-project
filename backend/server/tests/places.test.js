import { beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_ID, callController, useFakeRepos } from "./helpers.js";

// A place and its entrance node are saved in two collections.
// These tests check that they stay together, also when the database fails in the middle.

const { mongoRepo, resetData } = useFakeRepos();

const { createPlace, updatePlace, deletePlace } = await import("../controllers/places.controller.js");
const { updateNode } = await import("../controllers/graph.controller.js");

const NEW_PLACE = {
  floor: 0,
  name: "Sea Fashion",
  type: "store",
  category: "Fashion",
  x: 100,
  y: 100,
  hours: "10:00-22:00",
  isLandmark: false,
};

// A place with its entrance, and a corridor point connected to that entrance
async function createConnectedPlace() {
  const created = await callController(createPlace, { params: { buildingId: BUILDING_ID }, body: { ...NEW_PLACE } });
  const place = created.body;

  const corridorId = await mongoRepo.insertOne("nodes", { buildingId: BUILDING_ID, floor: 0, x: 100, y: 200, type: "corridor" });
  await mongoRepo.insertOne("edges", {
    buildingId: BUILDING_ID,
    from: String(corridorId),
    to: place.entryNodeId,
    length: 100,
    blocked: false,
  });

  return { placeId: String(place._id), entryNodeId: place.entryNodeId };
}

function findById(collection, id) {
  return mongoRepo.all(collection).find((doc) => String(doc._id) === id);
}

function update(placeId, body) {
  return callController(updatePlace, { params: { buildingId: BUILDING_ID, placeId }, body });
}

beforeEach(async () => {
  await resetData();
  mock.method(console, "error", () => {}); // the "could not undo" log is checked, not printed
});

// ---------- Create ----------

test("a new place gets an entrance node in the same spot", async () => {
  const result = await callController(createPlace, { params: { buildingId: BUILDING_ID }, body: { ...NEW_PLACE } });

  assert.equal(result.status, 201);
  assert.equal(result.error, null);

  const node = findById("nodes", result.body.entryNodeId);
  assert.equal(node.type, "entrance");
  assert.equal(node.label, "Sea Fashion");
  assert.deepEqual([node.floor, node.x, node.y], [0, 100, 100]);
});

test("when the place can't be saved, its entrance node is not left behind", async () => {
  mongoRepo.failOn("insertOne", "places");

  const result = await callController(createPlace, { params: { buildingId: BUILDING_ID }, body: { ...NEW_PLACE } });

  assert.match(result.error.message, /Fake database failure/);
  assert.equal(mongoRepo.all("places").length, 0);
  assert.equal(mongoRepo.all("nodes").length, 0);
});

// ---------- Update ----------

test("moving a place moves its entrance and fixes the length of its walkways", async () => {
  const { placeId, entryNodeId } = await createConnectedPlace();

  const result = await update(placeId, { x: 100, y: 150 });

  assert.equal(result.error, null);
  assert.deepEqual([result.body.x, result.body.y], [100, 150]);

  const node = findById("nodes", entryNodeId);
  assert.deepEqual([node.x, node.y], [100, 150]);
  assert.equal(mongoRepo.all("edges")[0].length, 50);
});

test("a place that moves to another floor takes its entrance, without the old walkways", async () => {
  const { placeId, entryNodeId } = await createConnectedPlace();

  const result = await update(placeId, { floor: 1 });

  assert.equal(result.error, null);
  assert.equal(findById("places", placeId).floor, 1);
  assert.equal(findById("nodes", entryNodeId).floor, 1);
  assert.equal(mongoRepo.all("edges").length, 0);
});

test("renaming a place renames its entrance", async () => {
  const { placeId, entryNodeId } = await createConnectedPlace();

  await update(placeId, { name: "Sea Shoes" });

  assert.equal(findById("nodes", entryNodeId).label, "Sea Shoes");
});

test("when the entrance can't be updated, the place goes back to what it was", async () => {
  const { placeId, entryNodeId } = await createConnectedPlace();
  mongoRepo.failOn("updateOne", "nodes");

  const result = await update(placeId, { name: "Sea Shoes", x: 300, hours: "" });

  assert.match(result.error.message, /Fake database failure/);

  const place = findById("places", placeId);
  assert.equal(place.name, "Sea Fashion");
  assert.equal(place.x, 100);
  assert.equal(place.hours, "10:00-22:00"); // a removed field comes back too

  const node = findById("nodes", entryNodeId);
  assert.equal(node.label, "Sea Fashion");
  assert.equal(node.x, 100);
});

test("when the old walkways can't be removed, the place and its entrance stay on the old floor", async () => {
  const { placeId, entryNodeId } = await createConnectedPlace();
  mongoRepo.failOn("deleteMany", "edges");

  const result = await update(placeId, { floor: 1 });

  assert.match(result.error.message, /Fake database failure/);
  assert.equal(findById("places", placeId).floor, 0);
  assert.equal(findById("nodes", entryNodeId).floor, 0);
  assert.equal(mongoRepo.all("edges").length, 1);
});

test("when a walkway length can't be saved, the place and its entrance go back to the old spot", async () => {
  const { placeId, entryNodeId } = await createConnectedPlace();
  mongoRepo.failOn("updateOne", "edges");

  const result = await update(placeId, { y: 150 });

  assert.match(result.error.message, /Fake database failure/);
  assert.equal(findById("places", placeId).y, 100);
  assert.equal(findById("nodes", entryNodeId).y, 100);
  assert.equal(mongoRepo.all("edges")[0].length, 100);
});

test("when the undo fails too, it is written in the log and the client gets the first error", async () => {
  const { placeId } = await createConnectedPlace();
  mongoRepo.failOn("updateOne", "nodes"); // the change
  mongoRepo.failOn("updateOne", "nodes"); // the undo of the node

  const result = await update(placeId, { x: 300 });

  assert.match(result.error.message, /Fake database failure/);
  assert.equal(console.error.mock.callCount(), 1);
  assert.match(console.error.mock.calls[0].arguments[0], /Could not undo/);
  assert.equal(findById("places", placeId).x, 100); // the place itself was still restored
});

// ---------- Delete ----------

test("deleting a place deletes its entrance and its walkways", async () => {
  const { placeId } = await createConnectedPlace();

  const result = await callController(deletePlace, { params: { buildingId: BUILDING_ID, placeId } });

  assert.equal(result.status, 204);
  assert.equal(mongoRepo.all("places").length, 0);
  assert.equal(mongoRepo.all("edges").length, 0);
  assert.deepEqual(mongoRepo.all("nodes").map((node) => node.type), ["corridor"]);
});

test("a delete that failed in the middle is finished by trying again", async () => {
  const { placeId } = await createConnectedPlace();
  mongoRepo.failOn("deleteOne", "places");

  const first = await callController(deletePlace, { params: { buildingId: BUILDING_ID, placeId } });
  assert.match(first.error.message, /Fake database failure/);
  assert.equal(mongoRepo.all("places").length, 1); // still in the list, so the admin can try again

  const second = await callController(deletePlace, { params: { buildingId: BUILDING_ID, placeId } });
  assert.equal(second.status, 204);
  assert.equal(mongoRepo.all("places").length, 0);
});

// ---------- Data that is already in the database ----------

test("an old place without an entrance node can still be updated and deleted", async () => {
  const placeId = String(await mongoRepo.insertOne("places", { ...NEW_PLACE, buildingId: BUILDING_ID }));

  const updated = await update(placeId, { name: "Old Store", x: 50 });
  assert.equal(updated.error, null);
  assert.equal(updated.body.name, "Old Store");

  const deleted = await callController(deletePlace, { params: { buildingId: BUILDING_ID, placeId } });
  assert.equal(deleted.status, 204);
});

// ---------- The walkways editor ----------

// On purpose: the place marks the store, its entrance marks the door. The admin moves
// the entrance to the door in the editor, and the place stays where it is.
test("moving an entrance in the walkways editor does not move the place", async () => {
  const { placeId, entryNodeId } = await createConnectedPlace();

  const result = await callController(updateNode, {
    params: { buildingId: BUILDING_ID, nodeId: entryNodeId },
    body: { x: 100, y: 140 },
  });

  assert.equal(result.error, null);
  assert.deepEqual([result.body.x, result.body.y], [100, 140]);
  assert.equal(mongoRepo.all("edges")[0].length, 60);

  const place = findById("places", placeId);
  assert.deepEqual([place.x, place.y], [100, 100]);
});
