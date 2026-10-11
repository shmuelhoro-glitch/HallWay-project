import type { RouteNode } from '../types/navigation';

// Splits the route into parts, one part for each continuous stay on a floor.
// Floor 0 -> 1 -> 0 becomes three parts, so we never draw a line through walls.
export function splitPathByFloor(path: RouteNode[]): RouteNode[][] {
  const segments: RouteNode[][] = [];

  for (const node of path) {
    const lastSegment = segments[segments.length - 1];

    if (lastSegment && lastSegment[0].floor === node.floor) {
      lastSegment.push(node);
    } else {
      segments.push([node]);
    }
  }

  return segments;
}
