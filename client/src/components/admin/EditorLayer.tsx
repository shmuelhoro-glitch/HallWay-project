import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { GraphEdge, GraphNode } from '../../types/graph';
import { NODE_TYPE_LABELS } from '../../types/graph';
import { screenToSvg } from '../../utils/svgCoords';
import { useMapScale } from '../map/mapScale';
import { NODE_COLORS } from './editorModes';
import type { EditorMode } from './editorModes';

interface EditorLayerProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  mode: EditorMode;
  activeNodeId: string | null; // the point being edited, or the last point of the line being drawn
  looseNodeIds: Set<string>; // points with no walkway - visitors can't get to them
  canDrag: boolean; // Edit mode, and no request is running
  onNodeClick: (node: GraphNode) => void;
  onNodeMove: (node: GraphNode, x: number, y: number) => void; // a point was dragged to a new spot
  onEdgeClick: (edge: GraphEdge) => void;
}

// The point that is being dragged right now, and where it is on the plan
interface Drag {
  nodeId: string;
  x: number;
  y: number;
}

const DRAG_THRESHOLD = 5; // pixels. Less than this is a click, not a drag

// The walking graph drawn on top of the floor plan, inside FloorMap.
// All sizes are multiplied by scale, so they stay the same size on screen at any zoom.
function EditorLayer({
  nodes,
  edges,
  mode,
  activeNodeId,
  looseNodeIds,
  canDrag,
  onNodeClick,
  onNodeMove,
  onEdgeClick,
}: EditorLayerProps) {
  const scale = useMapScale();

  const [drag, setDrag] = useState<Drag | null>(null);
  const pressStart = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  // The browser sends a click after every press. When the press was already handled here
  // (it was a drag, or a tap we passed on ourselves), that click must be ignored.
  const didDrag = useRef(false);
  const didTap = useRef(false);

  // While a point is dragged it is drawn where the pointer is, and its walkways follow it
  const shownNodes = drag ? nodes.map((node) => (node.id === drag.nodeId ? { ...node, x: drag.x, y: drag.y } : node)) : nodes;

  // Find a node by its id quickly, to draw the edges
  const nodesById = new Map(shownNodes.map((node) => [node.id, node]));

  // Walkways can be clicked only where it means something. While drawing, a click near
  // a walkway must reach the map and add a point.
  const canClickEdges = mode === 'block' || mode === 'delete';

  // ---------- Dragging a point ----------
  // stopPropagation: FloorMap must not see these events, or it would move the whole plan with the point.

  function handlePointerDown(event: PointerEvent<SVGGElement>) {
    didDrag.current = false;
    didTap.current = false;
    if (!canDrag) return;

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId); // moves and the release come here, also outside the point
    pressStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(event: PointerEvent<SVGGElement>, node: GraphNode) {
    const start = pressStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    event.stopPropagation();

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (!didDrag.current && distance < DRAG_THRESHOLD) return;
    didDrag.current = true;

    // The spot is kept in plan coordinates, so it is right at any zoom
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const point = screenToSvg(svg, event.clientX, event.clientY);
    setDrag({ nodeId: node.id, x: Math.round(point.x), y: Math.round(point.y) });
  }

  function handlePointerUp(event: PointerEvent<SVGGElement>, node: GraphNode) {
    const start = pressStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    event.stopPropagation();
    pressStart.current = null;

    if (drag && drag.nodeId === node.id) {
      onNodeMove(node, drag.x, drag.y);
    } else if (!didDrag.current) {
      // A plain tap. We pass it on here and not in onClick: FloorMap never saw this press,
      // so it may still think the last map drag is going on, and swallow the click.
      didTap.current = true;
      onNodeClick(node);
    }
    setDrag(null);
  }

  // The browser took the pointer away (for example, a phone call): the point goes back
  function handlePointerCancel() {
    pressStart.current = null;
    setDrag(null);
  }

  return (
    <g>
      {edges.map((edge) => {
        const a = nodesById.get(edge.from);
        const b = nodesById.get(edge.to);
        if (!a || !b) return null;

        return (
          <g key={edge.id} className={canClickEdges ? 'editor-edge is-clickable' : 'editor-edge'}>
            <line
              className="editor-edge-line"
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
              <title>{edge.blocked ? 'מעבר חסום' : `מעבר, אורך ${Math.round(edge.length)}`}</title>
            </line>
          </g>
        );
      })}

      {shownNodes.map((node) => {
        const isActive = node.id === activeNodeId;
        const isLoose = looseNodeIds.has(node.id);
        const isDragged = drag !== null && drag.nodeId === node.id;
        const radius = (node.type === 'corridor' ? 6 : 8) * scale;
        const showLabel = node.type !== 'corridor' && node.label !== '';

        let cursor = 'pointer';
        if (canDrag) cursor = isDragged ? 'grabbing' : 'grab';

        return (
          <g
            key={node.id}
            className="editor-node"
            style={{ cursor, touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={(event) => handlePointerMove(event, node)}
            onPointerUp={(event) => handlePointerUp(event, node)}
            onPointerCancel={handlePointerCancel}
            onClick={(event) => {
              // Without this the click also reaches the map, and in Draw mode adds another point
              event.stopPropagation();
              if (didDrag.current || didTap.current) return; // already handled when the pointer was released
              onNodeClick(node);
            }}
          >
            <title>
              {NODE_TYPE_LABELS[node.type]}
              {node.label ? `: ${node.label}` : ''}
            </title>

            <circle cx={node.x} cy={node.y} r={16 * scale} fill="transparent" />

            {(isActive || isDragged) && (
              <circle
                cx={node.x}
                cy={node.y}
                r={radius + 7 * scale}
                fill="#ffc93c"
                fillOpacity={0.55}
                stroke="#12161c"
                strokeWidth={2 * scale}
                strokeDasharray={isDragged ? `${4 * scale} ${3 * scale}` : undefined}
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
              className="editor-node-dot"
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
