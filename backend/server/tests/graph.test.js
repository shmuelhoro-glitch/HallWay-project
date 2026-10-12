import { beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_ID, callController, useFakeRepos } from "./helpers.js";

// Draw mode: every click adds a point and a walkway to the point before it.
// These tests check that the two are saved together, or not at all.

const { mongoRepo } = useFakeRepos();

const { createNode } = await import("../controllers/graph.controller.js");

const OTHER_BUILDING_ID = "22222222-2222-4222-8222-222222222222";

function addNode(body) {
  return callController(createNode, { params: { buildingId: BUILDING_ID }, body: { type: "corridor", ...body } });
}

// The first point of a line, already saved
async function createFirstPoint(node = {}) {
  const id = await mongoRepo.insertOne("nodes", { buildingId: BUILDING_ID, floor: 0, x: 0, y: 0, type: "corridor", ...node });
  return String(id);
}

beforeEach(() => {
  mongoRepo.reset();
  mock.method(console, "error", () => {});
});

test("a point without connectFrom is saved alone, like before", async () => {
  const result = await addNode({ floor: 0, x: 10, y: 20 });

  assert.equal(result.status, 201);
  assert.equal(result.body.edge, undefined);
  assert.equal(mongoRepo.all("nodes").length, 1);
  assert.equal(mongoRepo.all("edges").length, 0);
});

test("a point with connectFrom is saved with a walkway to the point before it", async () => {
  const firstId = await createFirstPoint();

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
  const firstId = await createFirstPoint();
  mongoRepo.failOn("insertOne", "edges");

  const result = await addNode({ floor: 0, x: 30, y: 40, connectFrom: firstId });

  assert.match(result.error.message, /Fake database failure/);
  assert.equal(mongoRepo.all("edges").length, 0);
  assert.deepEqual(mongoRepo.all("nodes").map((node) => String(node._id)), [firstId]);
});

test("a point can't be connected to a point on another floor, and nothing is saved", async () => {
  const firstId = await createFirstPoint({ floor: 1 });

  const result = await addNode({ floor: 0, x: 30, y: 40, connectFrom: firstId });

  assert.equal(result.error.code, "DIFFERENT_FLOORS");
  assert.equal(mongoRepo.all("nodes").length, 1);
  assert.equal(mongoRepo.all("edges").length, 0);
});

test("a point can't be connected to a point that was deleted, and nothing is saved", async () => {
  const firstId = await createFirstPoint();
  await mongoRepo.deleteOne("nodes", {});

  const result = await addNode({ floor: 0, x: 30, y: 40, connectFrom: firstId });

  assert.equal(result.error.code, "NODE_NOT_FOUND");
  assert.equal(mongoRepo.all("nodes").length, 0);
});

test("a point can't be connected to a point of another building", async () => {
  const firstId = await createFirstPoint({ buildingId: OTHER_BUILDING_ID });

  const result = await addNode({ floor: 0, x: 30, y: 40, connectFrom: firstId });

  assert.equal(result.error.code, "NODE_NOT_FOUND");
  assert.equal(mongoRepo.all("nodes").length, 1);
  assert.equal(mongoRepo.all("edges").length, 0);
});
