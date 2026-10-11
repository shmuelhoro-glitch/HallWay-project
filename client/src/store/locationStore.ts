import { create } from 'zustand';
import type { StartPoint } from '../types/navigation';

interface LocationState {
  start: StartPoint | null;
  setStart: (start: StartPoint) => void;
  clearStart: () => void;
}

// The visitor's starting point: from a QR code or from "I'm near..."
export const useLocationStore = create<LocationState>()((set) => ({
  start: null,
  setStart: (start) => set({ start }),
  clearStart: () => set({ start: null }),
}));
