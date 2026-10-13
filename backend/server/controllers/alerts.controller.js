import { supabaseRepo } from "../repositories/sqlRepo.js";
import {
  triggerBuildingAlert,
  endBuildingAlert,
  getActiveAlertForBuilding,
} from "../services/alerts.service.js";

// POST /api/alerts/simulate
export async function simulateAlert(req, res, next) {
  try {
    const { buildingId, title, category, countdown } = req.body;

    const building = await supabaseRepo.findOne("buildings", { id: buildingId });
    if (!building) {
      throw { status: 404, code: "BUILDING_NOT_FOUND", message: "Building not found" };
    }

    const alert = await triggerBuildingAlert({
      buildingId,
      title: title || "ירי רקטות וטילים",
      category: category || "rockets",
      countdown: countdown || 60,
      isSimulation: true,
    });

    res.status(200).json({
      success: true,
      message: `Alert triggered for building ${building.name}`,
      alert: {
        title: alert.title,
        category: alert.category,
        countdown: alert.countdown,
        isSimulation: true,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/alerts/stop
export async function stopAlert(req, res, next) {
  try {
    const { buildingId } = req.body;
    await endBuildingAlert(buildingId);
    res.status(200).json({ success: true, message: "Alert stopped" });
  } catch (err) {
    next(err);
  }
}

// GET /api/alerts/active/:buildingId
export async function getActiveAlert(req, res, next) {
  try {
    const { buildingId } = req.params;
    const alert = getActiveAlertForBuilding(buildingId);
    if (!alert) {
      return res.status(200).json({ active: false, alert: null });
    }

    const elapsedSeconds = Math.floor((Date.now() - alert.startedAt) / 1000);
    const remainingCountdown = Math.max(0, alert.countdown - elapsedSeconds);

    res.status(200).json({
      active: true,
      alert: {
        title: alert.title,
        category: alert.category,
        countdown: remainingCountdown,
        isSimulation: alert.isSimulation,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/alerts/areas
export async function getAlertAreas(req, res, next) {
  try {
    const buildings = await supabaseRepo.findMany("buildings");
    const areas = [...new Set((buildings || []).map((b) => b.alert_area || b.city).filter(Boolean))];
    res.status(200).json({ areas });
  } catch (err) {
    next(err);
  }
}
