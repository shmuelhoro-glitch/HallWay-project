import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { BUILDING_ID, useFakeRepos } from "./helpers.js";

// Runs scripts/check-data.js itself, on fake databases: it must print a report, and it must only read.

const { mongoRepo, supabaseRepo, resetData } = useFakeRepos();

// The script reads the floors straight from the driver (without the heavy plan), so that is faked too
mock.module(new URL("../db/mongoConfig.js", import.meta.url).href, {
  namedExports: {
    db: {
      collection: (name) => ({
        find: () => ({ toArray: async () => mongoRepo.all(name) }),
      }),
    },
  },
});

const WRITE_METHODS = ["insertOne", "updateOne", "deleteOne", "deleteMany"];

test("the script reports the problems of every building, and changes nothing", async () => {
  await resetData();
  await supabaseRepo.updateOne("buildings", { id: BUILDING_ID }, { floors_count: 1 });
  await supabaseRepo.insertOne("users", { username: "sea_admin", role: "admin", buildingIds: [] });

  await mongoRepo.insertOne("floors", { buildingId: BUILDING_ID, floor: 0, width: 640, height: 1000 });
  const corridor = String(await mongoRepo.insertOne("nodes", { buildingId: BUILDING_ID, floor: 0, x: 10, y: 10, type: "corridor" }));
  await mongoRepo.insertOne("places", { buildingId: BUILDING_ID, floor: 0, x: 10, y: 10, name: "Old Store" });
  await mongoRepo.insertOne("nodes", { buildingId: "a-building-that-was-deleted", floor: 0, x: 1, y: 1, type: "corridor" });

  // From here on, every write is counted
  const writes = [];
  for (const repo of [mongoRepo, supabaseRepo]) {
    for (const method of WRITE_METHODS) {
      if (repo[method]) writes.push(mock.method(repo, method));
    }
  }

  const log = mock.method(console, "log", () => {});
  const exit = mock.method(process, "exit", () => {});

  await import("../scripts/check-data.js");

  const output = log.mock.calls.map((call) => call.arguments.join(" ")).join("\n");
  log.mock.restore();

  assert.match(output, /Sea Mall/);
  assert.match(output, /1 of 1 floor plans, 1 points, 0 walkways, 1 places/);
  assert.match(output, /ERROR\s+PLACE_WITHOUT_ENTRANCE \[floor 0\]: "Old Store"/);
  assert.match(output, new RegExp(`WARNING POINT_NOT_CONNECTED .*node ${corridor}`));
  assert.match(output, /1 nodes of a building that does not exist \(a-building-that-was-deleted\)/);
  assert.match(output, /ADMIN_WITHOUT_BUILDINGS: sea_admin/);
  assert.match(output, /BUILDING_WITHOUT_ADMIN: "Sea Mall"/);
  assert.match(output, /1 errors, 4 warnings in 1 buildings\. Nothing was changed\./);

  // Errors were found, so the script ends with code 1
  assert.deepEqual(exit.mock.calls[0].arguments, [1]);

  assert.equal(writes.reduce((sum, write) => sum + write.mock.callCount(), 0), 0);
});
