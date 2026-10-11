import { apiRequest } from './client';
import type { Place, PlaceQuery } from '../types/place';

export function getPlaces(buildingId: string, query: PlaceQuery = {}): Promise<Place[]> {
  const params = new URLSearchParams();

  if (query.q) {
    params.set('q', query.q);
  }
  if (query.category) {
    params.set('category', query.category);
  }
  if (query.floor !== undefined) {
    params.set('floor', String(query.floor));
  }

  const queryString = params.toString();
  const path = queryString
    ? `/api/buildings/${buildingId}/places?${queryString}`
    : `/api/buildings/${buildingId}/places`;

  return apiRequest<Place[]>(path);
}
