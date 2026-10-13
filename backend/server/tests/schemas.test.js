import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEdgeSchema,
  createNodeSchema,
  graphQuerySchema,
  updateEdgeSchema,
  updateNodeSchema,
} from "../schemas/graph.schemas.js";
import { createPlaceSchema, updatePlaceSchema } from "../schemas/places.schemas.js";
import { registerSchema } from "../schemas/auth.schemas.js";
import { routeSchema, shelterSchema } from "../schemas/navigation.schemas.js";

// What the server accepts from the client, before a controller runs.

const NODE_ID = "660100000000000000000001";

function isValid(schema, value) {
  return schema.safeParse(value).success;
}

// ---------- Points ----------

test("a new point is a corridor when no type is sent", () => {
  const node = createNodeSchema.body.parse({ floor: 0, x: 10, y: 20 });

  assert.equal(node.type, "corridor");
});

test("a new point needs a floor and numbers for x and y", () => {
  assert.equal(isValid(createNodeSchema.body, { x: 10, y: 20 }), false);
  assert.equal(isValid(createNodeSchema.body, { floor: 0, x: "10", y: 20 }), false);
  assert.equal(isValid(createNodeSchema.body, { floor: 0, x: 10 }), false);
  assert.equal(isValid(createNodeSchema.body, { floor: 1.5, x: 10, y: 20 }), false);
});

test("a basement is a floor below zero", () => {
  const node = createNodeSchema.body.parse({ floor: -2, x: 10, y: 20 });

  assert.equal(node.floor, -2);
});

test("only the known point types are accepted", () => {
  for (const type of ["corridor", "entrance", "stairs", "elevator", "qr"]) {
    assert.equal(isValid(createNodeSchema.body, { floor: 0, x: 1, y: 2, type }), true, type);
  }
  assert.equal(isValid(createNodeSchema.body, { floor: 0, x: 1, y: 2, type: "door" }), false);
});

test("connectFrom must look like a point id", () => {
  assert.equal(isValid(createNodeSchema.body, { floor: 0, x: 1, y: 2, connectFrom: NODE_ID }), true);
  assert.equal(isValid(createNodeSchema.body, { floor: 0, x: 1, y: 2, connectFrom: "abc" }), false);
});

test("a name is trimmed, and can't be longer than 60 characters", () => {
  const node = createNodeSchema.body.parse({ floor: 0, x: 1, y: 2, label: "  North entrance  " });

  assert.equal(node.label, "North entrance");
  assert.equal(isValid(createNodeSchema.body, { floor: 0, x: 1, y: 2, label: "a".repeat(61) }), false);
});

test("an update of a point may change one field, and never its floor", () => {
  assert.deepEqual(updateNodeSchema.body.parse({ x: 5 }), { x: 5 });
  assert.deepEqual(updateNodeSchema.body.parse({ label: "" }), { label: "" });
  // A floor that is sent is dropped: a point moves to another floor only with its place
  assert.deepEqual(updateNodeSchema.body.parse({ floor: 3, y: 7 }), { y: 7 });
});

// ---------- Walkways ----------

test("a walkway needs two point ids", () => {
  assert.equal(isValid(createEdgeSchema.body, { from: NODE_ID, to: NODE_ID }), true);
  assert.equal(isValid(createEdgeSchema.body, { from: NODE_ID }), false);
  assert.equal(isValid(createEdgeSchema.body, { from: NODE_ID, to: "12345" }), false);
});

test("'blocked' is true or false, not a text", () => {
  assert.equal(isValid(updateEdgeSchema.body, { blocked: true }), true);
  assert.equal(isValid(updateEdgeSchema.body, { blocked: "true" }), false);
  assert.equal(isValid(updateEdgeSchema.body, {}), false);
});

test("the floor in the address (?floor=-1) becomes a number, and may be left out", () => {
  assert.deepEqual(graphQuerySchema.query.parse({ floor: "-1" }), { floor: -1 });
  assert.deepEqual(graphQuerySchema.query.parse({}), {});
  assert.equal(isValid(graphQuerySchema.query, { floor: "ground" }), false);
});

// ---------- Places ----------

const NEW_PLACE = { floor: 0, name: "Sea Fashion", type: "store", category: "Fashion", x: 100, y: 100 };

test("a new place is not a landmark unless it says so", () => {
  const place = createPlaceSchema.body.parse(NEW_PLACE);

  assert.equal(place.isLandmark, false);
});

test("a new place needs a name, a category, a known type and a spot on the map", () => {
  assert.equal(isValid(createPlaceSchema.body, { ...NEW_PLACE, name: "   " }), false);
  assert.equal(isValid(createPlaceSchema.body, { ...NEW_PLACE, category: "" }), false);
  assert.equal(isValid(createPlaceSchema.body, { ...NEW_PLACE, type: "restaurant" }), false);
  assert.equal(isValid(createPlaceSchema.body, { ...NEW_PLACE, x: undefined }), false);
});

test("a link is a real link, or empty to remove it", () => {
  assert.equal(isValid(createPlaceSchema.body, { ...NEW_PLACE, url: "https://example.com/shop" }), true);
  assert.equal(isValid(createPlaceSchema.body, { ...NEW_PLACE, url: "" }), true);
  assert.equal(isValid(createPlaceSchema.body, { ...NEW_PLACE, url: "not a link" }), false);
});

test("an update of a place keeps only what was sent (no hidden 'isLandmark: false')", () => {
  assert.deepEqual(updatePlaceSchema.body.parse({ name: "Sea Shoes" }), { name: "Sea Shoes" });
});

// ---------- Sign up ----------

test("a role that is sent at sign up is dropped", () => {
  const body = registerSchema.body.parse({
    username: "dana_levi",
    email: "Dana@Example.com",
    password: "Demo12345",
    role: "admin",
  });

  assert.deepEqual(body, { username: "dana_levi", email: "dana@example.com", password: "Demo12345" });
});

// ---------- Navigation ----------

test("routeSchema accepts accessible boolean and defaults to false", () => {
  const parsedDefault = routeSchema.body.parse({
    buildingId: "123e4567-e89b-12d3-a456-426614174000",
    fromNodeId: NODE_ID,
    toNodeId: NODE_ID,
  });
  assert.equal(parsedDefault.accessible, false);

  const parsedExplicit = routeSchema.body.parse({
    buildingId: "123e4567-e89b-12d3-a456-426614174000",
    fromNodeId: NODE_ID,
    toNodeId: NODE_ID,
    accessible: true,
  });
  assert.equal(parsedExplicit.accessible, true);
});

test("shelterSchema accepts accessible boolean and defaults to false", () => {
  const parsedDefault = shelterSchema.body.parse({
    buildingId: "123e4567-e89b-12d3-a456-426614174000",
    fromNodeId: NODE_ID,
  });
  assert.equal(parsedDefault.accessible, false);

  const parsedExplicit = shelterSchema.body.parse({
    buildingId: "123e4567-e89b-12d3-a456-426614174000",
    fromNodeId: NODE_ID,
    accessible: true,
  });
  assert.equal(parsedExplicit.accessible, true);
});

