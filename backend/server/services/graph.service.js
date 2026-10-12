import { ObjectId } from "mongodb";
import { mongoRepo } from "../repositories/mongoRepo.js";

// Helpers for the walking graph, used by places.controller and graph.controller.
// Remember: edges save "from" and "to" as strings, not ObjectId.

// Some changes are saved in two steps (a place + its entrance node, a new point + its walkway),
// and MongoDB does not undo the first step when the second one fails. So we undo it ourselves.
// If the undo fails too, we can only write it in the log. The client still gets the first error.
export async function undo(description, step) {
  try {
    await step();
  } catch (undoError) {
    console.error(`Could not undo: ${description}`, undoError);
  }
}

// The length of a walkway = the straight line between its two nodes, 2 digits after the point
export function computeLength(a, b) {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 100) / 100;
}

// All the walkways that touch a node, in either direction
function edgesOfNodeQuery(nodeId) {
  return { $or: [{ from: nodeId }, { to: nodeId }] };
}

export async function deleteEdgesOfNode(nodeId) {
  await mongoRepo.deleteMany("edges", edgesOfNodeQuery(nodeId));
}

// After a node moved: every walkway that touches it gets its new length
export async function updateEdgeLengths(nodeId) {
  const edges = await mongoRepo.findMany("edges", edgesOfNodeQuery(nodeId));

  for (const edge of edges) {
    const a = await mongoRepo.findOne("nodes", { _id: new ObjectId(edge.from) });
    const b = await mongoRepo.findOne("nodes", { _id: new ObjectId(edge.to) });
    if (!a || !b) continue;

    await mongoRepo.updateOne("edges", { _id: edge._id }, { $set: { length: computeLength(a, b) } });
  }
}

// What the client gets. "id" instead of "_id", always as a string.
export function toNodeResponse(node) {
  return {
    id: String(node._id),
    floor: node.floor,
    x: node.x,
    y: node.y,
    type: node.type,
    connectorId: node.connectorId ?? null,
    label: node.label ?? "",
  };
}

export function toEdgeResponse(edge) {
  return {
    id: String(edge._id),
    from: edge.from,
    to: edge.to,
    length: edge.length,
    blocked: edge.blocked === true,
  };
}
