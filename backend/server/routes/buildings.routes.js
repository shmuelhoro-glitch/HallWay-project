import { verifyToken, requireBuildingAccess, requireManager } from "../middleware/authentication.js";
import { validateRequest } from "../middleware/validation.js";
import { createBuildingSchema, addFloorSchema } from "../schemas/buildings.schemas.js";
import { createBuilding, getFloorPlan, getMyBuildings } from "../controllers/buildings.controller.js";
import { addFloor } from "../controllers/buildings.controller.js";

import { Router } from "express";
import { getAllBuildings, getBuildingById } from "../controllers/buildings.controller.js";

const router = Router()

router.get("/", getAllBuildings)

// Before /:buildingId, so "mine" is not read as a building id
router.get('/mine', verifyToken, requireManager, getMyBuildings)

router.get('/:buildingId', getBuildingById)

router.post('/', verifyToken, requireManager, validateRequest(createBuildingSchema), createBuilding )

router.get('/:buildingId/floors/:floor/plan.svg', getFloorPlan)

router.post('/:buildingId/floors', verifyToken, requireBuildingAccess, validateRequest(addFloorSchema), addFloor)

// router.post('/:buildingId/admins')

export default router
