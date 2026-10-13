from app.algorithms.heuristics import distance
from app.db import db

# The "cost" of moving one floor with stairs or an elevator, in floor-plan units
FLOOR_CHANGE_COST = 30


# Reads the walking graph of one building from MongoDB, fresh on every request,
# so a change in the admin editor (a new walkway, a blocked passage) counts right away.
#
# Returns two dictionaries:
#   nodes:     id -> { "id", "floor", "x", "y" }
#   adjacency: id -> [(neighbor_id, weight), ...]
def load_graph(building_id, accessible=False):
    nodes = {}
    for node in db.nodes.find({"buildingId": building_id}):
        node_id = str(node["_id"])
        node_type = node.get("type")
        connector_id = node.get("connectorId")
        is_stairs = (str(node_type).lower() == "stairs") if node_type else False
        if connector_id and "stair" in str(connector_id).lower():
            is_stairs = True
        # An accessible route: the stairs are simply not loaded, so nothing can pass through them
        if accessible and is_stairs:
            continue

        nodes[node_id] = {
            "id": node_id,
            "floor": node["floor"],
            "x": node["x"],
            "y": node["y"],
            "type": node_type,
            "connectorId": connector_id,
        }

    adjacency = {node_id: [] for node_id in nodes}

    def connect(a, b, weight):
        # Walkways go both ways
        adjacency[a].append((b, weight))
        adjacency[b].append((a, weight))

    # 1. Walkways on the same floor. A blocked one is simply not loaded.
    for edge in db.edges.find({"buildingId": building_id, "blocked": {"$ne": True}}):
        a = edge["from"]
        b = edge["to"]
        if a not in nodes or b not in nodes:
            continue  # an edge to a node that was deleted

        # The weight comes from the coordinates, so it is always right, even after a node moved
        connect(a, b, distance(nodes[a], nodes[b]))

    # 2. Floor changes: nodes with the same connectorId (for example "elevator-main")
    #    on different floors are connected to each other.
    groups = {}
    for node in nodes.values():
        if node["connectorId"]:
            groups.setdefault(node["connectorId"], []).append(node)

    for group in groups.values():
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a = group[i]
                b = group[j]
                if a["floor"] != b["floor"]:
                    # Never less than the straight line, so the A* guess stays correct
                    weight = max(FLOOR_CHANGE_COST, distance(a, b))
                    connect(a["id"], b["id"], weight)

    return nodes, adjacency


# The entrance nodes of all the shelters in the building
def load_shelter_nodes(building_id):
    shelters = db.places.find({"buildingId": building_id, "type": "shelter"})
    return {place["entryNodeId"] for place in shelters if place.get("entryNodeId")}
