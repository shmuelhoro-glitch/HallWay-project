import { verifyToken, requireBuildingAccess, requireManager } from "../middleware/authentication.js";
import { validateRequest } from "../middleware/validation.js";
import { createBuildingSchema, addFloorSchema, deleteBuildingSchema, geocodeSchema } from "../schemas/buildings.schemas.js";
import { createBuilding, deleteBuilding, geocodeBuildingAddress, getFloorPlan, getMyBuildings } from "../controllers/buildings.controller.js";
import { addFloor } from "../controllers/buildings.controller.js";

import { Router } from "express";
import { getAllBuildings, getBuildingById } from "../controllers/buildings.controller.js";

const router = Router()

router.get("/", getAllBuildings)

// Before /:buildingId, so "mine" is not read as a building id
router.get('/mine', verifyToken, requireManager, getMyBuildings)

router.get('/:buildingId', getBuildingById)

router.post('/', verifyToken, requireManager, validateRequest(createBuildingSchema), createBuilding )

router.post('/geocode', verifyToken, requireManager, validateRequest(geocodeSchema), geocodeBuildingAddress)

router.get('/:buildingId/floors/:floor/plan.svg', getFloorPlan)

router.post('/:buildingId/floors', verifyToken, requireBuildingAccess, validateRequest(addFloorSchema), addFloor)

// The building with everything in it: only a manager of this building, or a super
router.delete('/:buildingId', verifyToken, requireBuildingAccess, validateRequest(deleteBuildingSchema), deleteBuilding)

// router.post('/:buildingId/admins')

export default router
