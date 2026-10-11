import { verifyToken, requireRole } from "../middleware/authentication.js";
import { validateRequest } from "../middleware/validation.js";
import { createBuildingSchema, addFloorSchema } from "../schemas/buildings.schemas.js";
import { createBuilding } from "../controllers/buildings.controller.js";
import { addFloor } from "../controllers/buildings.controller.js";

import { Router } from "express";
import { getAllBuildings, getBuildingById } from "../controllers/buildings.controller.js";

const router = Router()

router.get("/", getAllBuildings)

router.get('/:buildingId', getBuildingById)

router.post('/', verifyToken, requireRole(["admin"]), validateRequest(createBuildingSchema), createBuilding )

router.post('/:buildingId/floors', verifyToken, requireRole(["admin"]), validateRequest(addFloorSchema), addFloor)

// router.post('/:buildingId/admins')

export default router