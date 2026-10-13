// Helping the admin draw straight walkways: a point that is almost in line with
// another point is pulled into line with it. Everything here is in floor-plan coordinates.

export interface Point {
  x: number;
  y: number;
}

// How close (in screen pixels) a point must be to be pulled. Small on purpose:
// a strong pull would move points to spots the admin did not mean.
export const SNAP_PIXELS = 8;

export interface SnapResult {
  x: number;
  y: number;
  alignedX: Point | null; // the point we now share an x with (a vertical line between them)
  alignedY: Point | null; // the point we now share a y with (a horizontal line between them)
}

// Pulls the point into a vertical and / or horizontal line with the closest reference point.
// references: the points it is connected to (the point before it while drawing, its neighbors while dragging).
export function snapToAxes(point: Point, references: Point[], tolerance: number): SnapResult {
  const result: SnapResult = { x: point.x, y: point.y, alignedX: null, alignedY: null };
  let bestX = tolerance;
  let bestY = tolerance;

  for (const reference of references) {
    const distanceX = Math.abs(point.x - reference.x);
    const distanceY = Math.abs(point.y - reference.y);

    if (distanceX <= bestX) {
      bestX = distanceX;
      result.x = reference.x;
      result.alignedX = reference;
    }
    if (distanceY <= bestY) {
      bestY = distanceY;
      result.y = reference.y;
      result.alignedY = reference;
    }
  }

  return result;
}

// The closest of the points that are within the tolerance, or null when none is
export function findNearPoint<T extends Point>(point: Point, candidates: T[], tolerance: number): T | null {
  let nearest: T | null = null;
  let nearestDistance = tolerance;

  for (const candidate of candidates) {
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (distance <= nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}
