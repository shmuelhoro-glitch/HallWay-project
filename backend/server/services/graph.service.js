import { ObjectId } from "mongodb";
import { mongoRepo } from "../repositories/mongoRepo.js";

export async function updateEdgeLengths(nodeId) {
  const idStr = String(nodeId);

  // 1. מביאים את כל הקשתות שהצומת הזה נמצא בקצה שלהן (from או to)
  const edges = await mongoRepo.findMany("edges", {
    $or: [{ from: idStr }, { to: idStr }],
  });

  // 2. עוברים קשת-קשת ומחשבים מחדש את המרחק בין שני הצמתים שלה
  for (const edge of edges) {
    const fromNode = await mongoRepo.findOne("nodes", {
      _id: new ObjectId(edge.from),
    });
    const toNode = await mongoRepo.findOne("nodes", {
      _id: new ObjectId(edge.to),
    });

    if (fromNode && toNode) {
      const dx = fromNode.x - toNode.x;
      const dy = fromNode.y - toNode.y;
      const length = Math.round(Math.hypot(dx, dy) * 100) / 100;

      await mongoRepo.updateOne(
        "edges",
        { _id: edge._id },
        { $set: { length } }
      );
    }
  }
}