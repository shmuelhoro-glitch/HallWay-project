import { Router } from "express";
import { verifyToken, requireSuper } from "../middleware/authentication.js";
import { validateRequest } from "../middleware/validation.js";
import {
  simulateAlertSchema,
  stopAlertSchema,
  activeAlertSchema,
} from "../schemas/alerts.schemas.js";
import {
  simulateAlert,
  stopAlert,
  getActiveAlert,
  getAlertAreas,
} from "../controllers/alerts.controller.js";

const router = Router();

router.get("/areas", getAlertAreas);
router.get("/active/:buildingId", validateRequest(activeAlertSchema), getActiveAlert);

// A drill reaches every visitor in the building, so only we (the owners of the system) start and stop one
router.post("/simulate", verifyToken, requireSuper, validateRequest(simulateAlertSchema), simulateAlert);
router.post("/stop", verifyToken, requireSuper, validateRequest(stopAlertSchema), stopAlert);

export default router;
