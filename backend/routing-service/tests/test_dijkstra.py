import networkx
import pytest

from app.algorithms.dijkstra import dijkstra
from tests.graphs import make_graph, path_weight


def test_two_shelters_picks_the_closer_one():
    #  S1 ---- A ------------ S2       S1 is 100 away, S2 is 300 away
    points = {"S1": (0, 0, 0), "A": (0, 100, 0), "S2": (0, 400, 0)}
    nodes, adjacency, nx_graph = make_graph(points, [("S1", "A"), ("A", "S2")])

    path = dijkstra(adjacency, "A", {"S1", "S2"})

    assert path == ["A", "S1"]
    expected = networkx.shortest_path_length(nx_graph, "A", "S1", weight="weight")
    assert path_weight(adjacency, path) == pytest.approx(expected)


def test_closer_in_a_straight_line_is_not_always_closer():
    # S1 is right next to A in a straight line, but the walkway to it goes around a wall
    points = {"A": (0, 0, 0), "S1": (0, 20, 0), "W": (0, 0, 300), "S2": (0, 150, 0)}
    walkways = [("A", "W"), ("W", "S1"), ("A", "S2")]
    nodes, adjacency, nx_graph = make_graph(points, walkways)

    path = dijkstra(adjacency, "A", {"S1", "S2"})

    assert path == ["A", "S2"]
    best = min(
        networkx.shortest_path_length(nx_graph, "A", target, weight="weight") for target in ["S1", "S2"]
    )
    assert path_weight(adjacency, path) == pytest.approx(best)


def test_shelter_on_another_floor():
    points = {"A": (0, 0, 0), "E0": (0, 50, 0), "E1": (1, 50, 0), "S": (1, 50, 80)}
    walkways = [("A", "E0"), ("E1", "S")]
    nodes, adjacency, nx_graph = make_graph(points, walkways, floor_links=[("E0", "E1", 30)])

    path = dijkstra(adjacency, "A", {"S"})

    assert path == ["A", "E0", "E1", "S"]
    assert path_weight(adjacency, path) == pytest.approx(
        networkx.shortest_path_length(nx_graph, "A", "S", weight="weight")
    )


def test_no_shelter_reachable_returns_none():
    points = {"A": (0, 0, 0), "B": (0, 50, 0), "S": (0, 500, 0)}
    nodes, adjacency, _ = make_graph(points, [("A", "B")])

    assert dijkstra(adjacency, "A", {"S"}) is None


def test_no_shelters_at_all_returns_none():
    points = {"A": (0, 0, 0), "B": (0, 50, 0)}
    nodes, adjacency, _ = make_graph(points, [("A", "B")])

    assert dijkstra(adjacency, "A", set()) is None
