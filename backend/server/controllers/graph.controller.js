import { ObjectId } from "mongodb";
import { mongoRepo } from "../repositories/mongoRepo.js";
import { updateEdgeLengths } from "../services/graph.service.js";

// פונקציות עזר לעיצוב התשובה בדיוק לפי האפיון (id כמחרוזת במקום _id)
function formatNode(node) {
  return {
    id: String(node._id),
    floor: node.floor,
    x: node.x,
    y: node.y,
    type: node.type,
    connectorId: node.connectorId ?? null,
    label: node.label ?? null,
  };
}

function formatEdge(edge) {
  return {
    id: String(edge._id),
    from: edge.from,
    to: edge.to,
    length: edge.length,
    blocked: edge.blocked,
  };
}

// 1. שליפת הגרף של קומה: GET /api/buildings/:buildingId/graph?floor=0
export async function getGraph(req, res, next) {
  try {
    const { buildingId } = req.params;
    const floor = Number(req.query.floor);

    // א. מביאים את כל הצמתים של הקומה המבוקשת
    const rawNodes = await mongoRepo.findMany("nodes", { buildingId, floor });
    const nodes = rawNodes.map(formatNode);

    // ב. שומרים ב-Set את כל מזהי הצמתים של הקומה הזו
    const floorNodeIds = new Set(nodes.map((n) => n.id));

    // ג. מביאים את הקשתות של המבנה ומסננים רק קשתות ששייכות לצמתים בקומה הזו
    const rawEdges = await mongoRepo.findMany("edges", { buildingId });
    const edges = rawEdges
      .filter((e) => floorNodeIds.has(e.from) && floorNodeIds.has(e.to))
      .map(formatEdge);

    res.status(200).json({ nodes, edges });
  } catch (err) {
    next(err);
  }
}

// 2. יצירת צומת חדש: POST /api/buildings/:buildingId/graph/nodes
export async function createNode(req, res, next) {
  try {
    const { buildingId } = req.params;
    const { floor, x, y, type, connectorId = null, label = null } = req.body;

    const newNode = {
      buildingId,
      floor: Number(floor),
      x,
      y,
      type,
      connectorId,
      label,
    };

    const insertedId = await mongoRepo.insertOne("nodes", newNode);

    res.status(201).json(formatNode({ _id: insertedId, ...newNode }));
  } catch (err) {
    next(err);
  }
}

// 3. עדכון צומת קיים: PUT /api/buildings/:buildingId/graph/nodes/:nodeId
export async function updateNode(req, res, next) {
  try {
    const { buildingId, nodeId } = req.params;

    if (!ObjectId.isValid(nodeId)) {
      throw { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" };
    }

    const _id = new ObjectId(nodeId);
    const existingNode = await mongoRepo.findOne("nodes", { _id, buildingId });

    if (!existingNode) {
      throw { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" };
    }

    // בדיקה שאם הצומת הופך למדרגות/מעלית, יש לו connectorId
    const targetType = req.body.type ?? existingNode.type;
    const targetConnector =
      req.body.connectorId !== undefined
        ? req.body.connectorId
        : existingNode.connectorId;

    if (
      (targetType === "stairs" || targetType === "elevator") &&
      !targetConnector
    ) {
      throw {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "connectorId is required for stairs and elevator nodes",
      };
    }

    await mongoRepo.updateOne("nodes", { _id }, { $set: req.body });

    // אם הקואורדינטות x או y השתנו - מחשבים מחדש את אורך הקשתות שמחוברות לצומת
    const coordsChanged =
      (req.body.x !== undefined && req.body.x !== existingNode.x) ||
      (req.body.y !== undefined && req.body.y !== existingNode.y);

    if (coordsChanged) {
      await updateEdgeLengths(nodeId);
    }

    const updatedNode = await mongoRepo.findOne("nodes", { _id, buildingId });
    res.status(200).json(formatNode(updatedNode));
  } catch (err) {
    next(err);
  }
}

// 4. מחיקת צומת: DELETE /api/buildings/:buildingId/graph/nodes/:nodeId
export async function deleteNode(req, res, next) {
  try {
    const { buildingId, nodeId } = req.params;

    if (!ObjectId.isValid(nodeId)) {
      throw { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" };
    }

    const _id = new ObjectId(nodeId);
    const existingNode = await mongoRepo.findOne("nodes", { _id, buildingId });

    if (!existingNode) {
      throw { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" };
    }

    // א. בודקים אם הצומת הזה משמש כצומת כניסה (entryNodeId) של מקום כלשהו
    const placeUsingNode = await mongoRepo.findOne("places", {
      buildingId,
      entryNodeId: nodeId,
    });

    if (placeUsingNode) {
      throw {
        status: 409,
        code: "NODE_IN_USE",
        message: "Cannot delete an entrance node that belongs to a place",
      };
    }

    // ב. מוחקים קודם את כל הקשתות שמחוברות לצומת הזה
    await mongoRepo.deleteMany("edges", {
      $or: [{ from: nodeId }, { to: nodeId }],
    });

    // ג. מוחקים את הצומת עצמו
    await mongoRepo.deleteOne("nodes", { _id });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// 5. יצירת קשת (חיבור שני צמתים): POST /api/buildings/:buildingId/graph/edges
export async function createEdge(req, res, next) {
  try {
    const { buildingId } = req.params;
    const { from, to } = req.body;

    // א. אסור לחבר צומת לעצמו
    if (from === to) {
      throw {
        status: 400,
        code: "INVALID_EDGE",
        message: "Cannot connect a node to itself",
      };
    }

    // ב. בדיקה ששני הצמתים תקינים וקיימים באותו מבנה
    if (!ObjectId.isValid(from) || !ObjectId.isValid(to)) {
      throw { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" };
    }

    const fromNode = await mongoRepo.findOne("nodes", {
      _id: new ObjectId(from),
      buildingId,
    });
    const toNode = await mongoRepo.findOne("nodes", {
      _id: new ObjectId(to),
      buildingId,
    });

    if (!fromNode || !toNode) {
      throw { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" };
    }

    // ג. בדיקה ששני הצמתים נמצאים באותה קומה
    if (fromNode.floor !== toNode.floor) {
      throw {
        status: 400,
        code: "DIFFERENT_FLOORS",
        message: "Cannot connect nodes on different floors",
      };
    }

    // ד. בדיקה שלא קיימת כבר קשת ביניהם (בשני הכיוונים: A->B או B->A)
    const existingEdge = await mongoRepo.findOne("edges", {
      buildingId,
      $or: [
        { from, to },
        { from: to, to: from },
      ],
    });

    if (existingEdge) {
      throw {
        status: 409,
        code: "EDGE_EXISTS",
        message: "An edge between these nodes already exists",
      };
    }

    // ה. חישוב אורך הקשת לפי המרחק בין שני הצמתים
    const length =
      Math.round(Math.hypot(fromNode.x - toNode.x, fromNode.y - toNode.y) * 100) /
      100;

    const newEdge = {
      buildingId,
      from,
      to,
      length,
      blocked: false,
    };

    const insertedId = await mongoRepo.insertOne("edges", newEdge);

    res.status(201).json(formatEdge({ _id: insertedId, ...newEdge }));
  } catch (err) {
    next(err);
  }
}

// 6. חסימה או פתיחה של קשת: PATCH /api/buildings/:buildingId/graph/edges/:edgeId
export async function patchEdge(req, res, next) {
  try {
    const { buildingId, edgeId } = req.params;
    const { blocked } = req.body;

    if (!ObjectId.isValid(edgeId)) {
      throw { status: 404, code: "EDGE_NOT_FOUND", message: "Edge not found" };
    }

    const _id = new ObjectId(edgeId);
    const existingEdge = await mongoRepo.findOne("edges", { _id, buildingId });

    if (!existingEdge) {
      throw { status: 404, code: "EDGE_NOT_FOUND", message: "Edge not found" };
    }

    await mongoRepo.updateOne("edges", { _id }, { $set: { blocked } });

    const updatedEdge = await mongoRepo.findOne("edges", { _id, buildingId });
    res.status(200).json(formatEdge(updatedEdge));
  } catch (err) {
    next(err);
  }
}

// 7. מחיקת קשת: DELETE /api/buildings/:buildingId/graph/edges/:edgeId
export async function deleteEdge(req, res, next) {
  try {
    const { buildingId, edgeId } = req.params;

    if (!ObjectId.isValid(edgeId)) {
      throw { status: 404, code: "EDGE_NOT_FOUND", message: "Edge not found" };
    }

    const _id = new ObjectId(edgeId);
    const existingEdge = await mongoRepo.findOne("edges", { _id, buildingId });

    if (!existingEdge) {
      throw { status: 404, code: "EDGE_NOT_FOUND", message: "Edge not found" };
    }

    await mongoRepo.deleteOne("edges", { _id });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
