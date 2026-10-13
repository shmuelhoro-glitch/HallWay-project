import { ObjectId } from "mongodb";
import { mongoRepo } from "../repositories/mongoRepo.js";
import { supabaseRepo } from "../repositories/sqlRepo.js";
import { createBuildingSchema } from "../schemas/buildings.schemas.js";
import { createPlaceSchema } from "../schemas/places.schemas.js";
import { NODE_TYPES } from "../schemas/graph.schemas.js";
import { readSvgSize } from "./buildings.service.js";
import { computeLength } from "./graph.service.js";
import { findBuildingProblems } from "./dataCheck.service.js";
import { undo } from "./undo.js";

// Adds a whole building from one file: its details, floor plans, points, walkways and places.
// For a building that was prepared outside the site (scripts/import-building.js).
//
// The file:
//   {
//     building: { name, type, address, city, alert_area, floors_count, lat, lng },
//     floors:   [{ floor, name, svg }],
//     nodes:    [{ key, floor, x, y, type, connectorId?, label? }],
//     edges:    [{ from, to }],                    // the keys of two nodes
//     places:   [{ floor, name, type, category, x, y, hours?, url?, isLandmark?, node }]   // node: the key of its entrance
//   }
// A key is any text that is different for every node. It lives only in the file: the nodes get
// real ids here, and the walkways and places are saved with those.

const CONNECTOR_TYPES = ["stairs", "elevator"];
const MAX_LANDMARKS_PER_FLOOR = 5; // the same limit as places.controller.js
const COLLECTIONS = ["floors", "nodes", "edges", "places"];

// These errors are for whoever runs the script, in the terminal
function refuse(message) {
  throw new Error(message);
}

function firstIssue(zodError) {
  const issue = zodError.issues[0];
  return `${issue.path.join(".")}: ${issue.message}`;
}

// Checks the file and turns it into the documents that will be saved (without a buildingId yet).
// Changes nothing. Throws when the file is wrong; things that are only worth a look come back in "problems".
export function prepareImport(file) {
  const parsedBuilding = createBuildingSchema.body.safeParse(file.building ?? {});
  if (!parsedBuilding.success) {
    refuse(`The building is not valid - ${firstIssue(parsedBuilding.error)}`);
  }
  const building = parsedBuilding.data;
  if (building.lat === undefined || building.lng === undefined) {
    refuse("The building needs lat and lng: the script does not look an address up");
  }

  // ---------- Floors ----------
  const floors = [];
  for (const floor of file.floors ?? []) {
    if (!Number.isInteger(floor.floor) || typeof floor.svg !== "string") {
      refuse("Every floor needs a floor number and an svg");
    }
    if (floors.some((other) => other.floor === floor.floor)) {
      refuse(`Floor ${floor.floor} is in the file twice`);
    }
    const start = floor.svg.indexOf("<svg");
    if (start === -1) {
      refuse(`The plan of floor ${floor.floor} is not an SVG`);
    }
    const svg = floor.svg.slice(start);
    const { width, height } = readSvgSize(svg);
    floors.push({ floor: floor.floor, name: String(floor.name ?? "").trim(), svg, width, height });
  }
  if (floors.length === 0) {
    refuse("The file has no floors");
  }
  const floorNumbers = new Set(floors.map((floor) => floor.floor));

  // ---------- Points ----------
  const nodes = [];
  const nodesByKey = new Map();
  for (const node of file.nodes ?? []) {
    const where = `The point "${node.key}"`;
    if (typeof node.key !== "string" || node.key === "") refuse("Every point needs a key");
    if (nodesByKey.has(node.key)) refuse(`${where} is in the file twice`);
    if (!NODE_TYPES.includes(node.type)) refuse(`${where} has an unknown type: ${node.type}`);
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) refuse(`${where} has no valid x / y`);
    if (!floorNumbers.has(node.floor)) refuse(`${where} is on floor ${node.floor}, which has no plan in the file`);

    const isConnector = CONNECTOR_TYPES.includes(node.type);
    if (isConnector && !node.connectorId) refuse(`${where} is ${node.type} without a connectorId`);
    if (!isConnector && node.connectorId) refuse(`${where} has a connectorId, but only stairs and elevators connect floors`);

    const doc = { _id: new ObjectId(), floor: node.floor, x: node.x, y: node.y, type: node.type };
    if (node.connectorId) doc.connectorId = String(node.connectorId);
    if (node.label) doc.label = String(node.label);
    nodes.push(doc);
    nodesByKey.set(node.key, doc);
  }

  // ---------- Walkways ----------
  const edges = [];
  const connectedPairs = new Set();
  for (const edge of file.edges ?? []) {
    const a = nodesByKey.get(edge.from);
    const b = nodesByKey.get(edge.to);
    if (!a || !b) refuse(`A walkway uses a point that is not in the file: ${edge.from} - ${edge.to}`);
    if (a === b) refuse(`A walkway needs two different points: ${edge.from}`);
    if (a.floor !== b.floor) refuse(`A walkway can't connect two floors: ${edge.from} - ${edge.to}`);

    const pair = [String(a._id), String(b._id)].sort().join("-");
    if (connectedPairs.has(pair)) refuse(`The same walkway is in the file twice: ${edge.from} - ${edge.to}`);
    connectedPairs.add(pair);

    // from / to are saved as strings, like the editor saves them
    edges.push({ from: String(a._id), to: String(b._id), length: computeLength(a, b), blocked: false });
  }

  // ---------- Places ----------
  const places = [];
  const usedEntrances = new Set();
  const landmarksOnFloor = new Map();
  for (const place of file.places ?? []) {
    const { node: nodeKey, ...fields } = place;
    const parsed = createPlaceSchema.body.safeParse(fields);
    if (!parsed.success) {
      refuse(`The place "${place.name}" is not valid - ${firstIssue(parsed.error)}`);
    }
    const { floor, name, type, category, x, y, hours, url, isLandmark } = parsed.data;

    const entrance = nodesByKey.get(nodeKey);
    if (!entrance) refuse(`The place "${name}" has no entrance point in the file (${nodeKey})`);
    if (entrance.type !== "entrance") refuse(`The entrance of "${name}" must be a point of type entrance`);
    if (entrance.floor !== floor) refuse(`"${name}" and its entrance are on different floors`);
    if (usedEntrances.has(entrance)) refuse(`Two places use the same entrance point (${nodeKey})`);
    usedEntrances.add(entrance);

    if (isLandmark) {
      const count = (landmarksOnFloor.get(floor) ?? 0) + 1;
      if (count > MAX_LANDMARKS_PER_FLOOR) refuse(`Floor ${floor} has more than ${MAX_LANDMARKS_PER_FLOOR} landmarks`);
      landmarksOnFloor.set(floor, count);
    }

    // The same shape the site saves: optional fields only when they have a value
    const doc = { floor, name, type, category, x, y, isLandmark, entryNodeId: String(entrance._id) };
    if (hours) doc.hours = hours;
    if (url) doc.url = url;
    places.push(doc);
  }

  const problems = findBuildingProblems({ floors, nodes, edges, places });
  return { building, floors, nodes, edges, places, problems };
}

// Saves the building. Everything is saved, or nothing: when a step fails, what was already
// saved is deleted again.
export async function importBuilding(file) {
  const prepared = prepareImport(file);

  const errors = prepared.problems.filter((problem) => problem.level === "error");
  if (errors.length > 0) {
    refuse(`The data has ${errors.length} errors (the first: ${errors[0].message}). Nothing was added.`);
  }

  const sameName = await supabaseRepo.findMany("buildings", { name: prepared.building.name });
  if (sameName.length > 0) {
    refuse(`A building named "${prepared.building.name}" already exists (${sameName[0].id}). Nothing was added.`);
  }

  const building = await supabaseRepo.insertOne("buildings", prepared.building);

  try {
    for (const collection of COLLECTIONS) {
      const docs = prepared[collection].map((doc) => ({ buildingId: building.id, ...doc }));
      if (docs.length > 0) {
        await mongoRepo.insertMany(collection, docs);
      }
    }
  } catch (error) {
    // Half a building must not stay: a visitor would open it and find no way to walk
    for (const collection of COLLECTIONS) {
      await undo(`delete the ${collection} of the new building ${building.id}`, () =>
        mongoRepo.deleteMany(collection, { buildingId: building.id })
      );
    }
    await undo(`delete the new building ${building.id}`, () => supabaseRepo.deleteOne("buildings", { id: building.id }));
    throw error;
  }

  return { building, prepared };
}
