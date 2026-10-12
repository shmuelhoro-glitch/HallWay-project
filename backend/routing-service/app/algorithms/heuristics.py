import math


# Straight-line distance between two points on the floor plan.
# A* uses it to guess how far the goal still is. Floors are ignored on purpose:
# the guess must never be bigger than the real distance, and this one never is.
def distance(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])
