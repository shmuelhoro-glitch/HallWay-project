import { createContext, useContext } from 'react';

// How many floor-plan units are one screen pixel right now.
// Layers multiply their sizes by it, so a marker stays the same size on screen
// no matter how big the plan is or how much the user zoomed in.
export const MapScaleContext = createContext(1);

export function useMapScale(): number {
  return useContext(MapScaleContext);
}
