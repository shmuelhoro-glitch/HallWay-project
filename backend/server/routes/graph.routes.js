import { Router } from "express";
import { verifyToken, requireBuildingAccess } from "../middleware/authentication.js";
import { validateRequest } from "../middleware/validation.js";
import {
  createEdgeSchema,
  createNodeSchema,
  graphQuerySchema,
  updateEdgeSchema,
  updateNodeSchema,
} from "../schemas/graph.schemas.js";
import {
  createEdge,
  createNode,
  deleteEdge,
  deleteNode,
  getGraph,
  updateEdge,
  updateNode,
} from "../controllers/graph.controller.js";

const router = Router({ mergeParams: true })

// Everything here is for the managers of this building only
router.use(verifyToken, requireBuildingAccess)

router.get('/', validateRequest(graphQuerySchema), getGraph)

router.post('/nodes', validateRequest(createNodeSchema), createNode)

router.put('/nodes/:nodeId', validateRequest(updateNodeSchema), updateNode)

router.delete('/nodes/:nodeId', deleteNode)

router.post('/edges', validateRequest(createEdgeSchema), createEdge)

router.patch('/edges/:edgeId', validateRequest(updateEdgeSchema), updateEdge)

router.delete('/edges/:edgeId', deleteEdge)

export default router
