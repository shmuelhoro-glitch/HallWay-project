// Checks the data that is already in both databases, and prints what is broken.
// It ONLY READS (find / select). Nothing is changed, so it is safe on the real databases.
// Run from backend/server:
//   npm run check-data

import { db } from "../db/mongoConfig.js";
import { mongoRepo } from "../repositories/mongoRepo.js";
import { supabaseRepo } from "../repositories/sqlRepo.js";
import { findBuildingProblems, findUserProblems } from "../services/dataCheck.service.js";

const COLLECTIONS = ["floors", "nodes", "edges", "places"];

function groupByBuilding(docs) {
  const groups = new Map();
  for (const doc of docs) {
    const list = groups.get(doc.buildingId) ?? [];
    list.push(doc);
    groups.set(doc.buildingId, list);
  }
  return groups;
}

function printProblems(problems) {
  if (problems.length === 0) {
    console.log("  OK - nothing to fix");
    return;
  }

  // Errors first, and the same kind of problem together
  const sorted = [...problems].sort((a, b) => a.level.localeCompare(b.level) || a.code.localeCompare(b.code));
  for (const problem of sorted) {
    const where = problem.floor === null ? "" : ` [floor ${problem.floor}]`;
    console.log(`  ${problem.level.toUpperCase().padEnd(7)} ${problem.code}${where}: ${problem.message} (${problem.kind} ${problem.id})`);
  }
}

// ---------- Read everything once ----------

const buildings = await supabaseRepo.findMany("buildings");
const users = await supabaseRepo.findMany("users");

// The floors without the plan itself: a plan can be a few MB, and only its size is needed here
const floors = await db.collection("floors").find({}, { projection: { svg: 0 } }).toArray();
const nodes = await mongoRepo.findMany("nodes");
const edges = await mongoRepo.findMany("edges");
const places = await mongoRepo.findMany("places");

const data = {
  floors: groupByBuilding(floors),
  nodes: groupByBuilding(nodes),
  edges: groupByBuilding(edges),
  places: groupByBuilding(places),
};

let errorCount = 0;
let warningCount = 0;

function count(problems) {
  errorCount += problems.filter((problem) => problem.level === "error").length;
  warningCount += problems.filter((problem) => problem.level === "warning").length;
}

// ---------- Every building ----------

for (const building of buildings) {
  const ofBuilding = {};
  for (const collection of COLLECTIONS) {
    ofBuilding[collection] = data[collection].get(building.id) ?? [];
  }

  console.log(`\n${building.name} (${building.id})`);
  console.log(
    `  ${ofBuilding.floors.length} of ${building.floors_count} floor plans, ${ofBuilding.nodes.length} points, ` +
      `${ofBuilding.edges.length} walkways, ${ofBuilding.places.length} places`,
  );

  const problems = findBuildingProblems(ofBuilding);
  printProblems(problems);
  count(problems);
}

// ---------- Data of buildings that are not in the buildings table ----------

console.log("\nData without a building");
const knownIds = new Set(buildings.map((building) => building.id));
let leftovers = 0;

for (const collection of COLLECTIONS) {
  for (const [buildingId, docs] of data[collection]) {
    if (!knownIds.has(buildingId)) {
      console.log(`  WARNING ${docs.length} ${collection} of a building that does not exist (${buildingId})`);
      leftovers += 1;
    }
  }
}
if (leftovers === 0) {
  console.log("  OK - nothing to fix");
}
warningCount += leftovers;

// ---------- Who manages what ----------

console.log("\nUsers");
const roles = ["super", "admin", "visitor"].map((role) => `${users.filter((user) => user.role === role).length} ${role}`);
console.log(`  ${users.length} users: ${roles.join(", ")}`);

const userProblems = findUserProblems(users, buildings);
printProblems(userProblems);
count(userProblems);

// ---------- Summary ----------

console.log(`\n${errorCount} errors, ${warningCount} warnings in ${buildings.length} buildings. Nothing was changed.`);
process.exit(errorCount > 0 ? 1 : 0); // mongoConfig keeps the connection open, so we close the process ourselves
