import heapq
import math

from app.algorithms.path import build_path


# The path to the CLOSEST of several targets (for example, the nearest shelter).
#   adjacency: id -> [(neighbor_id, weight), ...]
#   targets:   a set of ids
# Returns a list of ids, or None when no target can be reached.
#
# Dijkstra takes nodes out of the queue from the closest to the farthest.
# So the first target that comes out is the closest one, and we can stop there.
# A* doesn't fit here: it needs one goal to aim at.
def dijkstra(adjacency, start, targets):
    if not targets:
        return None

    distances = {start: 0}
    came_from = {}
    done = set()
    queue = [(0, start)]

    while queue:
        current_distance, current = heapq.heappop(queue)

        if current in targets:
            return build_path(came_from, current)

        if current in done:
            continue
        done.add(current)

        for neighbor, weight in adjacency.get(current, []):
            new_distance = current_distance + weight

            if new_distance < distances.get(neighbor, math.inf):
                distances[neighbor] = new_distance
                came_from[neighbor] = current
                heapq.heappush(queue, (new_distance, neighbor))

    return None
