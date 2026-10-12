import { describe, expect, test } from 'vitest';
import type { RouteNode } from '../types/navigation';
import { splitPathByFloor } from './route';

function node(id: string, floor: number): RouteNode {
  return { id, floor, x: 0, y: 0 };
}

function idsOf(segments: RouteNode[][]): string[][] {
  return segments.map((segment) => segment.map((item) => item.id));
}

describe('splitPathByFloor', () => {
  test('a route on one floor is one part', () => {
    const path = [node('a', 0), node('b', 0), node('c', 0)];

    expect(idsOf(splitPathByFloor(path))).toEqual([['a', 'b', 'c']]);
  });

  test('every floor change starts a new part', () => {
    const path = [node('a', 0), node('e0', 0), node('e1', 1), node('b', 1)];

    expect(idsOf(splitPathByFloor(path))).toEqual([
      ['a', 'e0'],
      ['e1', 'b'],
    ]);
  });

  test('coming back to a floor is a new part, not a line through the walls', () => {
    const path = [node('a', 0), node('up', 1), node('down', 0)];

    expect(idsOf(splitPathByFloor(path))).toEqual([['a'], ['up'], ['down']]);
  });

  test('an empty route has no parts', () => {
    expect(splitPathByFloor([])).toEqual([]);
  });
});
