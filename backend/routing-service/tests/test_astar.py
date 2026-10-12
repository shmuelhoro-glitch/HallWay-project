import networkx
import pytest

from app.algorithms.astar import astar
from tests.graphs import make_graph, path_weight


def check_against_networkx(nodes, adjacency, nx_graph, start, goal):
    path = astar(nodes, adjacency, start, goal)
    expected = networkx.shortest_path_length(nx_graph, start, goal, weight="weight")

    assert path[0] == start
    assert path[-1] == goal
    assert path_weight(adjacency, path) == pytest.approx(expected)
    return path


def test_simple_path_with_known_answer():
    #  A ---- B ---- C        the straight way A-B-C is 200 long
    #  |             |
    #  D ----------- E        the way around is 400 long
    points = {"A": (0, 0, 0), "B": (0, 100, 0), "C": (0, 200, 0), "D": (0, 0, 100), "E": (0, 200, 100)}
    walkways = [("A", "B"), ("B", "C"), ("A", "D"), ("D", "E"), ("E", "C")]
    nodes, adjacency, nx_graph = make_graph(points, walkways)

    path = check_against_networkx(nodes, adjacency, nx_graph, "A", "C")
    assert path == ["A", "B", "C"]


def test_two_floors_with_an_elevator():
    # Floor 0: A - E0 (elevator).  Floor 1: E1 (elevator) - G.  The elevator costs 30.
    points = {"A": (0, 0, 0), "E0": (0, 100, 0), "E1": (1, 100, 0), "G": (1, 100, 100)}
    walkways = [("A", "E0"), ("E1", "G")]
    nodes, adjacency, nx_graph = make_graph(points, walkways, floor_links=[("E0", "E1", 30)])

    path = check_against_networkx(nodes, adjacency, nx_graph, "A", "G")
    assert path == ["A", "E0", "E1", "G"]
    assert path_weight(adjacency, path) == pytest.approx(230)


def test_blocked_walkway_takes_the_way_around():
    # The same square as the first test, but B-C is blocked (not loaded into the graph)
    points = {"A": (0, 0, 0), "B": (0, 100, 0), "C": (0, 200, 0), "D": (0, 0, 100), "E": (0, 200, 100)}
    walkways = [("A", "B"), ("A", "D"), ("D", "E"), ("E", "C")]
    nodes, adjacency, nx_graph = make_graph(points, walkways)

    path = check_against_networkx(nodes, adjacency, nx_graph, "A", "C")
    assert path == ["A", "D", "E", "C"]


def test_no_route_returns_none():
    # Two parts with no walkway between them
    points = {"A": (0, 0, 0), "B": (0, 50, 0), "C": (0, 300, 0)}
    nodes, adjacency, _ = make_graph(points, [("A", "B")])

    assert astar(nodes, adjacency, "A", "C") is None


def test_start_is_the_goal():
    points = {"A": (0, 0, 0), "B": (0, 50, 0)}
    nodes, adjacency, _ = make_graph(points, [("A", "B")])

    assert astar(nodes, adjacency, "A", "A") == ["A"]


def test_bigger_grid_matches_networkx():
    # A 6x6 grid with a few missing walkways - many possible paths
    points = {}
    for row in range(6):
        for col in range(6):
            points[f"{row}-{col}"] = (0, col * 40, row * 40)

    walkways = []
    for row in range(6):
        for col in range(6):
            if col < 5 and (row, col) not in [(1, 1), (2, 3), (4, 0)]:
                walkways.append((f"{row}-{col}", f"{row}-{col + 1}"))
            if row < 5 and (row, col) not in [(0, 2), (3, 3), (2, 5)]:
                walkways.append((f"{row}-{col}", f"{row + 1}-{col}"))

    nodes, adjacency, nx_graph = make_graph(points, walkways)
    check_against_networkx(nodes, adjacency, nx_graph, "0-0", "5-5")
    check_against_networkx(nodes, adjacency, nx_graph, "5-0", "0-5")
