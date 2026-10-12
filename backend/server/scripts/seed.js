// Demo data for "Sea Mall" in both databases, through our own repositories.
// Run from backend/server, after the buildings were inserted in Supabase:
//   node --env-file=.env scripts/seed.js
// Safe to run again: the old demo data of the building is deleted first.

import { readFile } from "node:fs/promises";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import { mongoRepo } from "../repositories/mongoRepo.js";
import { supabaseRepo } from "../repositories/sqlRepo.js";

const BUILDING_NAME = "Sea Mall";
const DEMO_PASSWORD = "Demo12345";

const dataFile = new URL("./seed-data/sea-mall.json", import.meta.url);
const data = JSON.parse(await readFile(dataFile, "utf8"));

// ---------- 1. The building (must already be in Supabase) ----------

const building = await supabaseRepo.findOne("buildings", { name: BUILDING_NAME });

if (!building) {
  console.error(`"${BUILDING_NAME}" is not in the buildings table. Insert the buildings first.`);
  process.exit(1);
}

const buildingId = building.id;
console.log(`${BUILDING_NAME}: ${buildingId}`);

// ---------- 2. Users, saved the same way register saves them ----------

const userIds = {}; // username -> id

for (const user of data.users) {
  let savedUser = await supabaseRepo.findOne("users", { email: user.email });

  if (!savedUser) {
    const hashPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
    savedUser = await supabaseRepo.insertOne("users", {
      username: user.username,
      email: user.email,
      hashPassword,
      role: user.role,
      buildingIds: user.role === "admin" ? [buildingId] : [],
    });
  }

  userIds[user.username] = savedUser.id;
}

console.log(`users: ${Object.keys(userIds).length} (password: ${DEMO_PASSWORD})`);

// ---------- 3. MongoDB: delete the old demo data of this building ----------

for (const collection of ["floors", "nodes", "edges", "places", "messages"]) {
  await mongoRepo.deleteMany(collection, { buildingId });
}

// ---------- 4. MongoDB: floors, graph, places and messages ----------
// _id is an ObjectId. References to nodes (from, to, entryNodeId) are saved as strings.

const floors = data.floors.map((floor) => ({
  buildingId,
  floor: floor.floor,
  name: floor.name,
  svg: floor.svg,
  width: floor.width,
  height: floor.height,
}));

const nodes = data.nodes.map((node) => ({
  _id: new ObjectId(node.id),
  buildingId,
  floor: node.floor,
  x: node.x,
  y: node.y,
  type: node.type,
  connectorId: node.connectorId,
  label: node.label,
}));

const edges = data.edges.map((edge) => ({
  _id: new ObjectId(edge.id),
  buildingId,
  from: edge.from,
  to: edge.to,
  length: edge.length,
  blocked: false,
}));

const places = data.places.map((place) => {
  const placeDoc = {
    _id: new ObjectId(place.id),
    buildingId,
    floor: place.floor,
    name: place.name,
    type: place.type,
    category: place.category,
    x: place.x,
    y: place.y,
    isLandmark: place.isLandmark,
    entryNodeId: place.entryNodeId,
  };

  // Optional fields are added only when they have a value (no nulls in the database)
  if (place.hours) {
    placeDoc.hours = place.hours;
  }
  if (place.url) {
    placeDoc.url = place.url;
  }

  return placeDoc;
});

const messages = data.messages.map((message) => ({
  buildingId,
  userId: userIds[message.username],
  username: message.username,
  text: message.text,
  createdAt: new Date(Date.now() - message.minutesAgo * 60 * 1000),
}));

await mongoRepo.insertMany("floors", floors);
await mongoRepo.insertMany("nodes", nodes);
await mongoRepo.insertMany("edges", edges);
await mongoRepo.insertMany("places", places);
await mongoRepo.insertMany("messages", messages);

console.log(
  `mongo: ${floors.length} floors, ${nodes.length} nodes, ${edges.length} edges, ` +
    `${places.length} places, ${messages.length} messages`,
);

// ---------- 5. Supabase tables of the visitor side ----------
// If a table was not created yet, it is skipped and the rest still runs.

function dateAgo(daysAgo, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function replaceDemoRows(table, rows) {
  try {
    await supabaseRepo.deleteMany(table, { building_id: buildingId });
    await supabaseRepo.insertMany(table, rows);
    console.log(`${table}: ${rows.length}`);
  } catch (error) {
    console.log(`${table}: skipped (${error.message})`);
  }
}

const routeRequests = data.routeRequests.map((request) => ({
  building_id: buildingId,
  from_node: request.fromNode,
  to_node: request.toNode,
  path: request.path,
  search_query: request.searchQuery,
  created_at: dateAgo(request.daysAgo, request.hour, request.minute).toISOString(),
}));

const alerts = data.alerts.map((alert) => {
  const startedAt = dateAgo(alert.daysAgo, 14, 0);
  const endedAt = new Date(startedAt.getTime() + 10 * 60 * 1000);
  return {
    building_id: buildingId,
    title: alert.title,
    category: alert.category,
    is_simulation: alert.isSimulation,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
  };
});

// noa_cohen is blocked from the chat of this building, to test the "banned" message
const chatBans = [{ building_id: buildingId, user_id: userIds.noa_cohen }];

await replaceDemoRows("route_requests", routeRequests);
await replaceDemoRows("alerts", alerts);
await replaceDemoRows("chat_bans", chatBans);

console.log("Done");
process.exit(0); // mongoConfig keeps the connection open, so we close the process ourselves
