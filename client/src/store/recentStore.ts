import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Building } from '../types/building';

const MAX_RECENT = 4;

// Only what the search list shows, not the whole building
export interface RecentBuilding {
  id: string;
  name: string;
  city: string;
}

interface RecentState {
  recent: RecentBuilding[];
  addRecent: (building: Building) => void;
  clearRecent: () => void;
}

// The buildings the user entered lately, newest first. Saved in localStorage like the login.
export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      recent: [],

      addRecent: (building) =>
        set((state) => {
          // Remove it if it is already in the list, then put it first
          const others = state.recent.filter((item) => item.id !== building.id);
          const newItem = { id: building.id, name: building.name, city: building.city };
          return { recent: [newItem, ...others].slice(0, MAX_RECENT) };
        }),

      clearRecent: () => set({ recent: [] }),
    }),
    { name: 'inroute-recent' },
  ),
);
