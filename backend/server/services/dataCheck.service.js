// Looks for broken data: things the server and the routing service assume are always true.
// Everything here is pure - it gets the documents and returns a list of problems.
// It reads nothing and changes nothing by itself, so the same code can run in a script,
// in a test, or behind a screen for the admin.
//
// A problem: { level, code, kind, id, floor, message }
//   level "error"   - visitors can get a wrong route, or no route at all
//   level "warning" - worth a look, but navigation still works
//   kind + id       - the document it is about ("node", "edge", "place")

const CONNECTOR_TYPES = ["stairs", "elevator"];
const USER_ROLES = ["visitor", "admin", "super"];

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// The problems in the floors, points, walkways and places of ONE building
export function findBuildingProblems({ floors, nodes, edges, places }) {
  const problems = [];

  // name: what the admin calls this thing (a place name, a point name, a connector id).
  // The client writes its own Hebrew message from the code and this name.
  function add(level, code, kind, doc, floor, message, name = doc.name ?? doc.label ?? null) {
    problems.push({ level, code, kind, id: String(doc._id), floor: floor ?? null, name, message });
  }

  const floorsByNumber = new Map(floors.map((floor) => [floor.floor, floor]));
  const nodesById = new Map(nodes.map((node) => [String(node._id), node]));

  // Which points have at least one walkway, and which places use each point as an entrance
  const connectedIds = new Set();
  for (const edge of edges) {
    connectedIds.add(String(edge.from));
    connectedIds.add(String(edge.to));
  }

  const placesByEntry = new Map();
  for (const place of places) {
    if (!place.entryNodeId) continue;
    const list = placesByEntry.get(place.entryNodeId) ?? [];
    list.push(place);
    placesByEntry.set(place.entryNodeId, list);
  }

  // A point or a place must sit on a floor that has a plan, inside the plan
  function checkSpot(kind, doc, name) {
    if (!isNumber(doc.x) || !isNumber(doc.y)) {
      add("error", "BAD_COORDINATES", kind, doc, doc.floor, `${name} has no valid x / y`);
      return;
    }

    const floor = floorsByNumber.get(doc.floor);
    if (!floor) {
      add("error", "FLOOR_WITHOUT_PLAN", kind, doc, doc.floor, `${name} is on floor ${doc.floor}, which has no plan`);
      return;
    }

    if (doc.x < 0 || doc.y < 0 || doc.x > floor.width || doc.y > floor.height) {
      add("warning", "OUTSIDE_THE_PLAN", kind, doc, doc.floor, `${name} is outside the plan (${doc.x}, ${doc.y})`);
    }
  }

  // ---------- Points ----------

  for (const node of nodes) {
    const id = String(node._id);
    const name = node.label ? `The ${node.type} "${node.label}"` : `A ${node.type} point`;
    const isConnector = CONNECTOR_TYPES.includes(node.type);
    const isEntranceOfPlace = placesByEntry.has(id);

    checkSpot("node", node, name);

    if (isConnector && !node.connectorId) {
      add("error", "CONNECTOR_ID_MISSING", "node", node, node.floor, `${name} has no connector id, so it does not connect floors`);
    }
    if (!isConnector && node.connectorId) {
      add(
        "warning",
        "CONNECTOR_ID_ON_OTHER_TYPE",
        "node",
        node,
        node.floor,
        `${name} still has the connector id "${node.connectorId}", so routes change floors through it`,
      );
    }

    if (node.type === "entrance" && !isEntranceOfPlace) {
      add("warning", "ENTRANCE_WITHOUT_PLACE", "node", node, node.floor, `${name} is an entrance, but no place uses it`);
    }

    // The entrance of a place is reported with the place, below
    if (!connectedIds.has(id) && !isEntranceOfPlace) {
      add("warning", "POINT_NOT_CONNECTED", "node", node, node.floor, `${name} has no walkway`);
    }
  }

  // ---------- Stairs and elevators ----------

  const nodesByConnector = new Map();
  for (const node of nodes) {
    if (!node.connectorId) continue;
    const list = nodesByConnector.get(node.connectorId) ?? [];
    list.push(node);
    nodesByConnector.set(node.connectorId, list);
  }

  for (const [connectorId, group] of nodesByConnector) {
    const floorsOfGroup = group.map((node) => node.floor);
    const differentFloors = new Set(floorsOfGroup);

    if (differentFloors.size === 1) {
      add(
        "warning",
        "CONNECTOR_ON_ONE_FLOOR",
        "node",
        group[0],
        group[0].floor,
        `"${connectorId}" is only on floor ${group[0].floor}, so it leads nowhere`,
        connectorId,
      );
    }
    if (differentFloors.size < floorsOfGroup.length) {
      const repeated = group.find((node, index) => floorsOfGroup.indexOf(node.floor) !== index);
      add(
        "warning",
        "CONNECTOR_TWICE_ON_A_FLOOR",
        "node",
        repeated,
        repeated.floor,
        `"${connectorId}" is on floor ${repeated.floor} more than once`,
        connectorId,
      );
    }
  }

  // ---------- Walkways ----------

  const seenPairs = new Set();

  for (const edge of edges) {
    if (typeof edge.from !== "string" || typeof edge.to !== "string") {
      add("error", "WALKWAY_IDS_NOT_TEXT", "edge", edge, null, "A walkway saves its points as ObjectId, not as text, so it is never loaded");
      continue;
    }

    const a = nodesById.get(edge.from);
    const b = nodesById.get(edge.to);

    if (!a || !b) {
      add("warning", "WALKWAY_TO_MISSING_POINT", "edge", edge, (a ?? b)?.floor, "A walkway leads to a point that was deleted");
      continue;
    }
    if (edge.from === edge.to) {
      add("warning", "WALKWAY_TO_ITSELF", "edge", edge, a.floor, "A walkway connects a point to itself");
      continue;
    }
    if (a.floor !== b.floor) {
      add(
        "error",
        "WALKWAY_BETWEEN_FLOORS",
        "edge",
        edge,
        a.floor,
        `A walkway connects floor ${a.floor} to floor ${b.floor} without stairs or an elevator`,
      );
    }

    const pair = [edge.from, edge.to].sort().join("-");
    if (seenPairs.has(pair)) {
      add("warning", "WALKWAY_TWICE", "edge", edge, a.floor, "The same two points are connected twice");
    }
    seenPairs.add(pair);
  }

  // ---------- Places ----------

  for (const place of places) {
    const name = `"${place.name}"`;

    checkSpot("place", place, name);

    if (!place.entryNodeId) {
      add("error", "PLACE_WITHOUT_ENTRANCE", "place", place, place.floor, `${name} has no entrance point, so there is no route to it`);
      continue;
    }

    const entrance = nodesById.get(place.entryNodeId);
    if (!entrance) {
      add("error", "PLACE_ENTRANCE_MISSING", "place", place, place.floor, `The entrance point of ${name} was deleted, so there is no route to it`);
      continue;
    }

    if (entrance.floor !== place.floor) {
      add(
        "error",
        "PLACE_ENTRANCE_ON_OTHER_FLOOR",
        "place",
        place,
        place.floor,
        `${name} is on floor ${place.floor}, but its entrance is on floor ${entrance.floor}`,
      );
    }
    if (!connectedIds.has(place.entryNodeId)) {
      add("error", "PLACE_NOT_CONNECTED", "place", place, place.floor, `The entrance of ${name} has no walkway, so there is no route to it`);
    }
    if (entrance.type !== "entrance") {
      add("warning", "PLACE_ENTRANCE_WRONG_TYPE", "place", place, place.floor, `The entrance of ${name} is a ${entrance.type} point`);
    }
    if (placesByEntry.get(place.entryNodeId).length > 1) {
      add("warning", "PLACE_ENTRANCE_SHARED", "place", place, place.floor, `${name} shares its entrance point with another place`);
    }
  }

  // ---------- Can a visitor really get there? ----------
  // The same graph the routing service walks on: the walkways, and the same connector id on
  // different floors. The biggest connected part is "the building"; anything outside it can't be reached.

  function buildParts(withBlocked) {
    const neighbors = new Map(nodes.map((node) => [String(node._id), []]));

    function connect(a, b) {
      neighbors.get(a).push(b);
      neighbors.get(b).push(a);
    }

    for (const edge of edges) {
      if (edge.blocked === true && !withBlocked) continue;
      if (!neighbors.has(edge.from) || !neighbors.has(edge.to)) continue;
      connect(edge.from, edge.to);
    }
    for (const group of nodesByConnector.values()) {
      for (const a of group) {
        for (const b of group) {
          if (a.floor < b.floor) connect(String(a._id), String(b._id));
        }
      }
    }

    // partOf: node id -> the number of its connected part. sizes: how many nodes each part has.
    const partOf = new Map();
    const sizes = [];
    for (const start of neighbors.keys()) {
      if (partOf.has(start)) continue;
      const part = sizes.length;
      let size = 0;
      const queue = [start];
      partOf.set(start, part);
      while (queue.length > 0) {
        const id = queue.pop();
        size++;
        for (const next of neighbors.get(id)) {
          if (!partOf.has(next)) {
            partOf.set(next, part);
            queue.push(next);
          }
        }
      }
      sizes.push(size);
    }

    return { partOf, mainPart: sizes.indexOf(Math.max(...sizes)) };
  }

  if (nodes.length > 0) {
    const open = buildParts(false);
    const isReachable = (id) => open.partOf.get(id) === open.mainPart;

    // With the blocked walkways opened: tells "blocked right now" from "never connected"
    const all = buildParts(true);
    const mainNode = [...open.partOf.keys()].find(isReachable);
    const isReachableWithoutBlocks = (id) => all.partOf.get(id) === all.partOf.get(mainNode);

    for (const place of places) {
      const entrance = place.entryNodeId ? nodesById.get(place.entryNodeId) : null;
      // No entrance, or an entrance with no walkway at all: already reported above
      if (!entrance || !connectedIds.has(place.entryNodeId) || isReachable(place.entryNodeId)) continue;

      if (isReachableWithoutBlocks(place.entryNodeId)) {
        add("error", "PLACE_BLOCKED", "place", place, place.floor, `A blocked walkway cuts "${place.name}" off`);
      } else {
        add("error", "PLACE_UNREACHABLE", "place", place, place.floor, `"${place.name}" is not connected to the rest of the building`);
      }
    }

    for (const node of nodes) {
      const id = String(node._id);
      if (node.type === "qr" && connectedIds.has(id) && !isReachable(id)) {
        add("warning", "QR_UNREACHABLE", "node", node, node.floor, `The QR point "${node.label ?? ""}" is not connected to the rest of the building`);
      }
    }

    // A floor with points, none of them in the building: its stairs / elevator are not set
    const floorsWithNodes = [...new Set(nodes.map((node) => node.floor))];
    if (floorsWithNodes.length > 1) {
      for (const floorNumber of floorsWithNodes) {
        const hasReachableNode = nodes.some((node) => node.floor === floorNumber && isReachable(String(node._id)));
        if (!hasReachableNode) {
          add("warning", "FLOOR_NOT_CONNECTED", "floor", { _id: floorNumber }, floorNumber, `Floor ${floorNumber} is not connected to the other floors`);
        }
      }
    }
  }

  return problems;
}

// The problems in who may manage what.
// users: the rows of the users table. buildings: the rows of the buildings table.
export function findUserProblems(users, buildings) {
  const problems = [];
  const buildingIds = new Set(buildings.map((building) => building.id));
  const managedIds = new Set();

  for (const user of users) {
    const ownIds = user.buildingIds ?? [];
    const base = { kind: "user", id: user.id, floor: null };

    if (!USER_ROLES.includes(user.role)) {
      problems.push({ ...base, level: "error", code: "UNKNOWN_ROLE", message: `${user.username} has the role "${user.role}"` });
      continue;
    }

    if (user.role === "admin" && ownIds.length === 0) {
      problems.push({
        ...base,
        level: "warning",
        code: "ADMIN_WITHOUT_BUILDINGS",
        message: `${user.username} is an admin without buildings: he can only create a new one`,
      });
    }
    if (user.role === "visitor" && ownIds.length > 0) {
      problems.push({
        ...base,
        level: "warning",
        code: "VISITOR_WITH_BUILDINGS",
        message: `${user.username} is a visitor, so his ${ownIds.length} building(s) are ignored`,
      });
    }

    for (const buildingId of ownIds) {
      if (!buildingIds.has(buildingId)) {
        problems.push({
          ...base,
          level: "warning",
          code: "UNKNOWN_BUILDING",
          message: `${user.username} has a building that does not exist (${buildingId})`,
        });
      } else if (user.role === "admin") {
        managedIds.add(buildingId);
      }
    }
  }

  for (const building of buildings) {
    if (!managedIds.has(building.id)) {
      problems.push({
        kind: "building",
        id: building.id,
        floor: null,
        level: "warning",
        code: "BUILDING_WITHOUT_ADMIN",
        message: `"${building.name}" has no admin: only a super can change it`,
      });
    }
  }

  return problems;
}
