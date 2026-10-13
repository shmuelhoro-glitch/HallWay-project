import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { getLinkedFloor } from '../../utils/floors';
import { useAdminBuilding } from './adminContext';
import FloorMap from '../../components/map/FloorMap';
import FloorSwitcher from '../../components/map/FloorSwitcher';
import EditorLayer from '../../components/admin/EditorLayer';
import EditorToolbar from '../../components/admin/EditorToolbar';
import NodeInspector from '../../components/admin/NodeInspector';
import { EDITOR_MODES } from '../../components/admin/editorModes';
import type { EditorLayers, EditorMode } from '../../components/admin/editorModes';
import PlacesLayer from '../../components/map/PlacesLayer';
import { SNAP_PIXELS, findNearPoint, snapToAxes } from '../../utils/snap';

const EMPTY_GRAPH: Graph = { nodes: [], edges: [] };

// One change that can be undone. Every change in the editor is saved on the server right away,
// so "undo" is not local: it sends the opposite change to the server, and "redo" sends the change again.
interface HistoryEntry {
  label: string; // what the buttons say: "הזזת נקודה"
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const MAX_HISTORY = 50;

// The "Walkways" tab: draw the paths visitors walk on, floor by floor
function GraphEditorPage() {
  const { building } = useAdminBuilding();
  const floors = building.floors;

  // A link from the Check tab (?floor=1&node=...) opens that floor, with that point selected
  const [searchParams] = useSearchParams();
  const linkedFloor = getLinkedFloor(searchParams, floors);
  const linkedNodeId = searchParams.get('node');

  const [floor, setFloor] = useState(linkedFloor ?? (floors.length > 0 ? floors[0].floor : 0));
  const [graph, setGraph] = useState<Graph>(EMPTY_GRAPH); // only the floor on screen
  const [places, setPlaces] = useState<Place[]>([]); // the places of this floor, to know their entrances
  const [connectorIds, setConnectorIds] = useState<string[]>([]); // of the whole building
  const [isLoading, setIsLoading] = useState(true);

  const [mode, setMode] = useState<EditorMode>(linkedNodeId ? 'select' : 'draw');
  // Draw mode: the last point of the line. Edit mode: the point in the side panel.
  const [activeNodeId, setActiveNodeId] = useState<string | null>(linkedNodeId);
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
        setError('לא הצלחנו לטעון את המעברים.');
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

  // What is drawn on the map (only a view: hiding a layer deletes nothing), and the snap switch
  const [layers, setLayers] = useState<EditorLayers>({ plan: true, edges: true, nodes: true, places: false });
  const [isSnapOn, setIsSnapOn] = useState(true);

  // ---------- Undo / redo ----------
  // The history belongs to the floor on screen, and is forgotten when the floor changes.
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  // A point or a walkway that was deleted and brought back gets a new id from the server.
  // Older history entries still know it by the old id, so we keep "old id -> new id" here.
  const newIds = useRef(new Map<string, string>());

  // The keyboard handler below is set up once, and reads the newest undo / redo from here
  const historyActions = useRef({ undo: () => {}, redo: () => {} });
  useEffect(() => {
    historyActions.current = { undo: undoLast, redo: redoLast };
  });

  // Keyboard: Esc stops what is going on (and the next Esc goes back to Edit), D / V / B / X pick a mode,
  // Ctrl+Z / Ctrl+Y undo and redo
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (activeNodeId !== null || movingNodeId !== null) {
          setActiveNodeId(null);
          setMovingNodeId(null);
        } else {
          setMode('select');
          setError(null);
        }
        return;
      }

      // A letter typed in a field (a point name, a connector id) is text, not a shortcut
      const target = event.target as HTMLElement | null;
      const isTyping = target !== null && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
      if (isTyping || event.altKey) return; // in a field, Ctrl+Z undoes the typing, as always

      if (event.ctrlKey || event.metaKey) {
        const isRedo = event.code === 'KeyY' || (event.code === 'KeyZ' && event.shiftKey);
        if (isRedo) {
          event.preventDefault();
          historyActions.current.redo();
        } else if (event.code === 'KeyZ') {
          event.preventDefault();
          historyActions.current.undo();
        }
        return;
      }

      const pickedMode = EDITOR_MODES.find((item) => item.keyCode === event.code);
      if (pickedMode) {
        setMode(pickedMode.value);
        setActiveNodeId(null);
        setMovingNodeId(null);
        setError(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNodeId, movingNodeId]);

  if (floors.length === 0) {
    return (
      <div className="admin-empty">
        <p>קודם צריך להעלות תוכנית קומה. את המעברים מציירים על גבי התוכנית.</p>
        <Link to="../floors" className="btn btn-primary">
          מעבר לקומות
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

  // ---------- Undo / redo ----------

  // The id a point or a walkway has now (it changes when it is deleted and brought back)
  function currentId(id: string): string {
    let current = id;
    while (newIds.current.has(current)) {
      current = newIds.current.get(current) as string;
    }
    return current;
  }

  function rememberNewId(oldId: string, newId: string) {
    newIds.current.set(currentId(oldId), newId);
  }

  function clearHistory() {
    setUndoStack([]);
    setRedoStack([]);
    newIds.current.clear();
  }

  // Called after every change that worked. A new change makes the "redo" list meaningless.
  function record(entry: HistoryEntry) {
    setUndoStack((current) => [...current, entry].slice(-MAX_HISTORY));
    setRedoStack([]);
  }

  // An undo that failed in the middle may have done half of its work. The server knows
  // what is really saved, so the floor is loaded again and the history starts over.
  async function reloadAfterFailedHistory() {
    clearHistory();
    setActiveNodeId(null);
    try {
      setGraph(await getGraph(building.id, floor));
    } catch {
      // The error of the undo itself is the one that is shown
    }
  }

  function undoLast() {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;

    run(async () => {
      try {
        await entry.undo();
      } catch (undoError) {
        await reloadAfterFailedHistory();
        throw undoError;
      }
      setUndoStack((current) => current.slice(0, -1));
      setRedoStack((current) => [...current, entry]);
    });
  }

  function redoLast() {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;

    run(async () => {
      try {
        await entry.redo();
      } catch (redoError) {
        await reloadAfterFailedHistory();
        throw redoError;
      }
      setRedoStack((current) => current.slice(0, -1));
      setUndoStack((current) => [...current, entry]);
    });
  }

  // ---------- Changes, each with its way back ----------

  async function moveNode(node: GraphNode, x: number, y: number) {
    const saved = await updateNode(building.id, node.id, { x, y });
    replaceNodeOnScreen(saved);

    async function moveTo(spot: { x: number; y: number }) {
      replaceNodeOnScreen(await updateNode(building.id, currentId(node.id), spot));
    }
    record({
      label: 'הזזת נקודה',
      undo: () => moveTo({ x: node.x, y: node.y }),
      redo: () => moveTo({ x, y }),
    });
  }

  // Deletes a point. Its walkways go with it, and come back with it on undo.
  async function removeNode(node: GraphNode) {
    const lostEdges = graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id);

    await deleteNode(building.id, node.id);
    removeNodeFromScreen(node.id);

    record({
      label: 'מחיקת נקודה',
      undo: async () => {
        const created = await createNode(building.id, {
          floor: node.floor,
          x: node.x,
          y: node.y,
          type: node.type,
          connectorId: node.connectorId ?? undefined,
          label: node.label || undefined,
        });
        rememberNewId(node.id, created.id);
        addNodeToScreen(created);

        for (const lost of lostEdges) {
          await restoreEdge(lost);
        }
      },
      redo: async () => {
        const id = currentId(node.id);
        await deleteNode(building.id, id);
        removeNodeFromScreen(id);
      },
    });
  }

  // Brings a deleted walkway back, blocked if it was blocked
  async function restoreEdge(lost: GraphEdge) {
    let edge = await createEdge(building.id, currentId(lost.from), currentId(lost.to));
    if (lost.blocked) {
      edge = await setEdgeBlocked(building.id, edge.id, true);
    }
    rememberNewId(lost.id, edge.id);
    addEdgeToScreen(edge);
  }

  function recordNewEdge(edge: GraphEdge) {
    record({
      label: 'חיבור נקודות',
      undo: async () => {
        const id = currentId(edge.id);
        await deleteEdge(building.id, id);
        removeEdgeFromScreen(id);
      },
      redo: () => restoreEdge(edge),
    });
  }

  // ---------- Clicks ----------

  // The points a point has a walkway to
  function getNeighbors(nodeId: string): GraphNode[] {
    const neighbors: GraphNode[] = [];
    for (const edge of graph.edges) {
      const otherId = edge.from === nodeId ? edge.to : edge.to === nodeId ? edge.from : null;
      const other = otherId ? graph.nodes.find((node) => node.id === otherId) : undefined;
      if (other) neighbors.push(other);
    }
    return neighbors;
  }

  // With snap on: the clicked spot, pulled into line with the given points when it is almost there
  function snapSpot(point: SvgPoint, references: GraphNode[], unitsPerPixel: number): SvgPoint {
    if (!isSnapOn) return point;
    return snapToAxes(point, references, SNAP_PIXELS * unitsPerPixel);
  }

  function handleMapClick(point: SvgPoint, unitsPerPixel: number) {
    if (mode === 'draw') {
      const previousNodeId = activeNodeId;
      const previousNode = graph.nodes.find((node) => node.id === previousNodeId);

      // A click right next to a point means that point: connect to it, don't put a second point on top of it
      if (isSnapOn && layers.nodes) {
        const nearNode = findNearPoint(point, graph.nodes, SNAP_PIXELS * 1.5 * unitsPerPixel);
        if (nearNode) {
          handleNodeClick(nearNode);
          return;
        }
      }

      const spot = snapSpot(point, previousNode ? [previousNode] : [], unitsPerPixel);
      const x = Math.round(spot.x);
      const y = Math.round(spot.y);

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

        record({
          label: 'הוספת נקודה',
          undo: async () => {
            const id = currentId(node.id);
            await deleteNode(building.id, id); // the server deletes its walkway too
            removeNodeFromScreen(id);
            setActiveNodeId(null);
          },
          redo: async () => {
            const again = await createNode(building.id, {
              floor: node.floor,
              x: node.x,
              y: node.y,
              connectFrom: previousNodeId ? currentId(previousNodeId) : undefined,
            });
            const { edge: newEdge, ...newNode } = again;
            rememberNewId(node.id, newNode.id);
            addNodeToScreen(newNode);
            if (edge && newEdge) {
              rememberNewId(edge.id, newEdge.id);
              addEdgeToScreen(newEdge);
            }
          },
        });
      });
      return;
    }

    if (mode === 'select') {
      const movingNode = graph.nodes.find((node) => node.id === movingNodeId);
      if (movingNode) {
        const spot = snapSpot(point, getNeighbors(movingNode.id), unitsPerPixel);
        run(async () => {
          await moveNode(movingNode, Math.round(spot.x), Math.round(spot.y));
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
          recordNewEdge(edge);
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
      // The walkways of the point are deleted with it, so we ask first
      const walkwayCount = graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id).length;
      if (walkwayCount > 0) {
        const walkways = walkwayCount === 1 ? 'המעבר שמחובר אליה' : `${walkwayCount} המעברים שמחוברים אליה`;
        if (!window.confirm(`למחוק את הנקודה? גם ${walkways} יימחקו.`)) return;
      }
      if (!confirmQrDelete(node)) return;

      run(() => removeNode(node));
    }
  }

  // A printed QR code holds the id of its point. Deleting the point breaks the code for good:
  // even after undo, the point comes back with a new id.
  function confirmQrDelete(node: GraphNode): boolean {
    if (node.type !== 'qr') return true;
    return window.confirm('זו נקודת QR. קודים שכבר הודפסו עבורה יפסיקו לעבוד, גם אם תבטלו את המחיקה. למחוק?');
  }

  // A point was dragged to a new spot. It is shown there right away, and goes back if saving fails.
  function handleNodeMove(node: GraphNode, x: number, y: number) {
    if (busyRef.current) return;

    replaceNodeOnScreen({ ...node, x, y });
    setMovingNodeId(null);

    run(async () => {
      try {
        await moveNode(node, x, y);
      } catch (moveError) {
        replaceNodeOnScreen(node);
        throw moveError;
      }
    });
  }

  function handleEdgeClick(edge: GraphEdge) {
    if (mode === 'block') {
      run(async () => {
        async function setBlocked(blocked: boolean) {
          replaceEdgeOnScreen(await setEdgeBlocked(building.id, currentId(edge.id), blocked));
        }

        await setBlocked(!edge.blocked);
        record({
          label: edge.blocked ? 'פתיחת מעבר' : 'חסימת מעבר',
          undo: () => setBlocked(edge.blocked),
          redo: () => setBlocked(!edge.blocked),
        });
      });
    }

    if (mode === 'delete') {
      run(async () => {
        async function remove() {
          const id = currentId(edge.id);
          await deleteEdge(building.id, id);
          removeEdgeFromScreen(id);
        }

        await remove();
        record({ label: 'מחיקת מעבר', undo: () => restoreEdge(edge), redo: remove });
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
    clearHistory(); // the history is of the floor that was on screen
  }

  function handleInspectorSave(changes: NodeChanges) {
    const before = graph.nodes.find((node) => node.id === activeNodeId);
    if (!before || Object.keys(changes).length === 0) return;

    // The same fields, with the values they had: that is the way back
    const back: NodeChanges = {};
    if (changes.type !== undefined) back.type = before.type;
    if (changes.connectorId !== undefined) back.connectorId = before.connectorId ?? '';
    if (changes.label !== undefined) back.label = before.label;
    const nodeId = before.id;

    run(async () => {
      async function apply(values: NodeChanges) {
        const node = await updateNode(building.id, currentId(nodeId), values);
        replaceNodeOnScreen(node);
        return node;
      }

      const node = await apply(changes);
      if (node.connectorId && !connectorIds.includes(node.connectorId)) {
        setConnectorIds([...connectorIds, node.connectorId].sort());
      }

      record({
        label: 'שינוי נקודה',
        undo: async () => {
          await apply(back);
        },
        redo: async () => {
          await apply(changes);
        },
      });
    });
  }

  function handleInspectorDelete() {
    const node = graph.nodes.find((item) => item.id === activeNodeId);
    if (!node || !confirmQrDelete(node)) return;

    run(async () => {
      await removeNode(node);
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

  // One line on top of the map: the mode we are in, and what a click does right now
  const modeInfo = EDITOR_MODES.find((item) => item.value === mode) ?? EDITOR_MODES[0];
  let mapHint = modeInfo.mapHint;
  if (mode === 'draw' && activeNodeId) {
    mapHint = 'לחצו כדי להוסיף את הנקודה הבאה. כדי לעצור, לחצו שוב על הנקודה האחרונה.';
  } else if (movingNodeId) {
    mapHint = 'לחצו על המיקום החדש של הנקודה.';
  }

  // "נקודה אחת לא מחוברת" / "3 נקודות לא מחוברות"
  const looseText = looseNodeIds.size === 1 ? 'נקודה אחת לא מחוברת' : `${looseNodeIds.size} נקודות לא מחוברות`;

  return (
    <div className="admin-split">
      <div className={isBusy ? 'admin-map is-busy' : 'admin-map'}>
        <FloorMap
          key={currentFloor.floor}
          planUrl={getPlanUrl(building.id, currentFloor.floor)}
          width={currentFloor.width}
          height={currentFloor.height}
          onMapClick={handleMapClick}
          isPlanHidden={!layers.plan}
        >
          {/* The places are only shown here, as a reference. They are edited in the Places tab. */}
          {layers.places && (
            <g pointerEvents="none">
              <PlacesLayer places={places} selectedPlaceId={null} highlightShelters={false} onSelect={() => {}} showAllLabels />
            </g>
          )}
          <EditorLayer
            nodes={graph.nodes}
            edges={graph.edges}
            mode={mode}
            activeNodeId={activeNodeId}
            looseNodeIds={looseNodeIds}
            canDrag={mode === 'select' && !isBusy}
            showEdges={layers.edges}
            showNodes={layers.nodes}
            isSnapOn={isSnapOn}
            onNodeClick={handleNodeClick}
            onNodeMove={handleNodeMove}
            onEdgeClick={handleEdgeClick}
          />
        </FloorMap>

        <div className={`admin-map-hint is-${mode}`} role="status">
          <strong>{modeInfo.label}</strong> · {mapHint}
        </div>
        <FloorSwitcher floors={floors} currentFloor={currentFloor.floor} onChange={changeFloor} />
      </div>

      <div className="admin-panel">
        <EditorToolbar
          mode={mode}
          onModeChange={changeMode}
          undoLabel={undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null}
          redoLabel={redoStack.length > 0 ? redoStack[redoStack.length - 1].label : null}
          isBusy={isBusy}
          onUndo={undoLast}
          onRedo={redoLast}
          layers={layers}
          onLayersChange={setLayers}
          isSnapOn={isSnapOn}
          onSnapChange={setIsSnapOn}
        />

        {error && <p className="message-error" role="alert">{error}</p>}
        {isLoading && <p className="message-info is-loading" role="status">טוען...</p>}

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
          <h2 className="admin-card-title">בדיקה</h2>
          <p className="admin-card-text">
            {graph.nodes.length === 0 && !isLoading
              ? 'עדיין אין מעברים בקומה הזאת. במצב ציור, לחצו במפה כדי להניח את הנקודה הראשונה, והמשיכו ללחוץ לאורך המסדרון.'
              : `בקומה הזאת: ${graph.nodes.length} נקודות, ${graph.edges.length} מעברים.`}
          </p>

          {looseNodeIds.size === 0 && graph.nodes.length > 0 && (
            <p className="message-success" role="status">כל הנקודות מחוברות.</p>
          )}

          {looseNodeIds.size > 0 && (
            <p className="message-error" role="alert">
              {looseText} (מסומן בטבעת אדומה).
              {unreachablePlaces.length > 0 &&
                ` מבקרים לא יכולים להגיע אל: ${unreachablePlaces.map((place) => place.name).join(', ')}.`}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default GraphEditorPage;
