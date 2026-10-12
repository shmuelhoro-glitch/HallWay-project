import math

import networkx

# Small graphs for the tests, built in code - no database.


def make_graph(points, walkways, floor_links=()):
    """
    points:      { "A": (floor, x, y), ... }
    walkways:    [("A", "B"), ...]           - weight = the straight-line distance
    floor_links: [("E0", "E1", 30), ...]     - stairs / elevator, with their own weight

    Returns (nodes, adjacency, nx_graph). The networkx graph has the same weights,
    so we can compare our answer with a library we trust.
    """
    nodes = {}
    for node_id, (floor, x, y) in points.items():
        nodes[node_id] = {"id": node_id, "floor": floor, "x": x, "y": y}

    adjacency = {node_id: [] for node_id in nodes}
    nx_graph = networkx.Graph()
    nx_graph.add_nodes_from(nodes)

    def connect(a, b, weight):
        adjacency[a].append((b, weight))
        adjacency[b].append((a, weight))
        nx_graph.add_edge(a, b, weight=weight)

    for a, b in walkways:
        weight = math.hypot(nodes[a]["x"] - nodes[b]["x"], nodes[a]["y"] - nodes[b]["y"])
        connect(a, b, weight)

    for a, b, weight in floor_links:
        connect(a, b, weight)

    return nodes, adjacency, nx_graph


def path_weight(adjacency, path):
    total = 0
    for i in range(len(path) - 1):
        total += min(w for n, w in adjacency[path[i]] if n == path[i + 1])
    return total
