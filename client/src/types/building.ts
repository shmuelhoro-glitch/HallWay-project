// The same list as the server's createBuildingSchema
export type BuildingType = 'mall' | 'hospital' | 'campus' | 'office' | 'other';

export interface Building {
  id: string;
  name: string;
  type: BuildingType;
  address: string;
  city: string;
  lat: number;
  lng: number;
  floors_count: number;
}

// One floor as returned by GET /api/buildings/:buildingId (without the SVG itself)
export interface Floor {
  floor: number;
  name: string;
  width: number;
  height: number;
}

export interface BuildingDetails extends Building {
  floors: Floor[];
}

export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  mall: 'Mall',
  hospital: 'Hospital',
  campus: 'Campus',
  office: 'Office',
  other: 'Other',
};
