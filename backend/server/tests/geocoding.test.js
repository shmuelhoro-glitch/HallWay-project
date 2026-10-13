import { beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { geocodeAddress } from "../services/geocoding.service.js";

// Finding a building on the map from its address. Nominatim itself is never called here:
// fetch is replaced, and so is the clock (the service waits a second between two requests).

mock.timers.enable({ apis: ["Date"], now: 1_000_000 });

function answerWith(response) {
  return mock.method(globalThis, "fetch", async () => response);
}

async function failureOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("Expected geocodeAddress to fail");
}

beforeEach(() => {
  mock.timers.tick(5000); // far enough from the request of the test before
});

test("the first result of Nominatim becomes lat and lng, as numbers", async () => {
  const fetchMock = answerWith({ ok: true, json: async () => [{ lat: "32.0853", lon: "34.7818" }] });

  const point = await geocodeAddress("הרברט סמואל 1", "תל אביב");

  assert.deepEqual(point, { lat: 32.0853, lng: 34.7818 });

  // The address and the city are sent together, safe inside the URL
  const url = new URL(fetchMock.mock.calls[0].arguments[0]);
  assert.equal(url.hostname, "nominatim.openstreetmap.org");
  assert.equal(url.searchParams.get("q"), "הרברט סמואל 1, תל אביב, Israel");
});

test("an address that Nominatim does not know is ADDRESS_NOT_FOUND", async () => {
  answerWith({ ok: true, json: async () => [] });

  const error = await failureOf(geocodeAddress("אין רחוב כזה 999", "שום מקום"));

  assert.equal(error.status, 400);
  assert.equal(error.code, "ADDRESS_NOT_FOUND");
});

test("a bad answer from Nominatim is GEOCODING_UNAVAILABLE", async () => {
  answerWith({ ok: false, status: 503 });

  const error = await failureOf(geocodeAddress("הרצל 1", "חיפה"));

  assert.equal(error.status, 502);
  assert.equal(error.code, "GEOCODING_UNAVAILABLE");
});

test("no answer at all (the network is down) is GEOCODING_UNAVAILABLE too, not a server bug", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fetch failed");
  });

  const error = await failureOf(geocodeAddress("הרצל 1", "חיפה"));

  assert.equal(error.status, 502);
  assert.equal(error.code, "GEOCODING_UNAVAILABLE");
});
