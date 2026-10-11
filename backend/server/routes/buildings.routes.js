import { Router } from "express";
import { getAllBuildings, getBuildingById } from "../controllers/buildings.controller.js";

const router = Router()

router.get("/", getAllBuildings)

router.get('/:buildingId', getBuildingById)

// router.post('/')

// router.post('/:buildingId/floors')

// router.post('/:buildingId/admins')

export default router