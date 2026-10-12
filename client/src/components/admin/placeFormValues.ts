import type { PlaceType } from '../../types/place';

// What the form holds while the admin types. x / y are null until he clicks on the map.
export interface PlaceFormValues {
  name: string;
  type: PlaceType;
  category: string;
  hours: string;
  url: string;
  isLandmark: boolean;
  x: number | null;
  y: number | null;
}

export const EMPTY_PLACE_FORM: PlaceFormValues = {
  name: '',
  type: 'store',
  category: '',
  hours: '',
  url: '',
  isLandmark: false,
  x: null,
  y: null,
};
