import type { Place } from '../types/place';
import type { MapNode, StartPoint } from '../types/navigation';

// Standing next to a place = starting from its entry node
export function placeToStartPoint(place: Place): StartPoint {
  return {
    nodeId: place.entryNodeId,
    floor: place.floor,
    x: place.x,
    y: place.y,
    label: place.name,
  };
}

// Standing at a QR sign = starting from that node
export function nodeToStartPoint(node: MapNode): StartPoint {
  return {
    nodeId: node.id,
    floor: node.floor,
    x: node.x,
    y: node.y,
    label: node.label || 'קוד QR',
  };
}
