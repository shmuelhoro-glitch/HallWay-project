import type { GraphEdge, GraphNode } from '../../types/graph';
import { NODE_TYPE_LABELS } from '../../types/graph';
import { useMapScale } from '../map/mapScale';
import { NODE_COLORS } from './editorModes';
import type { EditorMode } from './editorModes';

interface EditorLayerProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  mode: EditorMode;
  activeNodeId: string | null; // the point being edited, or the last point of the line being drawn
  looseNodeIds: Set<string>; // points with no walkway - visitors can't get to them
  onNodeClick: (node: GraphNode) => void;
  onEdgeClick: (edge: GraphEdge) => void;
}

// The walking graph drawn on top of the floor plan, inside FloorMap.
// All sizes are multiplied by scale, so they stay the same size on screen at any zoom.
function EditorLayer({ nodes, edges, mode, activeNodeId, looseNodeIds, onNodeClick, onEdgeClick }: EditorLayerProps) {
  const scale = useMapScale();

  // Find a node by its id quickly, to draw the edges
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  // Walkways can be clicked only where it means something. While drawing, a click near
  // a walkway must reach the map and add a point.
  const canClickEdges = mode === 'block' || mode === 'delete';

  return (
    <g>
      {edges.map((edge) => {
        const a = nodesById.get(edge.from);
        const b = nodesById.get(edge.to);
        if (!a || !b) return null;

        return (
          <g key={edge.id}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={edge.blocked ? '#b80f2a' : '#3d4550'}
              strokeWidth={3 * scale}
              strokeDasharray={edge.blocked ? `${8 * scale} ${6 * scale}` : undefined}
              strokeLinecap="round"
              pointerEvents="none"
            />
            {/* A wide see-through line on top: much easier to hit than 3 pixels */}
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="transparent"
              strokeWidth={14 * scale}
              pointerEvents={canClickEdges ? 'stroke' : 'none'}
              style={{ cursor: canClickEdges ? 'pointer' : undefined }}
              onClick={(event) => {
                event.stopPropagation(); // the map under it must not get this click
                onEdgeClick(edge);
              }}
            >
              <title>{edge.blocked ? 'Blocked walkway' : `Walkway, ${Math.round(edge.length)} units`}</title>
            </line>
          </g>
        );
      })}

      {nodes.map((node) => {
        const isActive = node.id === activeNodeId;
        const isLoose = looseNodeIds.has(node.id);
        const radius = (node.type === 'corridor' ? 6 : 8) * scale;
        const showLabel = node.type !== 'corridor' && node.label !== '';

        return (
          <g
            key={node.id}
            style={{ cursor: 'pointer' }}
            onClick={(event) => {
              // Without this the click also reaches the map, and in Draw mode adds another point
              event.stopPropagation();
              onNodeClick(node);
            }}
          >
            <title>
              {NODE_TYPE_LABELS[node.type]}
              {node.label ? `: ${node.label}` : ''}
            </title>

            <circle cx={node.x} cy={node.y} r={16 * scale} fill="transparent" />

            {isActive && (
              <circle
                cx={node.x}
                cy={node.y}
                r={radius + 7 * scale}
                fill="#ffc93c"
                fillOpacity={0.55}
                stroke="#12161c"
                strokeWidth={2 * scale}
              />
            )}
            {isLoose && (
              <circle
                cx={node.x}
                cy={node.y}
                r={radius + 4 * scale}
                fill="none"
                stroke="#b80f2a"
                strokeWidth={2.5 * scale}
              />
            )}
            <circle
              cx={node.x}
              cy={node.y}
              r={radius}
              fill={NODE_COLORS[node.type]}
              stroke="#ffffff"
              strokeWidth={2 * scale}
            />

            {showLabel && (
              <text
                x={node.x}
                y={node.y + 22 * scale}
                fontSize={11 * scale}
                textAnchor="middle"
                fill={NODE_COLORS[node.type]}
                fontWeight={500}
                stroke="#ffffff"
                strokeWidth={3 * scale}
                paintOrder="stroke"
                pointerEvents="none"
              >
                {node.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export default EditorLayer;
