export type PlaceType = 'store' | 'service' | 'shelter';

// Places come from MongoDB, so the id field is _id
export interface Place {
  _id: string;
  buildingId: string;
  floor: number;
  name: string;
  type: PlaceType;
  category: string;
  x: number;
  y: number;
  hours?: string;
  url?: string;
  isLandmark: boolean;
  entryNodeId: string;
}

export interface PlaceQuery {
  q?: string;
  category?: string;
  floor?: number;
}
