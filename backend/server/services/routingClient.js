// The only place that talks to the Python routing service.
// The URL and the shared secret come from .env (on Render: from the dashboard).

// On Render's free plan a sleeping service needs up to ~30 seconds to wake up
const ROUTING_TIMEOUT_MS = 30000;

export async function callRoutingService(path, body) {
  let response;

  try {
    response = await fetch(process.env.ROUTING_URL + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": process.env.INTERNAL_API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ROUTING_TIMEOUT_MS),
    });
  } catch {
    // The service is down, or didn't answer in time
    throw { status: 503, code: "ROUTING_UNAVAILABLE", message: "Routing service is not available" };
  }

  if (response.status === 404) {
    throw { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" };
  }
  if (!response.ok) {
    console.error("Routing service answered", response.status);
    throw { status: 502, code: "ROUTING_ERROR", message: "Routing service failed" };
  }

  return response.json();
}

// Called when a visitor opens a building: if the routing service is asleep,
// it starts waking up now, and is ready by the time the visitor picks a destination.
// No await and no error: it's only a "hello".
export function wakeRoutingService() {
  fetch(process.env.ROUTING_URL + "/health").catch(() => {});
}
