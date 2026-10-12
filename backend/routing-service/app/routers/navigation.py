from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.algorithms.astar import astar
from app.algorithms.dijkstra import dijkstra
from app.algorithms.path import path_length
from app.graph.loader import load_graph, load_shelter_nodes
from app.security import require_internal_key

# Every route here needs the internal key
router = APIRouter(dependencies=[Depends(require_internal_key)])


class RouteBody(BaseModel):
    buildingId: str
    fromNodeId: str
    toNodeId: str


class ShelterBody(BaseModel):
    buildingId: str
    fromNodeId: str


# The answer the main server (and the client) expects:
# { "path": [{ "id", "floor", "x", "y" }, ...], "length": 123.45 }  or  { "path": None, "length": 0 }
def to_response(nodes, adjacency, path):
    if path is None:
        return {"path": None, "length": 0}

    points = []
    for node_id in path:
        node = nodes[node_id]
        points.append({"id": node_id, "floor": node["floor"], "x": node["x"], "y": node["y"]})

    return {"path": points, "length": round(path_length(adjacency, path), 2)}


# Route between two nodes - A*
# Defined with "def" (not "async def"): pymongo waits for the database, and FastAPI
# runs such functions in a separate thread, so other requests are not stuck behind it.
@router.post("/route")
def route(body: RouteBody):
    nodes, adjacency = load_graph(body.buildingId)

    if body.fromNodeId not in nodes or body.toNodeId not in nodes:
        raise HTTPException(status_code=404, detail="Node not found")

    path = astar(nodes, adjacency, body.fromNodeId, body.toNodeId)
    return to_response(nodes, adjacency, path)


# Route to the closest shelter - Dijkstra with many targets
@router.post("/nearest-shelter")
def nearest_shelter(body: ShelterBody):
    nodes, adjacency = load_graph(body.buildingId)

    if body.fromNodeId not in nodes:
        raise HTTPException(status_code=404, detail="Node not found")

    # Only shelters whose entrance really exists in the graph
    targets = {node_id for node_id in load_shelter_nodes(body.buildingId) if node_id in nodes}

    path = dijkstra(adjacency, body.fromNodeId, targets)
    return to_response(nodes, adjacency, path)
