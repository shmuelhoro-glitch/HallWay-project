import heapq
import math

from app.algorithms.heuristics import distance
from app.algorithms.path import build_path


# The shortest path from start to goal.
#   nodes:     id -> { "id", "floor", "x", "y" }
#   adjacency: id -> [(neighbor_id, weight), ...]
# Returns a list of ids from start to goal, or None when there is no way to get there.
#
# Like Dijkstra, but the queue is ordered by f = g + h:
#   g = the real distance from the start so far
#   h = the straight-line guess to the goal
# The guess makes it check the nodes in the goal's direction first, so it finishes sooner.
def astar(nodes, adjacency, start, goal):
    if start not in nodes or goal not in nodes:
        return None

    g = {start: 0}
    came_from = {}
    done = set()

    # The queue holds (f, node_id). heapq always gives back the smallest f.
    queue = [(distance(nodes[start], nodes[goal]), start)]

    while queue:
        _, current = heapq.heappop(queue)

        if current == goal:
            return build_path(came_from, goal)

        # The same node can be in the queue more than once. Only the first time counts.
        if current in done:
            continue
        done.add(current)

        for neighbor, weight in adjacency.get(current, []):
            new_g = g[current] + weight

            # Found a shorter way to the neighbor - remember it
            if new_g < g.get(neighbor, math.inf):
                g[neighbor] = new_g
                came_from[neighbor] = current
                f = new_g + distance(nodes[neighbor], nodes[goal])
                heapq.heappush(queue, (f, neighbor))

    return None
