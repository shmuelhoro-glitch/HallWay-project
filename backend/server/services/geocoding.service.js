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

  const response = await fetch(url, {
    headers: {
      "User-Agent": "InRoute-IndoorNavigation/1.0",
      "Accept-Language": "en,he",
    },
  });

  if (!response.ok) {
    throw {
      status: 502,
      message: "Failed to communicate with the geocoding service.",
    };
  }

  const results = await response.json();

  if (!results || results.length === 0) {
    throw {
      status: 400,
      message: "Address not found. Please check the address and city.",
    };
  }

  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
  };
}