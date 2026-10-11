import { API_URL, apiRequest } from './client';
import type { Building, BuildingDetails, BuildingType } from '../types/building';

export interface BuildingFilters {
  city?: string;
  type?: BuildingType;
}

export function getBuildings(filters: BuildingFilters = {}): Promise<Building[]> {
  const params = new URLSearchParams();

  if (filters.city) {
    params.set('city', filters.city);
  }
  if (filters.type) {
    params.set('type', filters.type);
  }

  const query = params.toString();
  const path = query ? `/api/buildings?${query}` : '/api/buildings';

  return apiRequest<Building[]>(path);
}

export function getBuildingById(buildingId: string): Promise<BuildingDetails> {
  return apiRequest<BuildingDetails>(`/api/buildings/${buildingId}`);
}

// The floor plan is shown inside <image>, so we only need its URL
export function getPlanUrl(buildingId: string, floor: number): string {
  return `${API_URL}/api/buildings/${buildingId}/floors/${floor}/plan.svg`;
}
