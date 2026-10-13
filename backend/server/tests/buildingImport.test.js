import { beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { useFakeRepos } from "./helpers.js";

// A whole building from one file (scripts/import-building.js): everything is saved, or nothing.

const { mongoRepo, supabaseRepo, resetData } = useFakeRepos();

const { importBuilding, prepareImport } = await import("../services/buildingImport.service.js");

const PLAN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"></svg>';

// A tiny building: two floors, a walkway on each, an elevator between them, one store upstairs
function smallBuilding() {
  return {
    building: { name: "North Mall", type: "mall", address: "Main 1", city: "Haifa", alert_area: "Haifa", floors_count: 2, lat: 32.8, lng: 35 },
    floors: [
      { floor: 0, name: "Ground", svg: PLAN },
      { floor: 1, name: "First", svg: `<?xml version="1.0"?>${PLAN}` },
    ],
    nodes: [
      { key: "gate", floor: 0, x: 10, y: 10, type: "qr", label: "Main gate" },
      { key: "hall-0", floor: 0, x: 110, y: 10, type: "corridor" },
      { key: "lift-0", floor: 0, x: 110, y: 50, type: "elevator", connectorId: "lift" },
      { key: "lift-1", floor: 1, x: 110, y: 50, type: "elevator", connectorId: "lift" },
      { key: "hall-1", floor: 1, x: 110, y: 10, type: "corridor" },
      { key: "door", floor: 1, x: 200, y: 10, type: "entrance", label: "Sea Fashion" },
    ],
    edges: [
      { from: "gate", to: "hall-0" },
      { from: "hall-0", to: "lift-0" },
      { from: "lift-1", to: "hall-1" },
      { from: "hall-1", to: "door" },
    ],
    places: [{ floor: 1, name: "Sea Fashion", type: "store", category: "Fashion", x: 200, y: 10, hours: "09:00-21:00", node: "door" }],
  };
}

beforeEach(async () => {
  await resetData();
  mock.method(console, "error", () => {});
});

function savedCounts() {
  return ["floors", "nodes", "edges", "places"].map((collection) => mongoRepo.all(collection).length);
}

function assertRefused(change, message) {
  const file = smallBuilding();
  change(file);
  assert.throws(() => prepareImport(file), message);
}

test("a building from a file is saved whole: the row, the plans, the points, the walkways and the places", async () => {
  const { building } = await importBuilding(smallBuilding());

  const row = supabaseRepo.all("buildings").find((item) => item.id === building.id);
  assert.equal(row.name, "North Mall");
  assert.deepEqual([row.lat, row.lng, row.floors_count], [32.8, 35, 2]);

  assert.deepEqual(savedCounts(), [2, 6, 4, 1]);
  for (const collection of ["floors", "nodes", "edges", "places"]) {
    assert.ok(mongoRepo.all(collection).every((doc) => doc.buildingId === building.id), collection);
  }

  // The plan is saved from "<svg", with the size the map needs
  const upstairs = mongoRepo.all("floors").find((floor) => floor.floor === 1);
  assert.deepEqual([upstairs.name, upstairs.width, upstairs.height], ["First", 400, 300]);
  assert.ok(upstairs.svg.startsWith("<svg"));
});

test("the keys of the file become real ids: walkways and places point at the saved points", async () => {
  await importBuilding(smallBuilding());

  const nodes = mongoRepo.all("nodes");
  const idOf = (label) => String(nodes.find((node) => node.label === label)._id);
  const gateEdge = mongoRepo.all("edges").find((edge) => edge.from === idOf("Main gate"));

  assert.deepEqual([gateEdge.length, gateEdge.blocked], [100, false]);
  assert.equal(typeof gateEdge.to, "string");
  assert.ok(nodes.some((node) => String(node._id) === gateEdge.to));
  assert.ok(nodes.every((node) => !("key" in node)));

  const place = mongoRepo.all("places")[0];
  assert.equal(place.entryNodeId, idOf("Sea Fashion"));
  assert.deepEqual([place.hours, place.isLandmark, "url" in place], ["09:00-21:00", false, false]);

  const lift = nodes.find((node) => node.type === "elevator");
  assert.equal(lift.connectorId, "lift");
});

test("a wrong file is refused before anything is read from it into the databases", async () => {
  assertRefused((file) => (file.building.type = "castle"), /building is not valid/);
  assertRefused((file) => delete file.building.lat, /lat and lng/);
  assertRefused((file) => (file.floors[1].svg = "not a plan"), /not an SVG/);
  assertRefused((file) => file.nodes.push({ ...file.nodes[0] }), /twice/);
  assertRefused((file) => (file.nodes[1].floor = 7), /no plan in the file/);
  assertRefused((file) => delete file.nodes[2].connectorId, /without a connectorId/);
  assertRefused((file) => (file.nodes[1].connectorId = "lift"), /only stairs and elevators/);
  assertRefused((file) => file.edges.push({ from: "gate", to: "nowhere" }), /not in the file/);
  assertRefused((file) => file.edges.push({ from: "lift-0", to: "lift-1" }), /two floors/);
  assertRefused((file) => file.edges.push({ from: "hall-0", to: "gate" }), /twice/);
  assertRefused((file) => (file.places[0].node = "hall-1"), /type entrance/);
  assertRefused((file) => (file.places[0].floor = 0), /different floors/);
  assertRefused((file) => (file.places[0].category = ""), /not valid/);

  const file = smallBuilding();
  file.edges.push({ from: "gate", to: "nowhere" });
  await assert.rejects(importBuilding(file));
  assert.equal(supabaseRepo.all("buildings").length, 1); // only the one of every test
  assert.deepEqual(savedCounts(), [0, 0, 0, 0]);
});

test("the data check runs on the file, and what it finds comes back", async () => {
  const outside = smallBuilding();
  outside.nodes[1].x = 9000;
  assert.ok(prepareImport(outside).problems.some((problem) => problem.code === "OUTSIDE_THE_PLAN"));

  assert.deepEqual(prepareImport(smallBuilding()).problems.filter((problem) => problem.level === "error"), []);
});

test("a building with the same name is not added again", async () => {
  await importBuilding(smallBuilding());

  await assert.rejects(importBuilding(smallBuilding()), /already exists/);

  assert.equal(supabaseRepo.all("buildings").filter((building) => building.name === "North Mall").length, 1);
  assert.deepEqual(savedCounts(), [2, 6, 4, 1]);
});

test("when a step fails in the middle, nothing of the new building stays", async () => {
  await mongoRepo.insertOne("nodes", { buildingId: "another-building", floor: 0, x: 1, y: 1, type: "corridor" });
  mongoRepo.failOn("insertMany", "edges");

  await assert.rejects(importBuilding(smallBuilding()), /Fake database failure/);

  assert.deepEqual(supabaseRepo.all("buildings").map((building) => building.name), ["Sea Mall"]);
  assert.deepEqual(savedCounts(), [0, 1, 0, 0]); // the point of the other building is still there
});
