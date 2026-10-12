import { describe, expect, test } from 'vitest';
import type { Floor } from '../types/building';
import { getDefaultFloorName, getFloorName } from './floors';

const FLOORS: Floor[] = [
  { floor: -1, name: '', width: 640, height: 1000 },
  { floor: 0, name: 'קומת הכניסה', width: 640, height: 1000 },
  { floor: 1, name: '', width: 640, height: 1000 },
];

describe('getDefaultFloorName', () => {
  test('the ground floor has its own name', () => {
    expect(getDefaultFloorName(0)).toBe('קומת קרקע');
  });

  test('a floor above the ground is named by its number', () => {
    expect(getDefaultFloorName(3)).toBe('קומה 3');
  });

  test('a basement is written with a word, never with a minus sign', () => {
    expect(getDefaultFloorName(-2)).toBe('קומה מינוס 2');
    expect(getDefaultFloorName(-2)).not.toContain('-');
  });
});

describe('getFloorName', () => {
  test('the name the admin gave wins', () => {
    expect(getFloorName(FLOORS, 0)).toBe('קומת הכניסה');
  });

  test('a floor without a name gets the default name', () => {
    expect(getFloorName(FLOORS, 1)).toBe('קומה 1');
    expect(getFloorName(FLOORS, -1)).toBe('קומה מינוס 1');
  });

  test('a floor that is not in the list still gets a name', () => {
    expect(getFloorName(FLOORS, 7)).toBe('קומה 7');
  });
});
