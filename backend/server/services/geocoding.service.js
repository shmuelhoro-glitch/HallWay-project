let lastRequestTime = 0;

export async function geocodeAddress(address, city) {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 1000) {
    const waitTime = 1000 - timeSinceLast;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();

  const fullQuery = `${address}, ${city}, Israel`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`;

  // The codes let the client show its own message for each case
  const unavailable = {
    status: 502,
    code: "GEOCODING_UNAVAILABLE",
    message: "Failed to communicate with the geocoding service.",
  };

  let response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "InRoute-IndoorNavigation/1.0",
        "Accept-Language": "en,he",
      },
    });
  } catch {
    // No answer at all: the service is down, or our server has no way out to the internet
    throw unavailable;
  }

  if (!response.ok) {
    throw unavailable;
  }

  const results = await response.json();

  if (!results || results.length === 0) {
    throw {
      status: 400,
      code: "ADDRESS_NOT_FOUND",
      message: "Address not found. Please check the address and city.",
    };
  }

  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
  };
}