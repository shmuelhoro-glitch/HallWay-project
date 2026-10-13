// Adds a whole building from one file: details, floor plans, points, walkways and places.
// The file is described in services/buildingImport.service.js.
// Run from backend/server:
//
//   npm run import-building -- path/to/building.json            checks the file and shows what would be added.
//                                                                Changes nothing.
//   npm run import-building -- path/to/building.json --write    adds the building.
//
// It writes to the databases of .env. Run it without --write first, and read what it says.

import { readFileSync } from "node:fs";
import { db } from "../db/mongoConfig.js";
import { supabaseRepo } from "../repositories/sqlRepo.js";
import { importBuilding, prepareImport } from "../services/buildingImport.service.js";

const args = process.argv.slice(2);
const shouldWrite = args.includes("--write");
const filePath = args.find((arg) => !arg.startsWith("--"));

// A reason to stop that is told to whoever runs the script, without a stack trace
class Stop extends Error {}

function stop(message) {
  throw new Stop(message);
}

function countBy(docs, field) {
  const counts = new Map();
  for (const doc of docs) {
    counts.set(doc[field], (counts.get(doc[field]) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => `${count} ${value}`).join(", ");
}

async function main() {
  if (!filePath) {
    stop("Which file? npm run import-building -- path/to/building.json");
  }

  let file;
  try {
    file = JSON.parse(readFileSync(filePath, "utf8").replace(/^﻿/, ""));
  } catch (error) {
    stop(`Could not read ${filePath}: ${error.message}`);
  }

  // ---------- What is in the file ----------

  let prepared;
  try {
    prepared = prepareImport(file);
  } catch (error) {
    stop(`The file is not valid: ${error.message}`);
  }

  const { building, floors, nodes, edges, places, problems } = prepared;

  console.log(`\n${building.name} - ${building.address}, ${building.city} (${building.lat}, ${building.lng})`);
  console.log(`  alert area: ${building.alert_area}`);
  for (const floor of [...floors].sort((a, b) => a.floor - b.floor)) {
    const onFloor = (docs) => docs.filter((doc) => doc.floor === floor.floor).length;
    console.log(
      `  floor ${floor.floor} "${floor.name}": plan ${floor.width} x ${floor.height}, ${onFloor(nodes)} points, ${onFloor(places)} places`,
    );
  }
  console.log(`  ${nodes.length} points: ${countBy(nodes, "type")}`);
  console.log(`  ${edges.length} walkways`);
  console.log(`  ${places.length} places: ${countBy(places, "type")}`);

  // ---------- The same check the site runs on a building ----------

  const errors = problems.filter((problem) => problem.level === "error");
  const warnings = problems.filter((problem) => problem.level !== "error");
  console.log(`\nData check: ${errors.length} errors, ${warnings.length} warnings`);
  for (const [code, list] of Map.groupBy(problems, (problem) => `${problem.level.toUpperCase()} ${problem.code}`)) {
    const names = list.slice(0, 5).map((problem) => problem.name ?? problem.id).join(", ");
    console.log(`  ${code} x ${list.length}: ${names}${list.length > 5 ? ", ..." : ""}`);
  }

  const sameName = await supabaseRepo.findMany("buildings", { name: building.name });
  if (sameName.length > 0) {
    stop(`A building named "${building.name}" already exists (${sameName[0].id}). Delete it in the site first, or change the name in the file.`);
  }
  if (errors.length > 0) {
    stop("The data has errors, so it can't be added. Fix the file first.");
  }

  if (!shouldWrite) {
    console.log("\nNothing was changed. To add the building, run the same command with --write");
    return;
  }

  // ---------- Adding it ----------

  try {
    const result = await importBuilding(file);
    console.log(`\nAdded. The building id is ${result.building.id}`);
    console.log(`Open it in the site: /admin/${result.building.id}`);
  } catch (error) {
    stop(`The building was NOT added (what was saved on the way was deleted again): ${error.message ?? error}`);
  }
}

// mongoConfig keeps the connection open, so the script has to end it. The connection is closed and
// the process then ends by itself: process.exit() in the middle of that crashes on Windows
// ("Assertion failed ... async.c") - after the work is done, but it looks like a failure.
let exitCode = 0;
try {
  await main();
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  console.error(`\n${error.message}`);
  exitCode = 1;
} finally {
  await db.client.close().catch(() => {});
  process.exitCode = exitCode;
}
