import { describe, expect, test } from 'vitest';
import type { Building } from '../types/building';
import { formatDistance, getBuildingPoint, getDistanceKm } from './distance';

describe('formatDistance', () => {
  test('less than a kilometer is shown in meters, rounded to 10', () => {
    expect(formatDistance(0.348)).toBe('350 מ׳');
    expect(formatDistance(0.004)).toBe('0 מ׳');
  });

  test('up to 10 km keeps one digit after the point', () => {
    expect(formatDistance(1)).toBe('1.0 ק״מ');
    expect(formatDistance(2.46)).toBe('2.5 ק״מ');
  });

  test('from 10 km it is a whole number', () => {
    expect(formatDistance(37.2)).toBe('37 ק״מ');
  });
});

describe('getDistanceKm', () => {
  const telAviv = { lat: 32.0853, lng: 34.7818 };
  const jerusalem = { lat: 31.7683, lng: 35.2137 };

  test('Tel Aviv to Jerusalem is about 54 km in a straight line', () => {
    const distance = getDistanceKm(telAviv, jerusalem);

    expect(distance).toBeGreaterThan(52);
    expect(distance).toBeLessThan(56);
  });

  test('the distance is the same in both directions, and zero to the same point', () => {
    expect(getDistanceKm(telAviv, jerusalem)).toBeCloseTo(getDistanceKm(jerusalem, telAviv));
    expect(getDistanceKm(telAviv, telAviv)).toBe(0);
  });
});

describe('getBuildingPoint', () => {
  test('coordinates that came from the database as text become numbers', () => {
    const building = { lat: '32.08', lng: '34.78' } as unknown as Building;

    expect(getBuildingPoint(building)).toEqual({ lat: 32.08, lng: 34.78 });
  });
});
