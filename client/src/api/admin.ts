import { API_URL, apiRequest } from './client';
import type { Building, BuildingType } from '../types/building';
import type { Place, PlaceType } from '../types/place';
import type { Graph, GraphEdge, GraphNode, NodeType } from '../types/graph';

// All the requests of the admin screens. apiRequest adds the token by itself.

// ---------- Buildings and floors ----------

export interface NewBuilding {
  name: string;
  type: BuildingType;
  address: string;
  city: string;
  alert_area: string;
  floors_count: number;
}

export function createBuilding(data: NewBuilding): Promise<Building> {
  return apiRequest<Building>('/api/buildings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface UploadedFloor {
  floor: number;
  name: string;
  width: number;
  height: number;
}

// The same floor number again = the plan of that floor is replaced
export function uploadFloor(buildingId: string, floor: number, name: string, svg: string): Promise<UploadedFloor> {
  return apiRequest<UploadedFloor>(`/api/buildings/${buildingId}/floors`, {
    method: 'POST',
    body: JSON.stringify({ floor, name, svg }),
  });
}

// ---------- Places ----------

export interface PlaceInput {
  floor: number;
  name: string;
  type: PlaceType;
  category: string;
  x: number;
  y: number;
  hours: string; // empty = no opening hours
  url: string; // empty = no link
  isLandmark: boolean;
}

export function createPlace(buildingId: string, input: PlaceInput): Promise<Place> {
  return apiRequest<Place>(`/api/buildings/${buildingId}/places`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Send only what changed
export function updatePlace(buildingId: string, placeId: string, changes: Partial<PlaceInput>): Promise<Place> {
  return apiRequest<Place>(`/api/buildings/${buildingId}/places/${placeId}`, {
    method: 'PUT',
    body: JSON.stringify(changes),
  });
}

export function deletePlace(buildingId: string, placeId: string): Promise<void> {
  return apiRequest<void>(`/api/buildings/${buildingId}/places/${placeId}`, { method: 'DELETE' });
}

// ---------- The walking graph ----------

// Without a floor: the whole building
export function getGraph(buildingId: string, floor?: number): Promise<Graph> {
  const query = floor === undefined ? '' : `?floor=${floor}`;
  return apiRequest<Graph>(`/api/buildings/${buildingId}/graph${query}`);
}

export interface NewNode {
  floor: number;
  x: number;
  y: number;
  type?: NodeType;
  connectFrom?: string; // draw mode: the point before this one
}

// With connectFrom, the server saves the point and the walkway to it together (both or none)
export interface CreatedNode extends GraphNode {
  edge?: GraphEdge;
}

export function createNode(buildingId: string, node: NewNode): Promise<CreatedNode> {
  return apiRequest<CreatedNode>(`/api/buildings/${buildingId}/graph/nodes`, {
    method: 'POST',
    body: JSON.stringify(node),
  });
}

// Send only what changed. An empty connectorId / label removes it.
export interface NodeChanges {
  x?: number;
  y?: number;
  type?: NodeType;
  connectorId?: string;
  label?: string;
}

export function updateNode(buildingId: string, nodeId: string, changes: NodeChanges): Promise<GraphNode> {
  return apiRequest<GraphNode>(`/api/buildings/${buildingId}/graph/nodes/${nodeId}`, {
    method: 'PUT',
    body: JSON.stringify(changes),
  });
}

export function deleteNode(buildingId: string, nodeId: string): Promise<void> {
  return apiRequest<void>(`/api/buildings/${buildingId}/graph/nodes/${nodeId}`, { method: 'DELETE' });
}

export function createEdge(buildingId: string, from: string, to: string): Promise<GraphEdge> {
  return apiRequest<GraphEdge>(`/api/buildings/${buildingId}/graph/edges`, {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  });
}

export function setEdgeBlocked(buildingId: string, edgeId: string, blocked: boolean): Promise<GraphEdge> {
  return apiRequest<GraphEdge>(`/api/buildings/${buildingId}/graph/edges/${edgeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ blocked }),
  });
}

export function deleteEdge(buildingId: string, edgeId: string): Promise<void> {
  return apiRequest<void>(`/api/buildings/${buildingId}/graph/edges/${edgeId}`, { method: 'DELETE' });
}

// ---------- QR ----------

// The picture is open to everyone, so it goes straight into <img src>
export function getQrUrl(buildingId: string, nodeId: string): string {
  return `${API_URL}/api/buildings/${buildingId}/qr/${nodeId}`;
}
