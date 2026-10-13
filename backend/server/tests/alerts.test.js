import { beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_ID, callController, useFakeRepos } from "./helpers.js";

const { supabaseRepo, resetData } = useFakeRepos();

let broadcastEvents = [];
mock.module(new URL("../sockets/chat.socket.js", import.meta.url).href, {
  exports: {
    broadcastToBuilding: (buildingId, event, payload) => {
      broadcastEvents.push({ buildingId, event, payload });
    },
    setupChatSocket: () => {},
  },
});

const {
  triggerBuildingAlert,
  endBuildingAlert,
  getActiveAlertForBuilding,
  resetAlertsState,
} = await import("../services/alerts.service.js");

const {
  simulateAlert,
  stopAlert,
  getActiveAlert,
  getAlertAreas,
} = await import("../controllers/alerts.controller.js");

beforeEach(async () => {
  await resetData();
  resetAlertsState();
  broadcastEvents = [];
  mock.method(console, "error", () => {});
  mock.method(console, "log", () => {});
});

test("simulateAlert creates alert record and broadcasts alert:start", async () => {
  const res = await callController(simulateAlert, {
    body: {
      buildingId: BUILDING_ID,
      title: "ירי רקטות וטילים",
      category: "rockets",
      countdown: 45,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.alert.countdown, 45);
  assert.equal(res.body.alert.isSimulation, true);

  // Broadcast event verified
  assert.equal(broadcastEvents.length, 1);
  assert.equal(broadcastEvents[0].buildingId, BUILDING_ID);
  assert.equal(broadcastEvents[0].event, "alert:start");
  assert.equal(broadcastEvents[0].payload.countdown, 45);

  // In-memory active alert verified
  const active = getActiveAlertForBuilding(BUILDING_ID);
  assert.ok(active);
  assert.equal(active.title, "ירי רקטות וטילים");

  // Supabase record created
  const dbAlerts = await supabaseRepo.findMany("alerts", { building_id: BUILDING_ID });
  assert.equal(dbAlerts.length, 1);
  assert.equal(dbAlerts[0].is_simulation, true);
});

test("simulateAlert returns 404 for unknown building", async () => {
  const nonExistentId = "99999999-9999-9999-9999-999999999999";
  const res = await callController(simulateAlert, {
    body: {
      buildingId: nonExistentId,
      countdown: 30,
    },
  });

  assert.ok(res.error);
  assert.equal(res.error.status, 404);
  assert.equal(res.error.code, "BUILDING_NOT_FOUND");
});

test("stopAlert ends active alert and broadcasts alert:end", async () => {
  await triggerBuildingAlert({
    buildingId: BUILDING_ID,
    countdown: 60,
    isSimulation: true,
  });

  broadcastEvents = [];

  const res = await callController(stopAlert, {
    body: { buildingId: BUILDING_ID },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  // Broadcast alert:end verified
  assert.equal(broadcastEvents.length, 1);
  assert.equal(broadcastEvents[0].event, "alert:end");

  // In-memory active alert is cleared
  assert.equal(getActiveAlertForBuilding(BUILDING_ID), null);

  // Ended_at is saved in DB
  const dbAlerts = await supabaseRepo.findMany("alerts", { building_id: BUILDING_ID });
  assert.equal(dbAlerts.length, 1);
  assert.ok(dbAlerts[0].ended_at);
});

test("getActiveAlert returns active alert countdown and status", async () => {
  await triggerBuildingAlert({
    buildingId: BUILDING_ID,
    title: "ירי רקטות וטילים",
    category: "rockets",
    countdown: 60,
    isSimulation: true,
  });

  const res = await callController(getActiveAlert, {
    params: { buildingId: BUILDING_ID },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.active, true);
  assert.equal(res.body.alert.title, "ירי רקטות וטילים");
  assert.ok(res.body.alert.countdown <= 60);
});

test("getActiveAlert returns active: false when no alert is active", async () => {
  const res = await callController(getActiveAlert, {
    params: { buildingId: BUILDING_ID },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.active, false);
  assert.equal(res.body.alert, null);
});

test("getAlertAreas returns areas from registered buildings", async () => {
  await supabaseRepo.updateOne("buildings", { id: BUILDING_ID }, { city: "אשדוד", alert_area: "אשדוד - אזור תעשייה" });

  const res = await callController(getAlertAreas, {});
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.areas));
  assert.ok(res.body.areas.includes("אשדוד - אזור תעשייה"));
});
