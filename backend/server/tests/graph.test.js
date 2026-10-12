import { beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_ID, callController, useFakeRepos } from "./helpers.js";

// The walking graph: points (nodes) and walkways (edges), the way the admin editor changes them.

const { mongoRepo, resetData } = useFakeRepos();

const { createNode, updateNode, deleteNode, createEdge, updateEdge, deleteEdge, getGraph } = await import(
  "../controllers/graph.controller.js"
);

const OTHER_BUILDING_ID = "22222222-2222-4222-8222-222222222222";
const MISSING_ID = "000000000000000000000000";

function addNode(body, buildingId = BUILDING_ID) {
  return callController(createNode, { params: { buildingId }, body: { type: "corridor", ...body } });
}

function changeNode(nodeId, body) {
  return callController(updateNode, { params: { buildingId: BUILDING_ID, nodeId }, body });
}

function removeNode(nodeId) {
  return callController(deleteNode, { params: { buildingId: BUILDING_ID, nodeId } });
}

function connect(from, to) {
  return callController(createEdge, { params: { buildingId: BUILDING_ID }, body: { from, to } });
}

function setBlocked(edgeId, blocked) {
  return callController(updateEdge, { params: { buildingId: BUILDING_ID, edgeId }, body: { blocked } });
}

function removeEdge(edgeId) {
  return callController(deleteEdge, { params: { buildingId: BUILDING_ID, edgeId } });
}

function loadGraph(floor) {
  return callController(getGraph, { params: { buildingId: BUILDING_ID }, query: { floor } });
}

// A point that is already in the database. Returns its id.
async function saveNode(node = {}) {
  const id = await mongoRepo.insertOne("nodes", { buildingId: BUILDING_ID, floor: 0, x: 0, y: 0, type: "corridor", ...node });
  return String(id);
}

// A walkway that is already in the database. Returns its id.
async function saveEdge(from, to, edge = {}) {
  const id = await mongoRepo.insertOne("edges", { buildingId: BUILDING_ID, from, to, length: 10, blocked: false, ...edge });
  return String(id);
}

function findById(collection, id) {
  return mongoRepo.all(collection).find((doc) => String(doc._id) === id);
}

beforeEach(async () => {
  await resetData();
  mock.method(console, "error", () => {});
});

// ---------- Draw mode: a point together with its walkway ----------

test("a point without connectFrom is saved alone, like before", async () => {
  const result = await addNode({ floor: 0, x: 10, y: 20 });

  assert.equal(result.status, 201);
  assert.equal(result.body.edge, undefined);
  assert.equal(mongoRepo.all("nodes").length, 1);
  assert.equal(mongoRepo.all("edges").length, 0);
});

test("a point with connectFrom is saved with a walkway to the point before it", async () => {
  const firstId = await saveNode();

  const result = await addNode({ floor: 0, x: 30, y: 40, connectFrom: firstId });

  assert.equal(result.status, 201);
  assert.equal(result.error, null);
  assert.deepEqual(
    { from: result.body.edge.from, to: result.body.edge.to, length: result.body.edge.length, blocked: result.body.edge.blocked },
    { from: firstId, to: result.body.id, length: 50, blocked: false },
  );

  const savedEdge = mongoRepo.all("edges")[0];
  assert.equal(savedEdge.buildingId, BUILDING_ID);
  assert.equal(String(savedEdge._id), result.body.edge.id);
});

test("when the walkway can't be saved, the new point is not left behind", async () => {
  const firstId = await saveNode();
  mongoRepo.failOn("insertOne", "edges");

  const result = await addNode({ floor: 0, x: 30, y: 40, connectFrom: firstId });

  assert.match(result.error.message, /Fake database failure/);
  assert.equal(mongoRepo.all("edges").length, 0);
  assert.deepEqual(mongoRepo.all("nodes").map((node) => String(node._id)), [firstId]);
});

test("a point can't be connected to a point on another floor, and nothing is saved", async () => {
  const firstId = await saveNode({ floor: 1 });

  const result = await addNode({ floor: 0, x: 30, y: 40, connectFrom: firstId });

  assert.equal(result.error.code, "DIFFERENT_FLOORS");
  assert.equal(mongoRepo.all("nodes").length, 1);
  assert.equal(mongoRepo.all("edges").length, 0);
});

test("a point can't be connected to a point that was deleted, and nothing is saved", async () => {
  const firstId = await saveNode();
  await mongoRepo.deleteOne("nodes", {});

  const result = await addNode({ floor: 0, x: 30, y: 40, connectFrom: firstId });

  assert.equal(result.error.code, "NODE_NOT_FOUND");
  assert.equal(mongoRepo.all("nodes").length, 0);
});

test("a point can't be connected to a point of another building", async () => {
  const firstId = await saveNode({ buildingId: OTHER_BUILDING_ID });

  const result = await addNode({ floor: 0, x: 30, y: 40, connectFrom: firstId });

  assert.equal(result.error.code, "NODE_NOT_FOUND");
  assert.equal(mongoRepo.all("nodes").length, 1);
  assert.equal(mongoRepo.all("edges").length, 0);
});

// ---------- Points ----------

test("a point in a building that does not exist is refused", async () => {
  const result = await addNode({ floor: 0, x: 10, y: 20 }, OTHER_BUILDING_ID);

  assert.equal(result.error.code, "BUILDING_NOT_FOUND");
  assert.equal(mongoRepo.all("nodes").length, 0);
});

test("stairs and elevators need a connector id", async () => {
  const stairs = await addNode({ floor: 0, x: 10, y: 20, type: "stairs" });
  const elevator = await addNode({ floor: 0, x: 10, y: 20, type: "elevator" });

  assert.equal(stairs.error.code, "CONNECTOR_REQUIRED");
  assert.equal(elevator.error.code, "CONNECTOR_REQUIRED");
  assert.equal(mongoRepo.all("nodes").length, 0);
});

test("an elevator is saved with its connector id and its name", async () => {
  const result = await addNode({ floor: 0, x: 10, y: 20, type: "elevator", connectorId: "elevator-main", label: "Main" });

  assert.equal(result.status, 201);
  assert.deepEqual(
    { type: result.body.type, connectorId: result.body.connectorId, label: result.body.label },
    { type: "elevator", connectorId: "elevator-main", label: "Main" },
  );
});

test("a corridor can't become an elevator without a connector id", async () => {
  const nodeId = await saveNode();

  const result = await changeNode(nodeId, { type: "elevator" });

  assert.equal(result.error.code, "CONNECTOR_REQUIRED");
  assert.equal(findById("nodes", nodeId).type, "corridor");
});

test("a corridor becomes an elevator when the connector id comes with it", async () => {
  const nodeId = await saveNode();

  const result = await changeNode(nodeId, { type: "elevator", connectorId: "elevator-main" });

  assert.equal(result.error, null);
  assert.equal(result.body.type, "elevator");
  assert.equal(findById("nodes", nodeId).connectorId, "elevator-main");
});

test("an elevator can't lose its connector id", async () => {
  const nodeId = await saveNode({ type: "elevator", connectorId: "elevator-main" });

  const result = await changeNode(nodeId, { connectorId: "" });

  assert.equal(result.error.code, "CONNECTOR_REQUIRED");
  assert.equal(findById("nodes", nodeId).connectorId, "elevator-main");
});

test("an elevator that becomes a corridor gives up its connector id", async () => {
  const nodeId = await saveNode({ type: "elevator", connectorId: "elevator-main" });

  const result = await changeNode(nodeId, { type: "corridor", connectorId: "" });

  assert.equal(result.body.connectorId, null);
  assert.equal("connectorId" in findById("nodes", nodeId), false);
});

test("an empty name removes the name", async () => {
  const nodeId = await saveNode({ type: "qr", label: "North entrance" });

  const result = await changeNode(nodeId, { label: "" });

  assert.equal(result.body.label, "");
  assert.equal("label" in findById("nodes", nodeId), false);
});

test("moving a point fixes the length of all its walkways", async () => {
  const a = await saveNode({ x: 0, y: 0 });
  const b = await saveNode({ x: 100, y: 0 });
  const c = await saveNode({ x: 100, y: 100 });
  const ab = await saveEdge(a, b, { length: 100 });
  const bc = await saveEdge(b, c, { length: 100 });

  const result = await changeNode(b, { x: 0, y: 100 });

  assert.deepEqual([result.body.x, result.body.y], [0, 100]);
  assert.equal(findById("edges", ab).length, 100);
  assert.equal(findById("edges", bc).length, 100);

  await changeNode(b, { x: 30, y: 40 });
  assert.equal(findById("edges", ab).length, 50);
  assert.equal(findById("edges", bc).length, 92.2);
});

test("a point of another building can't be changed or deleted", async () => {
  const nodeId = await saveNode({ buildingId: OTHER_BUILDING_ID });

  const changed = await changeNode(nodeId, { x: 500 });
  const deleted = await removeNode(nodeId);

  assert.equal(changed.error.code, "NODE_NOT_FOUND");
  assert.equal(deleted.error.code, "NODE_NOT_FOUND");
  assert.equal(findById("nodes", nodeId).x, 0);
});

test("an id that is not a real id is answered with 'not found'", async () => {
  const changed = await changeNode("abc", { x: 500 });
  const deleted = await removeNode("abc");

  assert.equal(changed.error.status, 404);
  assert.equal(deleted.error.status, 404);
});

test("deleting a point deletes its walkways, and only them", async () => {
  const a = await saveNode();
  const b = await saveNode();
  const c = await saveNode();
  await saveEdge(a, b);
  await saveEdge(c, b);
  const ac = await saveEdge(a, c);

  const result = await removeNode(b);

  assert.equal(result.status, 204);
  assert.equal(mongoRepo.all("nodes").length, 2);
  assert.deepEqual(mongoRepo.all("edges").map((edge) => String(edge._id)), [ac]);
});

test("the entrance of a place can't be deleted in the editor", async () => {
  const entranceId = await saveNode({ type: "entrance" });
  const corridorId = await saveNode();
  await saveEdge(entranceId, corridorId);
  await mongoRepo.insertOne("places", { buildingId: BUILDING_ID, name: "Sea Fashion", entryNodeId: entranceId });

  const result = await removeNode(entranceId);

  assert.equal(result.error.code, "NODE_IN_USE");
  assert.match(result.error.message, /Sea Fashion/);
  assert.equal(mongoRepo.all("nodes").length, 2);
  assert.equal(mongoRepo.all("edges").length, 1);
});

// ---------- Walkways ----------

test("a walkway gets the straight-line length between its points, 2 digits after the point", async () => {
  const a = await saveNode({ x: 0, y: 0 });
  const b = await saveNode({ x: 1, y: 1 });

  const result = await connect(a, b);

  assert.equal(result.status, 201);
  assert.deepEqual(
    { from: result.body.from, to: result.body.to, length: result.body.length, blocked: result.body.blocked },
    { from: a, to: b, length: 1.41, blocked: false },
  );
  assert.equal(mongoRepo.all("edges")[0].buildingId, BUILDING_ID);
});

test("a point can't be connected to itself", async () => {
  const a = await saveNode();

  const result = await connect(a, a);

  assert.equal(result.error.code, "SAME_NODE");
  assert.equal(mongoRepo.all("edges").length, 0);
});

test("points on different floors can't be connected with a walkway", async () => {
  const a = await saveNode({ floor: 0 });
  const b = await saveNode({ floor: 1 });

  const result = await connect(a, b);

  assert.equal(result.error.code, "DIFFERENT_FLOORS");
  assert.equal(mongoRepo.all("edges").length, 0);
});

test("two points are connected only once, in either direction", async () => {
  const a = await saveNode();
  const b = await saveNode({ x: 10 });
  await connect(a, b);

  const sameDirection = await connect(a, b);
  const otherDirection = await connect(b, a);

  assert.equal(sameDirection.error.code, "EDGE_EXISTS");
  assert.equal(otherDirection.error.code, "EDGE_EXISTS");
  assert.equal(mongoRepo.all("edges").length, 1);
});

test("a walkway can't reach a point that is missing or belongs to another building", async () => {
  const a = await saveNode();
  const foreign = await saveNode({ buildingId: OTHER_BUILDING_ID });

  const toMissing = await connect(a, MISSING_ID);
  const toForeign = await connect(a, foreign);

  assert.equal(toMissing.error.code, "NODE_NOT_FOUND");
  assert.equal(toForeign.error.code, "NODE_NOT_FOUND");
  assert.equal(mongoRepo.all("edges").length, 0);
});

test("a walkway is blocked and opened again", async () => {
  const a = await saveNode();
  const b = await saveNode();
  const edgeId = await saveEdge(a, b);

  const blocked = await setBlocked(edgeId, true);
  assert.equal(blocked.body.blocked, true);
  assert.equal(findById("edges", edgeId).blocked, true);

  const opened = await setBlocked(edgeId, false);
  assert.equal(opened.body.blocked, false);
  assert.equal(findById("edges", edgeId).blocked, false);
});

test("a walkway of another building can't be blocked or deleted", async () => {
  const edgeId = await saveEdge(MISSING_ID, MISSING_ID, { buildingId: OTHER_BUILDING_ID });

  const blocked = await setBlocked(edgeId, true);
  const deleted = await removeEdge(edgeId);

  assert.equal(blocked.error.code, "EDGE_NOT_FOUND");
  assert.equal(deleted.error.code, "EDGE_NOT_FOUND");
  assert.equal(findById("edges", edgeId).blocked, false);
});

test("deleting a walkway keeps its points", async () => {
  const a = await saveNode();
  const b = await saveNode();
  const edgeId = await saveEdge(a, b);

  const result = await removeEdge(edgeId);

  assert.equal(result.status, 204);
  assert.equal(mongoRepo.all("edges").length, 0);
  assert.equal(mongoRepo.all("nodes").length, 2);
});

test("a walkway that is not there is answered with 'not found'", async () => {
  const missing = await removeEdge(MISSING_ID);
  const notAnId = await setBlocked("abc", true);

  assert.equal(missing.error.code, "EDGE_NOT_FOUND");
  assert.equal(notAnId.error.code, "EDGE_NOT_FOUND");
});

// ---------- Reading the graph ----------

test("one floor: its points, and only the walkways between them", async () => {
  const a = await saveNode({ floor: 0 });
  const b = await saveNode({ floor: 0 });
  const upstairs1 = await saveNode({ floor: 1 });
  const upstairs2 = await saveNode({ floor: 1 });
  const foreign = await saveNode({ buildingId: OTHER_BUILDING_ID });

  const ab = await saveEdge(a, b);
  await saveEdge(upstairs1, upstairs2);
  await saveEdge(a, MISSING_ID); // a walkway whose point was deleted
  await saveEdge(foreign, foreign, { buildingId: OTHER_BUILDING_ID });

  const result = await loadGraph(0);

  assert.deepEqual(result.body.nodes.map((node) => node.id).sort(), [a, b].sort());
  assert.deepEqual(result.body.edges.map((edge) => edge.id), [ab]);
});

test("without a floor: every point and walkway of the building, and of this building only", async () => {
  const a = await saveNode({ floor: 0 });
  const b = await saveNode({ floor: 1 });
  await saveNode({ buildingId: OTHER_BUILDING_ID });
  await saveEdge(a, b);

  const result = await loadGraph(undefined);

  assert.equal(result.body.nodes.length, 2);
  assert.equal(result.body.edges.length, 1);
});

test("old data: a point without a name or a connector, a walkway without 'blocked'", async () => {
  const a = String(await mongoRepo.insertOne("nodes", { buildingId: BUILDING_ID, floor: 0, x: 1, y: 2, type: "corridor" }));
  const b = String(await mongoRepo.insertOne("nodes", { buildingId: BUILDING_ID, floor: 0, x: 3, y: 4, type: "qr", label: null, connectorId: null }));
  await mongoRepo.insertOne("edges", { buildingId: BUILDING_ID, from: a, to: b, length: 2.83 });

  const result = await loadGraph(0);

  assert.deepEqual(
    result.body.nodes.map((node) => [node.label, node.connectorId]),
    [["", null], ["", null]],
  );
  assert.equal(result.body.edges[0].blocked, false);
});
