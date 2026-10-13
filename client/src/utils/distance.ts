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

// 0.348 -> "350 מ׳" | 2.46 -> "2.5 ק״מ" | 37.2 -> "37 ק״מ"
export function formatDistance(km: number): string {
  if (km < 1) {
    const meters = Math.round((km * 1000) / 10) * 10;
    return `${meters} מ׳`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} ק״מ`;
  }
  return `${Math.round(km)} ק״מ`;
}

// 150 meters: default threshold to determine the visitor is inside / at the building
export const AUTO_ENTER_RADIUS_KM = 0.15;

export interface NearbyBuildingMatch {
  building: Building;
  distanceKm: number;
}

export function findClosestBuildingWithinRadius(
  userPoint: LatLng,
  buildings: Building[],
  maxRadiusKm: number = AUTO_ENTER_RADIUS_KM
): NearbyBuildingMatch | null {
  let closest: NearbyBuildingMatch | null = null;

  for (const building of buildings) {
    const point = getBuildingPoint(building);
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    const distanceKm = getDistanceKm(userPoint, point);
    if (distanceKm <= maxRadiusKm) {
      if (!closest || distanceKm < closest.distanceKm) {
        closest = { building, distanceKm };
      }
    }
  }

  return closest;
}

