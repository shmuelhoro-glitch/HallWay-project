import { describe, expect, test } from 'vitest';
import type { Building, BuildingType } from '../types/building';
import { searchBuildings } from './buildingSearch';

function building(name: string, city: string, type: BuildingType, lat = 32, lng = 34.8): Building {
  return { id: name, name, type, address: 'הרצל 1', city, lat, lng, floors_count: 2 };
}

const SEA_MALL = building('קניון הים', 'תל אביב', 'mall', 32.08, 34.77);
const NORTH_MALL = building('קניון הצפון', 'חיפה', 'mall', 32.79, 34.99);
const HOSPITAL = building('בית החולים הים', 'חיפה', 'hospital', 32.8, 35.0);
const ALL = [NORTH_MALL, HOSPITAL, SEA_MALL];

function namesOf(buildings: Building[], text: string, type: BuildingType | null = null, userPoint = null as null | { lat: number; lng: number }) {
  return searchBuildings(buildings, text, type, userPoint).map((result) => result.building.name);
}

describe('searchBuildings', () => {
  test('an empty search shows every building, by name', () => {
    expect(namesOf(ALL, '')).toEqual(['בית החולים הים', 'קניון הים', 'קניון הצפון']);
  });

  test('the text is found in the name, the city or the address', () => {
    expect(namesOf(ALL, 'צפון')).toEqual(['קניון הצפון']);
    expect(namesOf(ALL, 'תל אביב')).toEqual(['קניון הים']);
    expect(namesOf(ALL, 'הרצל')).toHaveLength(3);
  });

  test('every word must be found, in any order, with any spaces', () => {
    expect(namesOf(ALL, '  חיפה   קניון ')).toEqual(['קניון הצפון']);
    expect(namesOf(ALL, 'קניון אילת')).toEqual([]);
  });

  test('a name that starts with the text comes before a name that only has it', () => {
    // By name alone "בית קניון" would be first
    const houseOfMall = building('בית קניון', 'אילת', 'other');

    expect(namesOf([houseOfMall, SEA_MALL], 'קניון')).toEqual(['קניון הים', 'בית קניון']);
  });

  test('equal matches without a location are sorted by name', () => {
    expect(namesOf(ALL, 'הים')).toEqual(['בית החולים הים', 'קניון הים']);
  });

  test('the type filter leaves only that type', () => {
    expect(namesOf(ALL, '', 'hospital')).toEqual(['בית החולים הים']);
    expect(namesOf(ALL, 'קניון', 'hospital')).toEqual([]);
  });

  test('with the location of the user, equal matches are sorted from the closest', () => {
    const inHaifa = { lat: 32.79, lng: 34.99 };

    expect(namesOf(ALL, '', null, inHaifa)).toEqual(['קניון הצפון', 'בית החולים הים', 'קניון הים']);
  });

  test('the distance is returned only when the location of the user is known', () => {
    expect(searchBuildings([SEA_MALL], '', null, null)[0].distanceKm).toBeNull();
    expect(searchBuildings([SEA_MALL], '', null, { lat: 32.08, lng: 34.77 })[0].distanceKm).toBe(0);
  });
});
