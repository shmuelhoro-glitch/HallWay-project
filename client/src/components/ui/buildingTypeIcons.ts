import type { BuildingType } from '../../types/building';

// The drawing of each building type, in one place.
// The map markers (Leaflet, plain HTML) and BuildingTypeIcon (React) both use these,
// so a change here changes the icon everywhere. Our own constants - never user text.
export const BUILDING_TYPE_PATHS: Record<BuildingType, string> = {
  // A house shape with a door
  mall: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>',

  // A building with a medical cross and a door
  hospital:
    '<path d="M3 21h18"/>' +
    '<path d="M5 21V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v16"/>' +
    '<path d="M12 7v6M9 10h6"/>' +
    '<path d="M10 21v-4h4v4"/>',

  // A graduation cap
  campus: '<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/>',

  // A tall building with windows
  office: '<path d="M3 21h18"/><path d="M6 21V3h12v18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',

  // A map pin
  other:
    '<path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z"/>' +
    '<circle cx="12" cy="9.8" r="2.3"/>',
};

export function getBuildingTypePaths(type: string): string {
  return BUILDING_TYPE_PATHS[type as BuildingType] ?? BUILDING_TYPE_PATHS.other;
}
