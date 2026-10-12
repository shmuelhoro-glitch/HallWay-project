import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/authentication.js";
import { validateRequest } from "../middleware/validation.js";
import {
  getGraphSchema,
  createNodeSchema,
  updateNodeSchema,
  createEdgeSchema,
  patchEdgeSchema,
} from "../schemas/graph.schemas.js";
import {
  getGraph,
  createNode,
  updateNode,
  deleteNode,
  createEdge,
  patchEdge,
  deleteEdge,
} from "../controllers/graph.controller.js";

const router = Router({ mergeParams: true });

router.use(verifyToken, requireRole(["admin"]));

router.get("/", validateRequest(getGraphSchema), getGraph);

router.post("/nodes", validateRequest(createNodeSchema), createNode);
router.put("/nodes/:nodeId", validateRequest(updateNodeSchema), updateNode);
router.delete("/nodes/:nodeId", deleteNode);

router.post("/edges", validateRequest(createEdgeSchema), createEdge);
router.patch("/edges/:edgeId", validateRequest(patchEdgeSchema), patchEdge);
router.delete("/edges/:edgeId", deleteEdge);

export default router;