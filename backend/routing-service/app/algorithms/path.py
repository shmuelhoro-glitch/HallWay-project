# Helpers that both algorithms use.


# came_from says from which node we reached each node.
# We walk it backwards from the end, then flip the list.
def build_path(came_from, end):
    path = [end]
    while path[-1] in came_from:
        path.append(came_from[path[-1]])
    path.reverse()
    return path


# The total weight of a path: the sum of the edges between each pair of nodes in it
def path_length(adjacency, path):
    total = 0
    for i in range(len(path) - 1):
        current = path[i]
        next_node = path[i + 1]
        weights = [weight for neighbor, weight in adjacency[current] if neighbor == next_node]
        total += min(weights)
    return total
