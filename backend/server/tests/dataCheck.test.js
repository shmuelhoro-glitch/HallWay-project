import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { findBuildingProblems, findUserProblems } from "../services/dataCheck.service.js";
import { readSvgSize } from "../services/buildings.service.js";

// The check that looks for broken data. It is pure, so no database (and no fake one) is needed.

// A small building with nothing wrong in it:
//   floor 0:  store entrance (S) ---- corridor (C0) ---- elevator (E0)
//   floor 1:  elevator (E1) ---- corridor (C1)
function healthyBuilding() {
  return {
    floors: [
      { floor: 0, width: 640, height: 1000 },
      { floor: 1, width: 640, height: 1000 },
    ],
    nodes: [
      { _id: "S", floor: 0, x: 100, y: 100, type: "entrance", label: "Sea Fashion" },
      { _id: "C0", floor: 0, x: 200, y: 100, type: "corridor" },
      { _id: "E0", floor: 0, x: 300, y: 100, type: "elevator", connectorId: "elevator-main" },
      { _id: "E1", floor: 1, x: 300, y: 100, type: "elevator", connectorId: "elevator-main" },
      { _id: "C1", floor: 1, x: 400, y: 100, type: "corridor" },
    ],
    edges: [
      { _id: "S-C0", from: "S", to: "C0" },
      { _id: "C0-E0", from: "C0", to: "E0" },
      { _id: "E1-C1", from: "E1", to: "C1" },
    ],
    places: [{ _id: "P", floor: 0, x: 80, y: 100, name: "Sea Fashion", entryNodeId: "S" }],
  };
}

// The codes of the problems, with what each one is about: ["CODE node X", ...]
function found(building) {
  return findBuildingProblems(building).map((problem) => `${problem.code} ${problem.kind} ${problem.id}`);
}

function levelOf(building, code) {
  return findBuildingProblems(building).find((problem) => problem.code === code)?.level;
}

test("a healthy building has no problems", () => {
  assert.deepEqual(found(healthyBuilding()), []);
});

test("the demo building (Sea Mall) has no problems", async () => {
  const file = new URL("../scripts/seed-data/sea-mall.json", import.meta.url);
  const demo = JSON.parse(await readFile(file, "utf8"));
  const withId = (doc) => ({ ...doc, _id: doc.id });

  const problems = findBuildingProblems({
    floors: demo.floors.map((floor) => ({ floor: floor.floor, ...readSvgSize(floor.svg) })),
    nodes: demo.nodes.map(withId),
    edges: demo.edges.map(withId),
    places: demo.places.map(withId),
  });

  assert.deepEqual(problems, []);
});

// ---------- Points ----------

test("a point that the old draw mode left without a walkway", () => {
  const building = healthyBuilding();
  building.nodes.push({ _id: "ALONE", floor: 0, x: 50, y: 50, type: "corridor" });

  assert.deepEqual(found(building), ["POINT_NOT_CONNECTED node ALONE"]);
  assert.equal(levelOf(building, "POINT_NOT_CONNECTED"), "warning");
});

test("an entrance whose place was never saved", () => {
  const building = healthyBuilding();
  building.nodes.push({ _id: "GHOST", floor: 0, x: 50, y: 50, type: "entrance", label: "Ghost" });
  building.edges.push({ _id: "GHOST-C0", from: "GHOST", to: "C0" });

  assert.deepEqual(found(building), ["ENTRANCE_WITHOUT_PLACE node GHOST"]);
});

test("a point without coordinates, on a floor without a plan, or outside the plan", () => {
  const building = healthyBuilding();
  building.nodes[1].x = null; // C0
  building.nodes[4].floor = 7; // C1
  building.nodes[2].x = 5000; // E0

  const problems = found(building);

  assert.ok(problems.includes("BAD_COORDINATES node C0"));
  assert.ok(problems.includes("FLOOR_WITHOUT_PLAN node C1"));
  assert.ok(problems.includes("OUTSIDE_THE_PLAN node E0"));
});

// ---------- Stairs and elevators ----------

test("an elevator without a connector id", () => {
  const building = healthyBuilding();
  delete building.nodes[2].connectorId; // E0

  const problems = found(building);

  assert.ok(problems.includes("CONNECTOR_ID_MISSING node E0"));
  assert.equal(levelOf(building, "CONNECTOR_ID_MISSING"), "error");
  // And now the elevator of floor 1 is alone
  assert.ok(problems.includes("CONNECTOR_ON_ONE_FLOOR node E1"));
});

test("a corridor that kept the connector id of an elevator", () => {
  const building = healthyBuilding();
  building.nodes[1].connectorId = "elevator-main"; // C0

  const problems = found(building);

  assert.ok(problems.includes("CONNECTOR_ID_ON_OTHER_TYPE node C0"));
  assert.ok(problems.includes("CONNECTOR_TWICE_ON_A_FLOOR node E0"));
});

// ---------- Walkways ----------

test("a walkway to a deleted point, to itself, and the same walkway twice", () => {
  const building = healthyBuilding();
  building.edges.push({ _id: "TO-DELETED", from: "C0", to: "DELETED" });
  building.edges.push({ _id: "LOOP", from: "C0", to: "C0" });
  building.edges.push({ _id: "AGAIN", from: "C0", to: "S" });

  assert.deepEqual(found(building), [
    "WALKWAY_TO_MISSING_POINT edge TO-DELETED",
    "WALKWAY_TO_ITSELF edge LOOP",
    "WALKWAY_TWICE edge AGAIN",
  ]);
});

test("a walkway between two floors is an error: routes would jump between floors", () => {
  const building = healthyBuilding();
  building.edges.push({ _id: "JUMP", from: "C0", to: "C1" });

  assert.deepEqual(found(building), ["WALKWAY_BETWEEN_FLOORS edge JUMP"]);
  assert.equal(levelOf(building, "WALKWAY_BETWEEN_FLOORS"), "error");
});

test("a walkway that saves its points as ObjectId is never loaded", () => {
  const building = healthyBuilding();
  building.edges[2] = { _id: "E1-C1", from: { toString: () => "E1" }, to: "C1" };

  const problems = found(building);

  assert.ok(problems.includes("WALKWAY_IDS_NOT_TEXT edge E1-C1"));
});

// ---------- Places ----------

test("a place without an entrance, or with an entrance that was deleted", () => {
  const building = healthyBuilding();
  building.places.push({ _id: "OLD", floor: 0, x: 10, y: 10, name: "Old Store" });
  building.places.push({ _id: "LOST", floor: 0, x: 10, y: 10, name: "Lost Store", entryNodeId: "DELETED" });

  assert.deepEqual(found(building), ["PLACE_WITHOUT_ENTRANCE place OLD", "PLACE_ENTRANCE_MISSING place LOST"]);
  assert.equal(levelOf(building, "PLACE_WITHOUT_ENTRANCE"), "error");
});

test("a place whose entrance stayed on another floor", () => {
  const building = healthyBuilding();
  building.places[0].floor = 1;

  assert.deepEqual(found(building), ["PLACE_ENTRANCE_ON_OTHER_FLOOR place P"]);
});

test("a place whose entrance has no walkway", () => {
  const building = healthyBuilding();
  building.edges.shift(); // S - C0

  assert.deepEqual(found(building), ["PLACE_NOT_CONNECTED place P"]);
  assert.equal(levelOf(building, "PLACE_NOT_CONNECTED"), "error");
});

test("the entrance and the place may be in different spots - that is not a problem", () => {
  const building = healthyBuilding();
  building.places[0].x = 20;
  building.places[0].y = 300;

  assert.deepEqual(found(building), []);
});

test("two places with the same entrance, and an entrance that is not an entrance point", () => {
  const building = healthyBuilding();
  building.places.push({ _id: "P2", floor: 0, x: 90, y: 100, name: "Sea Shoes", entryNodeId: "S" });
  building.places.push({ _id: "P3", floor: 0, x: 200, y: 90, name: "Kiosk", entryNodeId: "C0" });

  assert.deepEqual(found(building), [
    "PLACE_ENTRANCE_SHARED place P",
    "PLACE_ENTRANCE_SHARED place P2",
    "PLACE_ENTRANCE_WRONG_TYPE place P3",
  ]);
});

// ---------- Can a visitor get there? ----------

test("a place on an island of walkways, apart from the building, can't be reached", () => {
  const building = healthyBuilding();
  building.nodes.push({ _id: "S2", floor: 0, x: 500, y: 500, type: "entrance", label: "Far Store" });
  building.nodes.push({ _id: "C9", floor: 0, x: 550, y: 500, type: "corridor" });
  building.edges.push({ _id: "S2-C9", from: "S2", to: "C9" });
  building.places.push({ _id: "P2", floor: 0, x: 500, y: 500, name: "Far Store", entryNodeId: "S2" });

  assert.deepEqual(found(building), ["PLACE_UNREACHABLE place P2"]);
  assert.equal(levelOf(building, "PLACE_UNREACHABLE"), "error");
});

test("a place behind a blocked walkway is reported as blocked, not as never connected", () => {
  const building = healthyBuilding();
  building.edges[0].blocked = true; // S - C0, the only way to the store

  assert.deepEqual(found(building), ["PLACE_BLOCKED place P"]);
});

test("a floor whose elevator has another id is not connected, and so are its QR points", () => {
  const building = healthyBuilding();
  building.nodes[3].connectorId = "elevator-b"; // E1
  building.nodes[4].type = "qr"; // C1

  const problems = found(building);

  assert.ok(problems.includes("FLOOR_NOT_CONNECTED floor 1"));
  assert.ok(problems.includes("QR_UNREACHABLE node C1"));
});

test("a problem carries the name the admin knows the thing by", () => {
  const building = healthyBuilding();
  building.edges.shift(); // S - C0

  assert.equal(findBuildingProblems(building)[0].name, "Sea Fashion");
});

// ---------- Users ----------

const BUILDINGS = [
  { id: "b1", name: "Sea Mall" },
  { id: "b2", name: "North Mall" },
];

function userCodes(users) {
  return findUserProblems(users, BUILDINGS).map((problem) => `${problem.code} ${problem.id}`);
}

test("every building has an admin, and nobody has a problem", () => {
  const users = [
    { id: "u1", username: "owner", role: "super", buildingIds: [] },
    { id: "u2", username: "sea_admin", role: "admin", buildingIds: ["b1"] },
    { id: "u3", username: "north_admin", role: "admin", buildingIds: ["b2"] },
    { id: "u4", username: "dana", role: "visitor", buildingIds: [] },
  ];

  assert.deepEqual(userCodes(users), []);
});

test("an admin who would be locked out, and a building only a super can change", () => {
  const users = [
    { id: "u1", username: "sea_admin", role: "admin", buildingIds: ["b1"] },
    { id: "u2", username: "new_admin", role: "admin", buildingIds: [] },
    { id: "u3", username: "old_admin", role: "admin", buildingIds: null },
  ];

  assert.deepEqual(userCodes(users), [
    "ADMIN_WITHOUT_BUILDINGS u2",
    "ADMIN_WITHOUT_BUILDINGS u3",
    "BUILDING_WITHOUT_ADMIN b2",
  ]);
});

test("a role we don't know, a building that is gone, and a visitor with buildings", () => {
  const users = [
    { id: "u1", username: "sea_admin", role: "admin", buildingIds: ["b1", "b2", "deleted"] },
    { id: "u2", username: "boss", role: "owner", buildingIds: [] },
    { id: "u3", username: "dana", role: "visitor", buildingIds: ["b1"] },
  ];

  assert.deepEqual(userCodes(users), ["UNKNOWN_BUILDING u1", "UNKNOWN_ROLE u2", "VISITOR_WITH_BUILDINGS u3"]);
});
