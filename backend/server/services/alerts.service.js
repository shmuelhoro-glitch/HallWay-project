import { supabaseRepo } from "../repositories/sqlRepo.js";
import { broadcastToBuilding } from "../sockets/chat.socket.js";

// The alerts that are active now: buildingId -> { title, category, countdown, startedAt, timeoutId, alertRecordId, isSimulation }
// In memory only: a server that restarts in the middle of an alert forgets it.
const activeAlerts = new Map();

// Starts an alert in a building: everyone in the building gets alert:start, and after
// "countdown" seconds the alert ends by itself.
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

  // The history of the alerts. An alert must reach the visitors also when it can't be saved.
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

  // isSimulation: the visitors must be able to tell a drill from the real thing
  broadcastToBuilding(buildingId, "alert:start", { title, category, countdown, isSimulation });

  const timeoutId = setTimeout(() => {
    endBuildingAlert(buildingId);
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

// Ends the alert of a building: everyone in the building gets alert:end
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

  broadcastToBuilding(buildingId, "alert:end", {});
  return { buildingId, ended: true };
}

// The alert that is active in a building now, or null
export function getActiveAlertForBuilding(buildingId) {
  return activeAlerts.get(buildingId) || null;
}

// Forgets everything (for the tests)
export function resetAlertsState() {
  for (const alert of activeAlerts.values()) {
    if (alert.timeoutId) clearTimeout(alert.timeoutId);
  }
  activeAlerts.clear();
  handledNotifications.clear();
}

// ---------- Real alerts ----------
// The server asks "Tzofar" (tzevaadom.co.il) every few seconds. It is not the official service of
// the Home Front Command (that one answers only inside Israel, and our server is abroad), but it
// passes the same alerts on. An answer looks like:
//   [{ notificationId, time, threat, isDrill, cities: ["אשדוד - א,ב,ד,ה", ...] }]

const TZEVAADOM_URL = "https://api.tzevaadom.co.il/notifications";

// Only the threats where the instruction is to enter a protected space.
// For the others (an earthquake, for example) a route to a shelter is the wrong advice, so they are skipped.
const SHELTER_THREATS = {
  0: { title: "ירי רקטות וטילים", category: "rockets" },
  5: { title: "חדירת כלי טיס עוין", category: "aircraft" },
};

// A notification stays in the answers for a while. Each one starts an alert only once.
const handledNotifications = new Set();
const MAX_HANDLED = 500;

let pollerInterval = null;
let isSourceDown = false;

function clean(text) {
  return String(text ?? "").trim();
}

// Is this alert area the area of the building?
// The names must be the same. "יבנה" is not "גן יבנה", so a name inside another name is not enough.
// The one exception: a big city is split into parts ("חיפה - מערב"), and a building that only
// says "חיפה" belongs to all of them.
export function isBuildingInArea(building, alertCity) {
  const area = clean(alertCity);
  if (!area) return false;

  return [clean(building.alert_area), clean(building.city)]
    .filter(Boolean)
    .some((name) => area === name || area.startsWith(`${name} - `));
}

function notificationKey(notification) {
  return clean(notification.notificationId) || `${notification.time}|${notification.cities.join(",")}`;
}

function rememberNotification(key) {
  handledNotifications.add(key);
  if (handledNotifications.size > MAX_HANDLED) {
    handledNotifications.delete(handledNotifications.values().next().value); // the oldest one
  }
}

// One round: asks for the alerts of this moment and starts them in the buildings they reach
export async function checkLiveAlerts() {
  let notifications;
  try {
    const res = await fetch(TZEVAADOM_URL, {
      headers: { Accept: "application/json", "User-Agent": "inRoute-Emergency-Monitor/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    notifications = await res.json();

    if (isSourceDown) {
      console.log("[Alerts Service] The alert source answers again");
      isSourceDown = false;
    }
  } catch (err) {
    // Without real alerts the building is not protected, so this must be seen in the log -
    // once when it starts, not every few seconds
    if (!isSourceDown) {
      console.error("[Alerts Service] The alert source does not answer - no real alerts until it does:", err.message);
      isSourceDown = true;
    }
    return;
  }

  if (!Array.isArray(notifications)) return;

  const fresh = notifications.filter(
    (notification) =>
      Array.isArray(notification?.cities) &&
      notification.cities.length > 0 &&
      !handledNotifications.has(notificationKey(notification))
  );
  if (fresh.length === 0) return;

  try {
    const buildings = await supabaseRepo.findMany("buildings");

    for (const notification of fresh) {
      rememberNotification(notificationKey(notification));

      if (notification.isDrill) continue;
      // An alert that does not say what the threat is: better a route to a shelter than nothing
      const threat = notification.threat === undefined ? SHELTER_THREATS[0] : SHELTER_THREATS[notification.threat];
      if (!threat) continue;

      for (const building of buildings) {
        if (activeAlerts.has(building.id)) continue;
        if (!notification.cities.some((city) => isBuildingInArea(building, city))) continue;

        console.log(`[Alerts Service] Live alert in "${building.name}" (${building.city})`);
        await triggerBuildingAlert({ buildingId: building.id, ...threat, countdown: 60, isSimulation: false });
      }
    }
  } catch (err) {
    console.error("[Alerts Service] Could not start a live alert:", err.message);
  }
}

export function startAlertPoller(intervalMs = 4000) {
  if (pollerInterval) return;
  checkLiveAlerts();
  pollerInterval = setInterval(checkLiveAlerts, intervalMs);
  console.log("[Alerts Service] Live alert poller active");
}

export function stopAlertPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
}
