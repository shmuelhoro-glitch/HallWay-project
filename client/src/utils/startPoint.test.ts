import { describe, expect, test } from 'vitest';
import type { Place } from '../types/place';
import { nodeToStartPoint, placeToStartPoint } from './startPoint';

describe('placeToStartPoint', () => {
  test('standing next to a place means starting from its entrance node', () => {
    const place = { _id: 'p1', name: 'Sea Fashion', floor: 1, x: 100, y: 200, entryNodeId: 'n1' } as Place;

    expect(placeToStartPoint(place)).toEqual({ nodeId: 'n1', floor: 1, x: 100, y: 200, label: 'Sea Fashion' });
  });
});

describe('nodeToStartPoint', () => {
  const node = { id: 'n7', buildingId: 'b1', floor: 0, x: 10, y: 20 };

  test('a QR point with a name starts from that point, with its name', () => {
    expect(nodeToStartPoint({ ...node, label: 'כניסה צפונית' })).toEqual({
      nodeId: 'n7',
      floor: 0,
      x: 10,
      y: 20,
      label: 'כניסה צפונית',
    });
  });

  test('a QR point without a name is called "קוד QR"', () => {
    expect(nodeToStartPoint(node).label).toBe('קוד QR');
    expect(nodeToStartPoint({ ...node, label: '' }).label).toBe('קוד QR');
  });
});
