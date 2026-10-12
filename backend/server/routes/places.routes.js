import { Router } from "express"
import { verifyToken, requireRole } from "../middleware/authentication.js";
import { validateRequest } from "../middleware/validation.js";
import { createPlaceSchema, updatePlaceSchema } from "../schemas/places.schemas.js";
import { createPlace, deletePlace, getPlaces, updatePlace } from "../controllers/places.controller.js";

// mergeParams: gives us :buildingId from the path in server.js
const router = Router({ mergeParams: true })

const adminOnly = [verifyToken, requireRole(["admin"])]

router.get("/", getPlaces);

router.post("/", adminOnly, validateRequest(createPlaceSchema), createPlace);

router.put("/:placeId", adminOnly, validateRequest(updatePlaceSchema), updatePlace);

router.delete("/:placeId", adminOnly, deletePlace);

export default router
