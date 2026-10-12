import type { NodeType } from '../../types/graph';

// What a click does in the walkways editor
export type EditorMode = 'draw' | 'select' | 'block' | 'delete';

export const EDITOR_MODES: { value: EditorMode; label: string; hint: string }[] = [
  {
    value: 'draw',
    label: 'Draw',
    hint: 'Click on the map to add points. Each new point is connected to the last one. Click an existing point to connect to it. Click the last point again, or press Esc, to stop.',
  },
  {
    value: 'select',
    label: 'Edit',
    hint: 'Click a point to change its type (QR code, stairs, elevator), its name, or to move it.',
  },
  {
    value: 'block',
    label: 'Block',
    hint: 'Click a walkway to block it (for example, closed for renovation). Click again to open it. Visitors are routed around blocked walkways.',
  },
  {
    value: 'delete',
    label: 'Delete',
    hint: 'Click a point or a walkway to delete it. The entrance of a place is deleted with the place, in the Places tab.',
  },
];

// The color of each point type, on the map and in the legend
export const NODE_COLORS: Record<NodeType, string> = {
  corridor: '#3d4550',
  entrance: '#1f6b4a',
  qr: '#1d4ed8',
  stairs: '#b45309',
  elevator: '#7c3aed',
};
