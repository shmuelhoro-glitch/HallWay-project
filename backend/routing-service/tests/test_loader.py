import sys
import types

import pytest

# The loader turns the nodes and edges of the database into the graph the algorithms walk on.
# app.db opens a connection to the real database when it is imported, so the loader
# gets a fake one here: plain lists in memory.


def matches(doc, query):
    for key, expected in query.items():
        if isinstance(expected, dict):
            if doc.get(key) == expected["$ne"]:
                return False
        elif doc.get(key) != expected:
            return False
    return True


class FakeCollection:
    def __init__(self):
        self.docs = []

    def find(self, query):
        return [doc for doc in self.docs if matches(doc, query)]


class FakeDb:
    def __init__(self):
        self.nodes = FakeCollection()
        self.edges = FakeCollection()
        self.places = FakeCollection()


fake_db = FakeDb()
fake_db_module = types.ModuleType("app.db")
fake_db_module.db = fake_db
sys.modules["app.db"] = fake_db_module

from app.algorithms.astar import astar  # noqa: E402
from app.algorithms.dijkstra import dijkstra  # noqa: E402
from app.graph.loader import FLOOR_CHANGE_COST, load_graph, load_shelter_nodes  # noqa: E402

BUILDING = "building-1"
OTHER_BUILDING = "building-2"


@pytest.fixture(autouse=True)
def empty_database():
    fake_db.nodes.docs = []
    fake_db.edges.docs = []
    fake_db.places.docs = []


def add_node(node_id, floor, x, y, connector_id=None, building=BUILDING, node_type=None):
    node = {"_id": node_id, "buildingId": building, "floor": floor, "x": x, "y": y}
    if connector_id is not None:
        node["connectorId"] = connector_id
    if node_type is not None:
        node["type"] = node_type
    fake_db.nodes.docs.append(node)


def add_edge(a, b, blocked=None, building=BUILDING):
    edge = {"buildingId": building, "from": a, "to": b}
    if blocked is not None:
        edge["blocked"] = blocked
    fake_db.edges.docs.append(edge)


def neighbors(adjacency, node_id):
    return {neighbor: weight for neighbor, weight in adjacency[node_id]}


# ---------- Walkways ----------


def test_a_walkway_goes_both_ways_with_the_straight_line_length():
    add_node("A", 0, 0, 0)
    add_node("B", 0, 30, 40)
    add_edge("A", "B")

    nodes, adjacency = load_graph(BUILDING)

    assert set(nodes) == {"A", "B"}
    assert neighbors(adjacency, "A") == {"B": 50}
    assert neighbors(adjacency, "B") == {"A": 50}


def test_the_length_comes_from_the_coordinates_not_from_the_saved_number():
    add_node("A", 0, 0, 0)
    add_node("B", 0, 30, 40)
    fake_db.edges.docs.append({"buildingId": BUILDING, "from": "A", "to": "B", "length": 999})

    _, adjacency = load_graph(BUILDING)

    assert neighbors(adjacency, "A") == {"B": 50}


def test_a_blocked_walkway_is_not_loaded():
    add_node("A", 0, 0, 0)
    add_node("B", 0, 100, 0)
    add_node("C", 0, 200, 0)
    add_edge("A", "B", blocked=True)
    add_edge("B", "C", blocked=False)

    _, adjacency = load_graph(BUILDING)

    assert neighbors(adjacency, "A") == {}
    assert neighbors(adjacency, "B") == {"C": 100}


def test_an_old_walkway_without_the_blocked_field_is_open():
    add_node("A", 0, 0, 0)
    add_node("B", 0, 100, 0)
    add_edge("A", "B")

    _, adjacency = load_graph(BUILDING)

    assert neighbors(adjacency, "A") == {"B": 100}


def test_a_walkway_to_a_point_that_was_deleted_is_skipped():
    add_node("A", 0, 0, 0)
    add_edge("A", "DELETED")

    nodes, adjacency = load_graph(BUILDING)

    assert set(nodes) == {"A"}
    assert neighbors(adjacency, "A") == {}


def test_only_the_points_and_walkways_of_this_building_are_loaded():
    add_node("A", 0, 0, 0)
    add_node("B", 0, 100, 0)
    add_node("X", 0, 0, 0, building=OTHER_BUILDING)
    add_node("Y", 0, 100, 0, building=OTHER_BUILDING)
    add_edge("A", "B")
    add_edge("X", "Y", building=OTHER_BUILDING)

    nodes, adjacency = load_graph(BUILDING)

    assert set(nodes) == {"A", "B"}
    assert set(adjacency) == {"A", "B"}


# ---------- Stairs and elevators ----------


def test_the_same_connector_on_two_floors_connects_them():
    add_node("E0", 0, 100, 100, connector_id="elevator-main")
    add_node("E1", 1, 100, 100, connector_id="elevator-main")

    _, adjacency = load_graph(BUILDING)

    assert neighbors(adjacency, "E0") == {"E1": FLOOR_CHANGE_COST}
    assert neighbors(adjacency, "E1") == {"E0": FLOOR_CHANGE_COST}


def test_a_floor_change_is_never_cheaper_than_the_straight_line():
    # The stairs come out far from where they started. A* needs the weight to be at least the distance.
    add_node("S0", 0, 0, 0, connector_id="stairs-main")
    add_node("S1", 1, 300, 400, connector_id="stairs-main")

    _, adjacency = load_graph(BUILDING)

    assert neighbors(adjacency, "S0") == {"S1": 500}


def test_the_same_connector_twice_on_one_floor_does_not_connect_the_two_points():
    add_node("E0", 0, 0, 0, connector_id="elevator-main")
    add_node("E0-again", 0, 500, 0, connector_id="elevator-main")

    _, adjacency = load_graph(BUILDING)

    assert neighbors(adjacency, "E0") == {}
    assert neighbors(adjacency, "E0-again") == {}


def test_different_connectors_are_not_connected():
    add_node("E0", 0, 0, 0, connector_id="elevator-main")
    add_node("S1", 1, 0, 0, connector_id="stairs-main")

    _, adjacency = load_graph(BUILDING)

    assert neighbors(adjacency, "E0") == {}


def test_a_connector_that_is_on_one_floor_only_leads_nowhere():
    add_node("E0", 0, 0, 0, connector_id="elevator-main")
    add_node("A", 1, 0, 0)

    _, adjacency = load_graph(BUILDING)

    assert neighbors(adjacency, "E0") == {}


def test_an_elevator_on_three_floors_reaches_every_floor():
    add_node("E0", 0, 0, 0, connector_id="elevator-main")
    add_node("E1", 1, 0, 0, connector_id="elevator-main")
    add_node("E2", 2, 0, 0, connector_id="elevator-main")

    _, adjacency = load_graph(BUILDING)

    assert set(neighbors(adjacency, "E0")) == {"E1", "E2"}
    assert set(neighbors(adjacency, "E1")) == {"E0", "E2"}


def test_points_with_an_empty_connector_are_not_connected():
    fake_db.nodes.docs.append({"_id": "A", "buildingId": BUILDING, "floor": 0, "x": 0, "y": 0, "connectorId": None})
    fake_db.nodes.docs.append({"_id": "B", "buildingId": BUILDING, "floor": 1, "x": 0, "y": 0, "connectorId": ""})
    add_node("C", 2, 0, 0)

    _, adjacency = load_graph(BUILDING)

    assert all(neighbors(adjacency, node_id) == {} for node_id in ("A", "B", "C"))


# ---------- The loaded graph with the algorithms ----------


def build_two_floors():
    #  floor 0:   START ---- E0          floor 1:   E1 ---- GOAL
    add_node("START", 0, 0, 0)
    add_node("E0", 0, 100, 0, connector_id="elevator-main")
    add_node("E1", 1, 100, 0, connector_id="elevator-main")
    add_node("GOAL", 1, 200, 0)
    add_edge("START", "E0")
    add_edge("E1", "GOAL")


def test_a_route_to_another_floor_goes_through_the_elevator():
    build_two_floors()

    nodes, adjacency = load_graph(BUILDING)

    assert astar(nodes, adjacency, "START", "GOAL") == ["START", "E0", "E1", "GOAL"]


def test_a_blocked_walkway_makes_the_route_go_around():
    #  A ---- B ---- C       A-B is blocked, so the way is A-D-E-C
    #  |             |
    #  D ----------- E
    add_node("A", 0, 0, 0)
    add_node("B", 0, 100, 0)
    add_node("C", 0, 200, 0)
    add_node("D", 0, 0, 100)
    add_node("E", 0, 200, 100)
    add_edge("A", "B", blocked=True)
    add_edge("B", "C")
    add_edge("A", "D")
    add_edge("D", "E")
    add_edge("E", "C")

    nodes, adjacency = load_graph(BUILDING)

    assert astar(nodes, adjacency, "A", "C") == ["A", "D", "E", "C"]


def test_there_is_no_route_when_the_only_way_is_blocked():
    build_two_floors()
    fake_db.edges.docs[0]["blocked"] = True  # START - E0

    nodes, adjacency = load_graph(BUILDING)

    assert astar(nodes, adjacency, "START", "GOAL") is None


# ---------- Shelters ----------


def test_shelter_nodes_are_the_entrances_of_the_shelters_of_this_building():
    fake_db.places.docs = [
        {"buildingId": BUILDING, "type": "shelter", "entryNodeId": "S1"},
        {"buildingId": BUILDING, "type": "shelter", "entryNodeId": "S2"},
        {"buildingId": BUILDING, "type": "store", "entryNodeId": "STORE"},
        {"buildingId": BUILDING, "type": "shelter"},  # an old shelter without an entrance
        {"buildingId": OTHER_BUILDING, "type": "shelter", "entryNodeId": "OTHER"},
    ]

    assert load_shelter_nodes(BUILDING) == {"S1", "S2"}


def test_the_closest_shelter_is_found_on_another_floor():
    build_two_floors()
    add_node("FAR", 0, 0, 900)
    add_edge("START", "FAR")

    _, adjacency = load_graph(BUILDING)
    path = dijkstra(adjacency, "START", {"GOAL", "FAR"})

    # GOAL: 100 + the floor change + 100. FAR: 900.
    assert path == ["START", "E0", "E1", "GOAL"]


# ---------- Accessibility Mode ----------


def test_accessible_mode_filters_out_stairs_nodes():
    add_node("C0", 0, 0, 0, node_type="corridor")
    add_node("S0", 0, 10, 10, connector_id="stairs-main", node_type="stairs")
    add_node("E0", 0, 20, 20, connector_id="elevator-main", node_type="elevator")

    nodes, _ = load_graph(BUILDING, accessible=True)

    assert "C0" in nodes
    assert "E0" in nodes
    assert "S0" not in nodes


def test_non_accessible_mode_includes_stairs_nodes():
    add_node("C0", 0, 0, 0, node_type="corridor")
    add_node("S0", 0, 10, 10, connector_id="stairs-main", node_type="stairs")
    add_node("E0", 0, 20, 20, connector_id="elevator-main", node_type="elevator")

    nodes, _ = load_graph(BUILDING, accessible=False)

    assert "C0" in nodes
    assert "E0" in nodes
    assert "S0" in nodes


def test_accessible_mode_does_not_connect_stairs_across_floors():
    add_node("S0", 0, 0, 0, connector_id="stairs-main", node_type="stairs")
    add_node("S1", 1, 0, 0, connector_id="stairs-main", node_type="stairs")
    add_node("E0", 0, 50, 50, connector_id="elevator-main", node_type="elevator")
    add_node("E1", 1, 50, 50, connector_id="elevator-main", node_type="elevator")

    _, adjacency = load_graph(BUILDING, accessible=True)

    assert "S0" not in adjacency
    assert "S1" not in adjacency
    assert neighbors(adjacency, "E0") == {"E1": FLOOR_CHANGE_COST}
    assert neighbors(adjacency, "E1") == {"E0": FLOOR_CHANGE_COST}


def test_accessible_route_uses_elevator_when_stairs_is_shorter():
    # Floor 0: START is closer to stairs (S0, dist 10) than elevator (E0, dist 50)
    add_node("START", 0, 0, 0)
    add_node("S0", 0, 10, 0, connector_id="stairs-main", node_type="stairs")
    add_node("S1", 1, 10, 0, connector_id="stairs-main", node_type="stairs")
    add_node("E0", 0, 50, 0, connector_id="elevator-main", node_type="elevator")
    add_node("E1", 1, 50, 0, connector_id="elevator-main", node_type="elevator")
    # The goal is closer to the stairs: 60 through them, 100 through the elevator.
    # (At 60,0 both ways cost 90, and which one comes out is luck.)
    add_node("GOAL", 1, 30, 0)

    add_edge("START", "S0")
    add_edge("START", "E0")
    add_edge("S1", "GOAL")
    add_edge("E1", "GOAL")

    # In regular mode, takes the shorter stairs
    nodes_normal, adj_normal = load_graph(BUILDING, accessible=False)
    normal_route = astar(nodes_normal, adj_normal, "START", "GOAL")
    assert normal_route == ["START", "S0", "S1", "GOAL"]

    # In accessible mode, stairs are excluded, takes elevator
    nodes_acc, adj_acc = load_graph(BUILDING, accessible=True)
    acc_route = astar(nodes_acc, adj_acc, "START", "GOAL")
    assert acc_route == ["START", "E0", "E1", "GOAL"]


def test_accessible_route_returns_none_when_only_stairs_available():
    add_node("START", 0, 0, 0)
    add_node("S0", 0, 10, 0, connector_id="stairs-main", node_type="stairs")
    add_node("S1", 1, 10, 0, connector_id="stairs-main", node_type="stairs")
    add_node("GOAL", 1, 20, 0)

    add_edge("START", "S0")
    add_edge("S1", "GOAL")

    # Regular mode has a route via stairs
    nodes_normal, adj_normal = load_graph(BUILDING, accessible=False)
    assert astar(nodes_normal, adj_normal, "START", "GOAL") == ["START", "S0", "S1", "GOAL"]

    # Accessible mode returns None because only stairs connect the floors
    nodes_acc, adj_acc = load_graph(BUILDING, accessible=True)
    assert astar(nodes_acc, adj_acc, "START", "GOAL") is None


def test_accessible_shelter_route_uses_elevator_when_available():
    add_node("START", 0, 0, 0)
    add_node("S0", 0, 10, 0, connector_id="stairs-main", node_type="stairs")
    add_node("S1", 1, 10, 0, connector_id="stairs-main", node_type="stairs")
    add_node("E0", 0, 50, 0, connector_id="elevator-main", node_type="elevator")
    add_node("E1", 1, 50, 0, connector_id="elevator-main", node_type="elevator")
    add_node("SHELTER", 1, 100, 0)

    add_edge("START", "S0")
    add_edge("START", "E0")
    add_edge("S1", "SHELTER")
    add_edge("E1", "SHELTER")

    fake_db.places.docs = [{"buildingId": BUILDING, "type": "shelter", "entryNodeId": "SHELTER"}]

    nodes_acc, adj_acc = load_graph(BUILDING, accessible=True)
    targets = {node_id for node_id in load_shelter_nodes(BUILDING) if node_id in nodes_acc}
    path = dijkstra(adj_acc, "START", targets)
    assert path == ["START", "E0", "E1", "SHELTER"]


def test_accessible_shelter_route_returns_none_when_only_stairs_available():
    add_node("START", 0, 0, 0)
    add_node("S0", 0, 10, 0, connector_id="stairs-main", node_type="stairs")
    add_node("S1", 1, 10, 0, connector_id="stairs-main", node_type="stairs")
    add_node("SHELTER", 1, 100, 0)

    add_edge("START", "S0")
    add_edge("S1", "SHELTER")

    fake_db.places.docs = [{"buildingId": BUILDING, "type": "shelter", "entryNodeId": "SHELTER"}]

    nodes_acc, adj_acc = load_graph(BUILDING, accessible=True)
    targets = {node_id for node_id in load_shelter_nodes(BUILDING) if node_id in nodes_acc}
    path = dijkstra(adj_acc, "START", targets)
    assert path is None


def test_accessible_mode_filters_out_stairs_connector_even_if_node_type_is_corridor():
    add_node("C_STAIR", 0, 10, 10, connector_id="staircase-north", node_type="corridor")
    add_node("REGULAR", 0, 20, 20, node_type="corridor")

    nodes, _ = load_graph(BUILDING, accessible=True)
    assert "C_STAIR" not in nodes
    assert "REGULAR" in nodes


def test_accessible_mode_filters_out_stairs_connector_with_stair_in_name_and_no_type():
    add_node("S_NOTYPE", 0, 10, 10, connector_id="stair-1")
    add_node("REGULAR", 0, 20, 20, node_type="corridor")

    nodes, _ = load_graph(BUILDING, accessible=True)
    assert "S_NOTYPE" not in nodes
    assert "REGULAR" in nodes


