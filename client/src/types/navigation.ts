// One point on a route, as returned by the routing service
export interface RouteNode {
  id: string;
  floor: number;
  x: number;
  y: number;
}

export interface RouteResult {
  path: RouteNode[] | null;
  length: number;
}

// Send toPlaceId when navigating to a place, toNodeId for "navigate to me"
export interface RouteRequest {
  buildingId: string;
  fromNodeId: string;
  toPlaceId?: string;
  toNodeId?: string;
  accessible?: boolean;
}

export interface ShelterRequest {
  buildingId: string;
  fromNodeId: string;
  accessible?: boolean;
}

// GET /api/navigation/nodes/:nodeId
export interface MapNode {
  id: string;
  buildingId: string;
  floor: number;
  x: number;
  y: number;
  label?: string;
}

// Where the visitor is standing right now
export interface StartPoint {
  nodeId: string;
  floor: number;
  x: number;
  y: number;
  label: string;
}

// Where the visitor wants to go
export interface Destination {
  label: string;
  placeId?: string;
  nodeId?: string;
}

export type RouteStatus = 'idle' | 'loading' | 'no-route' | 'error';
