import { Router } from "express";
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
router.post("/simulate", validateRequest(simulateAlertSchema), simulateAlert);
router.post("/stop", validateRequest(stopAlertSchema), stopAlert);

export default router;