import { useEffect, useState } from 'react';

export interface UserPosition {
  lat: number;
  lng: number;
  accuracy: number; // in meters: how sure the device is
}

// locating    - waiting for the device
// found       - we have a position
// denied      - the user (or the browser settings) blocked location
// unavailable - the device could not find a position (no GPS, timeout)
// insecure    - the page is on plain http, so the browser does not allow location at all
export type LocationStatus = 'locating' | 'found' | 'denied' | 'unavailable' | 'insecure';

// The browser gives the location only on https or on localhost
function canAskForLocation(): boolean {
  return window.isSecureContext && 'geolocation' in navigator;
}

const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000, // give up after 10 seconds
  maximumAge: 60000, // a position from the last minute is good enough
};

// Only while developing: ?mock_lat=..&mock_lng=.. puts the visitor at that spot, to try
// "near a building" without going there. On the real site a link must not decide where a visitor is.
function readMockPosition(): UserPosition | null {
  if (!import.meta.env.DEV) return null;

  const searchParams = new URLSearchParams(window.location.search);
  const lat = parseFloat(searchParams.get('mock_lat') ?? '');
  const lng = parseFloat(searchParams.get('mock_lng') ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng, accuracy: 10 };
}

// Asks the device where the user is: once when the page opens, and again on every locate()
export function useUserLocation() {
  const [mockPosition] = useState(readMockPosition);

  const [position, setPosition] = useState<UserPosition | null>(mockPosition);
  const [status, setStatus] = useState<LocationStatus>(() => {
    if (mockPosition) return 'found';
    return canAskForLocation() ? 'locating' : 'insecure';
  });

  // Every press on "locate me" adds 1, and that runs the effect again
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (mockPosition || !canAskForLocation()) return;

    let isCancelled = false;

    navigator.geolocation.getCurrentPosition(
      (result) => {
        if (isCancelled) return;
        // A new object every time, so the map knows to fly to it again
        setPosition({
          lat: result.coords.latitude,
          lng: result.coords.longitude,
          accuracy: result.coords.accuracy,
        });
        setStatus('found');
      },
      (error) => {
        if (isCancelled) return;
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      LOCATION_OPTIONS,
    );

    return () => {
      isCancelled = true;
    };
  }, [attempt, mockPosition]);

  function locate() {
    if (mockPosition || !canAskForLocation()) return;
    setStatus('locating');
    setAttempt((current) => current + 1);
  }

  return { position, status, locate };
}
