import type { Floor } from '../types/building';

// "Ground floor" if the admin gave the floor a name, otherwise "Floor 0"
export function getFloorName(floors: Floor[], floorNumber: number): string {
  const floor = floors.find((item) => item.floor === floorNumber);
  if (floor && floor.name) {
    return floor.name;
  }
  return `Floor ${floorNumber}`;
}
