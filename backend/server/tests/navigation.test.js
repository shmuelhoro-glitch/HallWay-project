import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_ID, callController, useFakeRepos } from "./helpers.js";

const { mongoRepo, supabaseRepo, resetData } = useFakeRepos();

let lastRoutingCall = null;
mock.module(new URL("../services/routingClient.js", import.meta.url).href, {
  exports: {
    callRoutingService: async (endpoint, data) => {
      lastRoutingCall = { endpoint, data };
      return { path: [{ id: "n1", floor: 0, x: 0, y: 0 }], length: 10 };
    },
  },
});

const { getRoute, getNearestShelter } = await import("../controllers/navigation.controller.js");

test("getRoute passes accessible: true to routing service when requested", async () => {
  lastRoutingCall = null;
  const res = await callController(getRoute, {
    body: {
      buildingId: BUILDING_ID,
      fromNodeId: "660100000000000000000001",
      toNodeId: "660100000000000000000002",
      accessible: true,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(lastRoutingCall.endpoint, "/route");
  assert.equal(lastRoutingCall.data.accessible, true);
});

test("getRoute passes accessible: false when not specified", async () => {
  lastRoutingCall = null;
  const res = await callController(getRoute, {
    body: {
      buildingId: BUILDING_ID,
      fromNodeId: "660100000000000000000001",
      toNodeId: "660100000000000000000002",
    },
  });

  assert.equal(res.status, 200);
  assert.equal(lastRoutingCall.endpoint, "/route");
  assert.equal(lastRoutingCall.data.accessible, false);
});

test("getRoute with toPlaceId resolves entryNodeId and forwards accessible", async () => {
  await resetData();
  const placeId = "660200000000000000000001";
  const entryNodeId = "660100000000000000000099";
  await mongoRepo.insertOne("places", {
    _id: placeId,
    buildingId: BUILDING_ID,
    name: "Target Place",
    entryNodeId,
  });

  lastRoutingCall = null;
  const res = await callController(getRoute, {
    body: {
      buildingId: BUILDING_ID,
      fromNodeId: "660100000000000000000001",
      toPlaceId: placeId,
      accessible: true,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(lastRoutingCall.endpoint, "/route");
  assert.equal(lastRoutingCall.data.toNodeId, entryNodeId);
  assert.equal(lastRoutingCall.data.accessible, true);
});

test("getNearestShelter passes accessible: true to routing service when requested", async () => {
  lastRoutingCall = null;
  const res = await callController(getNearestShelter, {
    body: {
      buildingId: BUILDING_ID,
      fromNodeId: "660100000000000000000001",
      accessible: true,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(lastRoutingCall.endpoint, "/nearest-shelter");
  assert.equal(lastRoutingCall.data.accessible, true);
});

test("getNearestShelter passes accessible: false when not specified", async () => {
  lastRoutingCall = null;
  const res = await callController(getNearestShelter, {
    body: {
      buildingId: BUILDING_ID,
      fromNodeId: "660100000000000000000001",
    },
  });

  assert.equal(res.status, 200);
  assert.equal(lastRoutingCall.endpoint, "/nearest-shelter");
  assert.equal(lastRoutingCall.data.accessible, false);
});
