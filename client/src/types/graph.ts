// The walking graph of a building, as the admin editor sees it

export type NodeType = 'corridor' | 'entrance' | 'stairs' | 'elevator' | 'qr';

// A point on the walking graph
export interface GraphNode {
  id: string;
  floor: number;
  x: number;
  y: number;
  type: NodeType;
  connectorId: string | null; // stairs / elevator: the same id on every floor
  label: string;
}

// A walkway between two points of the same floor
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  length: number;
  blocked: boolean;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  corridor: 'נקודת מעבר',
  entrance: 'כניסה',
  stairs: 'מדרגות',
  elevator: 'מעלית',
  qr: 'קוד QR',
};
