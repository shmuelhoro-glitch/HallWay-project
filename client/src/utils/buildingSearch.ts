import type { Building, BuildingType } from '../types/building';
import { getBuildingPoint, getDistanceKm } from './distance';
import type { LatLng } from './distance';

// One search result: the building, and how far it is from the user (null = we don't know where the user is)
export interface BuildingResult {
  building: Building;
  distanceKm: number | null;
}

// Lowercase and single spaces, so "  tel   AVIV " finds "Tel Aviv"
function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

// How well a building matches the search. 0 = not a match, a bigger number = a better match.
// Every word must appear somewhere (name, city or address), so "mall haifa" works too.
function getMatchScore(building: Building, query: string): number {
  const name = normalize(building.name);
  const city = normalize(building.city);
  const address = normalize(building.address ?? '');
  const allText = `${name} ${city} ${address}`;

  const words = query.split(' ');
  const hasAllWords = words.every((word) => allText.includes(word));
  if (!hasAllWords) return 0;

  if (name.startsWith(query)) return 4;
  if (name.includes(query)) return 3;
  if (city.startsWith(query)) return 2;
  return 1;
}

// Filters by text and type, and sorts: best match first, then the closest to the user, then by name
export function searchBuildings(
  buildings: Building[],
  text: string,
  type: BuildingType | null,
  userPoint: LatLng | null,
): BuildingResult[] {
  const query = normalize(text);
  const matches: (BuildingResult & { score: number })[] = [];

  for (const building of buildings) {
    if (type !== null && building.type !== type) continue;

    // An empty search shows everything
    const score = query === '' ? 1 : getMatchScore(building, query);
    if (score === 0) continue;

    const distanceKm = userPoint ? getDistanceKm(userPoint, getBuildingPoint(building)) : null;
    matches.push({ building, distanceKm, score });
  }

  matches.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    return a.building.name.localeCompare(b.building.name);
  });

  return matches.map(({ building, distanceKm }) => ({ building, distanceKm }));
}
