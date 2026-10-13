import { supabaseRepo } from "../repositories/sqlRepo.js";
import { broadcastToBuilding } from "../sockets/chat.socket.js";

// Active alerts per building: buildingId -> { title, category, countdown, startedAt, timeoutId, alertRecordId, isSimulation }
const activeAlerts = new Map();

/**
 * Triggers an emergency alert for a building and broadcasts it via Socket.IO
 */
export async function triggerBuildingAlert({
  buildingId,
  title = "ירי רקטות וטילים",
  category = "rockets",
  countdown = 60,
  isSimulation = false,
}) {
  const existing = activeAlerts.get(buildingId);
  if (existing?.timeoutId) {
    clearTimeout(existing.timeoutId);
  }

  let alertRecordId = existing?.alertRecordId || null;
  try {
    const record = await supabaseRepo.insertOne("alerts", {
      building_id: buildingId,
      title,
      category,
      is_simulation: isSimulation,
      started_at: new Date().toISOString(),
    });
    alertRecordId = record?.id;
  } catch (err) {
    console.error("[Alerts Service] Failed to insert alert record:", err.message);
  }

  // Broadcast to building room in Socket.IO
  broadcastToBuilding(buildingId, "alert:start", {
    title,
    category,
    countdown,
  });

  // Automatically end the alert after countdown seconds
  const timeoutId = setTimeout(async () => {
    await endBuildingAlert(buildingId);
  }, countdown * 1000);

  const alertData = {
    title,
    category,
    countdown,
    startedAt: Date.now(),
    timeoutId,
    alertRecordId,
    isSimulation,
  };

  activeAlerts.set(buildingId, alertData);
  return alertData;
}

/**
 * Ends an active alert for a building and broadcasts alert:end via Socket.IO
 */
export async function endBuildingAlert(buildingId) {
  const alertData = activeAlerts.get(buildingId);
  if (alertData?.timeoutId) {
    clearTimeout(alertData.timeoutId);
  }

  if (alertData?.alertRecordId) {
    try {
      await supabaseRepo.updateOne(
        "alerts",
        { id: alertData.alertRecordId },
        { ended_at: new Date().toISOString() }
      );
    } catch (err) {
      console.error("[Alerts Service] Failed to update alert ended_at:", err.message);
    }
  }

  activeAlerts.delete(buildingId);

  // Broadcast alert:end
  broadcastToBuilding(buildingId, "alert:end", {});
  return { buildingId, ended: true };
}

/**
 * Returns the currently active alert for a building, or null
 */
export function getActiveAlertForBuilding(buildingId) {
  return activeAlerts.get(buildingId) || null;
}

/**
 * Returns all currently active alerts
 */
export function getAllActiveAlerts() {
  return Array.from(activeAlerts.entries()).map(([buildingId, alert]) => ({
    buildingId,
    ...alert,
  }));
}

/**
 * Reset all in-memory alerts (used in tests)
 */
export function resetAlertsState() {
  for (const [, alert] of activeAlerts) {
    if (alert.timeoutId) clearTimeout(alert.timeoutId);
  }
  activeAlerts.clear();
}

/**
 * Live Alert Poller querying Tzofar (tzevaadom.co.il)
 */
let pollerInterval = null;
const TZEVAADOM_URL = "https://api.tzevaadom.co.il/notifications";

export async function checkLiveAlerts() {
  try {
    const res = await fetch(TZEVAADOM_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "inRoute-Emergency-Monitor/1.0",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return;

    const notifications = await res.json();
    if (!Array.isArray(notifications) || notifications.length === 0) return;

    const buildings = await supabaseRepo.findMany("buildings");
    if (!buildings || buildings.length === 0) return;

    for (const notif of notifications) {
      const alertCities = notif.cities || [];
      if (!Array.isArray(alertCities) || alertCities.length === 0) continue;

      for (const building of buildings) {
        if (activeAlerts.has(building.id)) continue;

        const cityClean = String(building.city || "").trim();
        const areaClean = String(building.alert_area || "").trim();

        const matches = alertCities.some((c) => {
          const cClean = String(c).trim();
          return (
            (cityClean && (cClean.includes(cityClean) || cityClean.includes(cClean))) ||
            (areaClean && (cClean.includes(areaClean) || areaClean.includes(cClean)))
          );
        });

        if (matches) {
          console.log(`[Alerts Service] Live alert matched building "${building.name}" in "${building.city}"`);
          await triggerBuildingAlert({
            buildingId: building.id,
            title: "ירי רקטות וטילים",
            category: "rockets",
            countdown: 60,
            isSimulation: false,
          });
        }
      }
    }
  } catch {
    // Network / timeout error: silently ignored so server never crashes
  }
}

export function startAlertPoller(intervalMs = 4000) {
  if (pollerInterval) return;
  checkLiveAlerts().catch(() => {});
  pollerInterval = setInterval(() => {
    checkLiveAlerts().catch(() => {});
  }, intervalMs);
  console.log("[Alerts Service] Live alert poller active");
}

export function stopAlertPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[Alerts Service] Live alert poller stopped");
  }
}
