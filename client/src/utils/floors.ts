import type { Floor } from '../types/building';

// The name of a floor that the admin did not name: "קומת קרקע", "קומה 2", "קומה מינוס 1".
// A basement is written with the word "מינוס": the sign "-" jumps to the wrong side of the number in Hebrew text.
export function getDefaultFloorName(floorNumber: number): string {
  if (floorNumber === 0) return 'קומת קרקע';
  if (floorNumber < 0) return `קומה מינוס ${-floorNumber}`;
  return `קומה ${floorNumber}`;
}

// The floor asked for in the address (?floor=1), when the building really has it. Otherwise null.
export function getLinkedFloor(searchParams: URLSearchParams, floors: Floor[]): number | null {
  const value = searchParams.get('floor');
  if (value === null || value === '') return null;

  const floorNumber = Number(value);
  return floors.some((floor) => floor.floor === floorNumber) ? floorNumber : null;
}

// The name the admin gave the floor, or the default name when he gave none
export function getFloorName(floors: Floor[], floorNumber: number): string {
  const floor = floors.find((item) => item.floor === floorNumber);
  if (floor && floor.name) {
    return floor.name;
  }
  return getDefaultFloorName(floorNumber);
}
