import { ApiError, apiRequest } from './client';
import type { MapNode, RouteNode, RouteRequest, RouteResult, ShelterRequest } from '../types/navigation';

// Returns the path, or null when there is no route (for example, a blocked passage)
export async function getRoute(request: RouteRequest): Promise<RouteNode[] | null> {
  try {
    const result = await apiRequest<RouteResult>('/api/navigation/route', {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        accessible: Boolean(request.accessible),
      }),
    });

    if (!result.path || result.path.length === 0) {
      return null;
    }
    return result.path;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getNearestShelter(request: ShelterRequest): Promise<RouteNode[] | null> {
  try {
    const result = await apiRequest<RouteResult>('/api/navigation/nearest-shelter', {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        accessible: Boolean(request.accessible),
      }),
    });

    if (!result.path || result.path.length === 0) {
      return null;
    }
    return result.path;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// Used for ?node= from a QR code: we need the floor and x, y to show "You are here"
export function getNode(nodeId: string): Promise<MapNode> {
  return apiRequest<MapNode>(`/api/navigation/nodes/${nodeId}`);
}
