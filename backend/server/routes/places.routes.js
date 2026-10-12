import { Router } from "express";

import { getPlaces, createPlace, updatePlace, deletePlace } from "../controllers/places.controller.js";
import { verifyToken } from "../middleware/authentication.js";
import { requireRole } from "../middleware/authentication.js";
import { validateRequest } from "../middleware/validation.js";
import {
  createPlaceSchema,
  updatePlaceSchema,
} from "../schemas/places.schemas.js";

const router = Router({ mergeParams: true });

router.get("/", getPlaces);

router.post(
  "/",
  verifyToken,
  requireRole(["admin"]),
  validateRequest(createPlaceSchema),
  createPlace,
);

router.put(
  "/:placeId",
  verifyToken,
  requireRole(["admin"]),
  validateRequest(updatePlaceSchema),
  updatePlace,
);

router.delete("/:placeId", verifyToken, requireRole(["admin"]), deletePlace);

export default router;
