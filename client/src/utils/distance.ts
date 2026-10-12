import type { Building } from '../types/building';

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// The database may send numbers as strings, so we convert them here once
export function getBuildingPoint(building: Building): LatLng {
  return { lat: Number(building.lat), lng: Number(building.lng) };
}

// Straight-line distance between two points on Earth, in km (the "haversine" formula)
export function getDistanceKm(from: LatLng, to: LatLng): number {
  const latDiff = toRadians(to.lat - from.lat);
  const lngDiff = toRadians(to.lng - from.lng);

  const a =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lngDiff / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// 0.348 -> "350 m" | 2.46 -> "2.5 km" | 37.2 -> "37 km"
export function formatDistance(km: number): string {
  if (km < 1) {
    const meters = Math.round((km * 1000) / 10) * 10;
    return `${meters} m`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}
