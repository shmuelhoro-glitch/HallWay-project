import { Router } from "express";
import { validateRequest } from "../middleware/validation.js";
import { routeSchema, shelterSchema } from "../schemas/navigation.schemas.js";
import { getNearestShelter, getNode, getRoute } from "../controllers/navigation.controller.js";

const router = Router()

// Open to everyone: a visitor doesn't need to log in to navigate
router.get('/nodes/:nodeId', getNode);

router.post('/route', validateRequest(routeSchema), getRoute);

router.post('/nearest-shelter', validateRequest(shelterSchema), getNearestShelter);

export default router
