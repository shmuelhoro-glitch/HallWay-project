import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createEdge,
  createNode,
  deleteEdge,
  deleteNode,
  getGraph,
  setEdgeBlocked,
  updateNode,
} from '../../api/admin';
import type { NodeChanges } from '../../api/admin';
import { getPlanUrl } from '../../api/buildings';
import { ApiError } from '../../api/client';
import { getPlaces } from '../../api/places';
import type { Graph, GraphEdge, GraphNode } from '../../types/graph';
import type { Place } from '../../types/place';
import type { SvgPoint } from '../../utils/svgCoords';
import { getErrorMessage } from '../../utils/errorMessage';
import { useAdminBuilding } from './adminContext';
import FloorMap from '../../components/map/FloorMap';
import FloorSwitcher from '../../components/map/FloorSwitcher';
import EditorLayer from '../../components/admin/EditorLayer';
import EditorToolbar from '../../components/admin/EditorToolbar';
import NodeInspector from '../../components/admin/NodeInspector';
import type { EditorMode } from '../../components/admin/editorModes';

const EMPTY_GRAPH: Graph = { nodes: [], edges: [] };

// The "Walkways" tab: draw the paths visitors walk on, floor by floor
function GraphEditorPage() {
  const { building } = useAdminBuilding();
  const floors = building.floors;

  const [floor, setFloor] = useState(floors.length > 0 ? floors[0].floor : 0);
  const [graph, setGraph] = useState<Graph>(EMPTY_GRAPH); // only the floor on screen
  const [places, setPlaces] = useState<Place[]>([]); // the places of this floor, to know their entrances
  const [connectorIds, setConnectorIds] = useState<string[]>([]); // of the whole building
  const [isLoading, setIsLoading] = useState(true);

  const [mode, setMode] = useState<EditorMode>('draw');
  // Draw mode: the last point of the line. Edit mode: the point in the side panel.
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [movingNodeId, setMovingNodeId] = useState<string | null>(null);

  const [isBusy, setIsBusy] = useState(false);
  const busyRef = useRef(false); // blocks a second click while a request is still running
  const [error, setError] = useState<string | null>(null);

  // The graph and the places of the floor on screen
  useEffect(() => {
    let isCancelled = false;

    Promise.all([getGraph(building.id, floor), getPlaces(building.id, { floor })])
      .then(([floorGraph, floorPlaces]) => {
        if (isCancelled) return;
        setGraph(floorGraph);
        setPlaces(floorPlaces);
        setError(null);
      })
      .catch(() => {
        if (isCancelled) return;
        setError('Could not load the walkways.');
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [building.id, floor]);

  // The connector ids of all floors, as suggestions ("elevator-main" on floor 0 -> also on floor 1)
  useEffect(() => {
    getGraph(building.id)
      .then((wholeGraph) => {
        const ids = wholeGraph.nodes.map((node) => node.connectorId).filter((id): id is string => id !== null);
        setConnectorIds([...new Set(ids)].sort());
      })
      .catch(() => setConnectorIds([]));
  }, [building.id]);

  // Esc: stop drawing / close the point
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveNodeId(null);
        setMovingNodeId(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (floors.length === 0) {
    return (
      <div className="admin-empty">
        <p>Upload a floor plan first. Walkways are drawn on the plan.</p>
        <Link to="../floors" className="btn btn-primary">
          Go to floors
        </Link>
      </div>
    );
  }

  const currentFloor = floors.find((item) => item.floor === floor) ?? floors[0];

  // ---------- Small helpers that update the graph on screen ----------

  function addNodeToScreen(node: GraphNode) {
    setGraph((current) => ({ ...current, nodes: [...current.nodes, node] }));
  }

  function addEdgeToScreen(edge: GraphEdge) {
    setGraph((current) => ({ ...current, edges: [...current.edges, edge] }));
  }

  function replaceNodeOnScreen(node: GraphNode) {
    setGraph((current) => ({ ...current, nodes: current.nodes.map((item) => (item.id === node.id ? node : item)) }));
  }

  function replaceEdgeOnScreen(edge: GraphEdge) {
    setGraph((current) => ({ ...current, edges: current.edges.map((item) => (item.id === edge.id ? edge : item)) }));
  }

  // A deleted point takes its walkways with it (the server deletes them too)
  function removeNodeFromScreen(nodeId: string) {
    setGraph((current) => ({
      nodes: current.nodes.filter((node) => node.id !== nodeId),
      edges: current.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
    }));
  }

  function removeEdgeFromScreen(edgeId: string) {
    setGraph((current) => ({ ...current, edges: current.edges.filter((edge) => edge.id !== edgeId) }));
  }

  // Runs one change against the server: one at a time, and shows the error if it failed
  async function run(task: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    setError(null);

    try {
      await task();
    } catch (taskError) {
      setError(getErrorMessage(taskError));
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }

  // ---------- Clicks ----------

  function handleMapClick(point: SvgPoint) {
    const x = Math.round(point.x);
    const y = Math.round(point.y);

    if (mode === 'draw') {
      const previousNodeId = activeNodeId;
      run(async () => {
        // One request for the point and its walkway, so a point is never left without one
        let created;
        try {
          created = await createNode(building.id, { floor, x, y, connectFrom: previousNodeId ?? undefined });
        } catch (createError) {
          // The point we were drawing from is gone (deleted in another tab): the next click starts a new line
          if (createError instanceof ApiError && createError.code === 'NODE_NOT_FOUND') {
            setActiveNodeId(null);
          }
          throw createError;
        }

        const { edge, ...node } = created;
        addNodeToScreen(node);
        setActiveNodeId(node.id); // the next point connects to this one

        if (edge) {
          addEdgeToScreen(edge);
        }
      });
      return;
    }

    if (mode === 'select') {
      if (movingNodeId) {
        const nodeId = movingNodeId;
        run(async () => {
          const node = await updateNode(building.id, nodeId, { x, y });
          replaceNodeOnScreen(node);
          setMovingNodeId(null);
        });
      } else {
        setActiveNodeId(null); // a click on an empty spot closes the point
      }
    }
  }

  function handleNodeClick(node: GraphNode) {
    if (mode === 'draw') {
      // The first point of a new line
      if (activeNodeId === null) {
        setActiveNodeId(node.id);
        return;
      }
      // The last point again = stop drawing
      if (activeNodeId === node.id) {
        setActiveNodeId(null);
        return;
      }

      const previousNodeId = activeNodeId;
      run(async () => {
        try {
          const edge = await createEdge(building.id, previousNodeId, node.id);
          addEdgeToScreen(edge);
        } catch (edgeError) {
          // Already connected - not a problem, just continue from this point
          if (!(edgeError instanceof ApiError && edgeError.code === 'EDGE_EXISTS')) {
            throw edgeError;
          }
        }
        setActiveNodeId(node.id);
      });
      return;
    }

    if (mode === 'select') {
      setActiveNodeId(node.id);
      setMovingNodeId(null);
      return;
    }

    if (mode === 'delete') {
      run(async () => {
        await deleteNode(building.id, node.id);
        removeNodeFromScreen(node.id);
      });
    }
  }

  function handleEdgeClick(edge: GraphEdge) {
    if (mode === 'block') {
      run(async () => {
        const updated = await setEdgeBlocked(building.id, edge.id, !edge.blocked);
        replaceEdgeOnScreen(updated);
      });
    }

    if (mode === 'delete') {
      run(async () => {
        await deleteEdge(building.id, edge.id);
        removeEdgeFromScreen(edge.id);
      });
    }
  }

  // ---------- Side panel ----------

  function changeMode(newMode: EditorMode) {
    setMode(newMode);
    setActiveNodeId(null);
    setMovingNodeId(null);
    setError(null);
  }

  function changeFloor(newFloor: number) {
    setFloor(newFloor);
    setIsLoading(true);
    setActiveNodeId(null);
    setMovingNodeId(null);
  }

  function handleInspectorSave(changes: NodeChanges) {
    if (!activeNodeId) return;
    const nodeId = activeNodeId;

    run(async () => {
      const node = await updateNode(building.id, nodeId, changes);
      replaceNodeOnScreen(node);
      if (node.connectorId && !connectorIds.includes(node.connectorId)) {
        setConnectorIds([...connectorIds, node.connectorId].sort());
      }
    });
  }

  function handleInspectorDelete() {
    if (!activeNodeId) return;
    const nodeId = activeNodeId;

    run(async () => {
      await deleteNode(building.id, nodeId);
      removeNodeFromScreen(nodeId);
      setActiveNodeId(null);
    });
  }

  // Points with no walkway at all: a visitor can't walk to them, or from them
  const connectedIds = new Set<string>();
  for (const edge of graph.edges) {
    connectedIds.add(edge.from);
    connectedIds.add(edge.to);
  }
  const looseNodeIds = new Set(graph.nodes.filter((node) => !connectedIds.has(node.id)).map((node) => node.id));

  // Places whose entrance is one of those points
  const placeByEntry = new Map(places.map((place) => [place.entryNodeId, place]));
  const unreachablePlaces = places.filter((place) => looseNodeIds.has(place.entryNodeId));

  const activeNode = graph.nodes.find((node) => node.id === activeNodeId) ?? null;
  const activePlace = activeNode ? placeByEntry.get(activeNode.id) ?? null : null;

  let mapHint: string | null = null;
  if (mode === 'draw') {
    mapHint = activeNodeId
      ? 'Click to add the next point. Click the last point again to stop.'
      : 'Click on the map to start a walkway, or click a point to continue from it.';
  } else if (movingNodeId) {
    mapHint = 'Click the new spot for this point.';
  }

  return (
    <div className="admin-split">
      <div className={isBusy ? 'admin-map is-busy' : 'admin-map'}>
        <FloorMap
          key={currentFloor.floor}
          planUrl={getPlanUrl(building.id, currentFloor.floor)}
          width={currentFloor.width}
          height={currentFloor.height}
          onMapClick={handleMapClick}
        >
          <EditorLayer
            nodes={graph.nodes}
            edges={graph.edges}
            mode={mode}
            activeNodeId={activeNodeId}
            looseNodeIds={looseNodeIds}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
          />
        </FloorMap>

        {mapHint && <div className="admin-map-hint">{mapHint}</div>}
        <FloorSwitcher floors={floors} currentFloor={currentFloor.floor} onChange={changeFloor} />
      </div>

      <div className="admin-panel">
        <EditorToolbar mode={mode} onModeChange={changeMode} />

        {error && <p className="message-error">{error}</p>}
        {isLoading && <p className="message-info">Loading...</p>}

        {mode === 'select' && activeNode && (
          <NodeInspector
            key={activeNode.id}
            node={activeNode}
            placeName={activePlace ? activePlace.name : null}
            connectorIds={connectorIds}
            isBusy={isBusy}
            isMoving={movingNodeId === activeNode.id}
            onSave={handleInspectorSave}
            onMove={() => setMovingNodeId(activeNode.id)}
            onDelete={handleInspectorDelete}
            onClose={() => setActiveNodeId(null)}
          />
        )}

        <section className="admin-card">
          <h2 className="admin-card-title">Check</h2>
          <p className="admin-card-text">
            {graph.nodes.length} points, {graph.edges.length} walkways on this floor.
          </p>

          {looseNodeIds.size === 0 && graph.nodes.length > 0 && (
            <p className="message-success">Every point is connected.</p>
          )}

          {looseNodeIds.size > 0 && (
            <p className="message-error">
              {looseNodeIds.size === 1 ? '1 point is' : `${looseNodeIds.size} points are`} not connected (red ring).
              {unreachablePlaces.length > 0 &&
                ` Visitors can't reach: ${unreachablePlaces.map((place) => place.name).join(', ')}.`}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default GraphEditorPage;
