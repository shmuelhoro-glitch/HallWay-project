import { ObjectId } from "mongodb";
import { mongoRepo } from "../repositories/mongoRepo.js";
import { supabaseRepo } from "../repositories/sqlRepo.js";
import {
  computeLength,
  deleteEdgesOfNode,
  toEdgeResponse,
  toNodeResponse,
  updateEdgeLengths,
} from "../services/graph.service.js";
import { undo } from "../services/undo.js";
import { findBuildingProblems } from "../services/dataCheck.service.js";

// The walking graph of a building, for the admin editor.
// The Python service reads the same collections on every route, so every change here
// (a new walkway, a blocked passage) counts for the visitors right away.

function nodeNotFound() {
  return { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" };
}

function edgeNotFound() {
  return { status: 404, code: "EDGE_NOT_FOUND", message: "Walkway not found" };
}

// Floors are connected only by stairs / elevators with the same connectorId
function differentFloors() {
  return { status: 400, code: "DIFFERENT_FLOORS", message: "Both points must be on the same floor" };
}

// Finds a node of this building, or throws 404
async function findNode(buildingId, nodeId) {
  if (!ObjectId.isValid(nodeId)) {
    throw nodeNotFound();
  }
  const node = await mongoRepo.findOne("nodes", { _id: new ObjectId(nodeId), buildingId });
  if (!node) {
    throw nodeNotFound();
  }
  return node;
}

// Stairs and elevators connect floors only through connectorId, so it must be there
function checkConnector(type, connectorId) {
  if ((type === "stairs" || type === "elevator") && !connectorId) {
    throw {
      status: 400,
      code: "CONNECTOR_REQUIRED",
      message: "Stairs and elevators need a connector id, the same on every floor",
    };
  }
}

// GET /api/buildings/:buildingId/graph?floor=0
export async function getGraph(req, res, next) {
  try {
    const { buildingId } = req.params;
    const floor = req.validatedQuery.floor;

    const nodeQuery = { buildingId };
    if (floor !== undefined) {
      nodeQuery.floor = floor;
    }
    const nodes = await mongoRepo.findMany("nodes", nodeQuery);

    // An edge has no floor field. We keep the edges whose two nodes are in the list.
    const nodeIds = new Set(nodes.map((node) => String(node._id)));
    const allEdges = await mongoRepo.findMany("edges", { buildingId });
    const edges = allEdges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));

    res.json({
      nodes: nodes.map(toNodeResponse),
      edges: edges.map(toEdgeResponse),
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/buildings/:buildingId/graph/check
// Everything that is wrong in the building, for the "Check" tab: errors first.
export async function checkBuilding(req, res, next) {
  try {
    const { buildingId } = req.params;

    const building = await supabaseRepo.findOne("buildings", { id: buildingId });
    if (!building) {
      throw { status: 404, code: "BUILDING_NOT_FOUND", message: "Building not found" };
    }

    const [floors, nodes, edges, places] = await Promise.all([
      mongoRepo.findMany("floors", { buildingId }),
      mongoRepo.findMany("nodes", { buildingId }),
      mongoRepo.findMany("edges", { buildingId }),
      mongoRepo.findMany("places", { buildingId }),
    ]);

    const problems = findBuildingProblems({ floors, nodes, edges, places });

    if (floors.length < building.floors_count) {
      problems.push({
        level: "warning",
        code: "FLOOR_PLANS_MISSING",
        kind: "building",
        id: buildingId,
        floor: null,
        name: null,
        message: `${floors.length} of ${building.floors_count} floor plans were uploaded`,
      });
    }

    problems.sort((a, b) => a.level.localeCompare(b.level)); // "error" before "warning"
    res.json({ problems });
  } catch (error) {
    next(error);
  }
}

// POST /api/buildings/:buildingId/graph/nodes
// With connectFrom (draw mode) the new point is saved together with a walkway to that point,
// and the answer has the walkway too, in "edge". Both are saved, or none of them.
export async function createNode(req, res, next) {
  try {
    const { buildingId } = req.params;
    const { floor, x, y, type, connectorId, label, connectFrom } = req.body;

    const building = await supabaseRepo.findOne("buildings", { id: buildingId });
    if (!building) {
      throw { status: 404, code: "BUILDING_NOT_FOUND", message: "Building not found" };
    }

    checkConnector(type, connectorId);

    // Checked before anything is saved, so a wrong point does not leave a new node behind
    let previousNode = null;
    if (connectFrom) {
      previousNode = await findNode(buildingId, connectFrom);
      if (previousNode.floor !== floor) {
        throw differentFloors();
      }
    }

    const node = { buildingId, floor, x, y, type };
    if (connectorId) node.connectorId = connectorId;
    if (label) node.label = label;

    const nodeId = await mongoRepo.insertOne("nodes", node);
    const response = toNodeResponse({ _id: nodeId, ...node });

    if (previousNode) {
      const edge = {
        buildingId,
        from: connectFrom,
        to: String(nodeId),
        length: computeLength(previousNode, node),
        blocked: false,
      };

      try {
        const edgeId = await mongoRepo.insertOne("edges", edge);
        response.edge = toEdgeResponse({ _id: edgeId, ...edge });
      } catch (error) {
        // The walkway was not saved - the new point must not stay alone on the map
        await undo(`delete the new node ${nodeId}`, () => mongoRepo.deleteOne("nodes", { _id: nodeId }));
        throw error;
      }
    }

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

// PUT /api/buildings/:buildingId/graph/nodes/:nodeId - send only what changed
export async function updateNode(req, res, next) {
  try {
    const { buildingId, nodeId } = req.params;
    const node = await findNode(buildingId, nodeId);
    const changes = req.body;

    // Check the node as it will be after the change
    const finalType = changes.type ?? node.type;
    const finalConnector = changes.connectorId !== undefined ? changes.connectorId : node.connectorId;
    checkConnector(finalType, finalConnector);

    // Only stairs and elevators connect floors. Any other type must not keep a connector id,
    // or the routes would still change floors through this point.
    const isConnector = finalType === "stairs" || finalType === "elevator";
    if (!isConnector && finalConnector) {
      changes.connectorId = "";
    }

    // An empty text removes the field
    const fieldsToSet = {};
    const fieldsToRemove = {};
    for (const [key, value] of Object.entries(changes)) {
      if (value === "") {
        fieldsToRemove[key] = "";
      } else {
        fieldsToSet[key] = value;
      }
    }

    const update = {};
    if (Object.keys(fieldsToSet).length > 0) update.$set = fieldsToSet;
    if (Object.keys(fieldsToRemove).length > 0) update.$unset = fieldsToRemove;

    if (Object.keys(update).length > 0) {
      await mongoRepo.updateOne("nodes", { _id: node._id }, update);
    }

    // The node moved - its walkways got longer or shorter
    if (changes.x !== undefined || changes.y !== undefined) {
      await updateEdgeLengths(nodeId);
    }

    const updatedNode = await mongoRepo.findOne("nodes", { _id: node._id });
    res.json(toNodeResponse(updatedNode));
  } catch (error) {
    next(error);
  }
}

// DELETE /api/buildings/:buildingId/graph/nodes/:nodeId
export async function deleteNode(req, res, next) {
  try {
    const { buildingId, nodeId } = req.params;
    const node = await findNode(buildingId, nodeId);

    // The entrance of a place is deleted together with the place, in the Places screen
    const place = await mongoRepo.findOne("places", { buildingId, entryNodeId: nodeId });
    if (place) {
      throw {
        status: 409,
        code: "NODE_IN_USE",
        message: `This is the entrance of "${place.name}". Delete the place instead.`,
      };
    }

    await deleteEdgesOfNode(nodeId);
    await mongoRepo.deleteOne("nodes", { _id: node._id });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

// POST /api/buildings/:buildingId/graph/edges  { from, to }
export async function createEdge(req, res, next) {
  try {
    const { buildingId } = req.params;
    const { from, to } = req.body;

    if (from === to) {
      throw { status: 400, code: "SAME_NODE", message: "A walkway needs two different points" };
    }

    const a = await findNode(buildingId, from);
    const b = await findNode(buildingId, to);

    if (a.floor !== b.floor) {
      throw differentFloors();
    }

    const existing = await mongoRepo.findOne("edges", {
      buildingId,
      $or: [
        { from, to },
        { from: to, to: from },
      ],
    });
    if (existing) {
      throw { status: 409, code: "EDGE_EXISTS", message: "These points are already connected" };
    }

    // from / to are saved as strings, like in the demo data
    const edge = { buildingId, from, to, length: computeLength(a, b), blocked: false };
    const edgeId = await mongoRepo.insertOne("edges", edge);

    res.status(201).json(toEdgeResponse({ _id: edgeId, ...edge }));
  } catch (error) {
    next(error);
  }
}

// PATCH /api/buildings/:buildingId/graph/edges/:edgeId  { blocked: true / false }
export async function updateEdge(req, res, next) {
  try {
    const { buildingId, edgeId } = req.params;
    const { blocked } = req.body;

    if (!ObjectId.isValid(edgeId)) {
      throw edgeNotFound();
    }
    const _id = new ObjectId(edgeId);

    const edge = await mongoRepo.findOne("edges", { _id, buildingId });
    if (!edge) {
      throw edgeNotFound();
    }

    await mongoRepo.updateOne("edges", { _id }, { $set: { blocked } });
    res.json(toEdgeResponse({ ...edge, blocked }));
  } catch (error) {
    next(error);
  }
}

// DELETE /api/buildings/:buildingId/graph/edges/:edgeId
export async function deleteEdge(req, res, next) {
  try {
    const { buildingId, edgeId } = req.params;

    if (!ObjectId.isValid(edgeId)) {
      throw edgeNotFound();
    }

    const deletedCount = await mongoRepo.deleteOne("edges", { _id: new ObjectId(edgeId), buildingId });
    if (deletedCount === 0) {
      throw edgeNotFound();
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
