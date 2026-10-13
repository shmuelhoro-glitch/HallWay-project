import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FavoritePlace, UserFavorites } from '../types/auth';
import { useAuthStore } from './authStore';
import { updateFavorites as apiUpdateFavorites } from '../api/auth';

interface FavoritesState {
  favorites: UserFavorites;
  isBuildingFavorite: (buildingId: string) => boolean;
  isPlaceFavorite: (placeId: string) => boolean;
  toggleBuildingFavorite: (buildingId: string) => boolean;
  togglePlaceFavorite: (place: FavoritePlace) => boolean;
  setFavorites: (favorites: UserFavorites) => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: { buildings: [], places: [] },

      isBuildingFavorite: (buildingId: string) => {
        const { favorites } = get();
        return favorites.buildings.includes(buildingId);
      },

      isPlaceFavorite: (placeId: string) => {
        const { favorites } = get();
        return favorites.places.some((p) => p.id === placeId);
      },

      toggleBuildingFavorite: (buildingId: string) => {
        const user = useAuthStore.getState().user;
        if (!user) {
          // Visitor is not logged in -> return false so UI can show login prompt
          return false;
        }

        const current = get().favorites;
        const isFav = current.buildings.includes(buildingId);
        const nextBuildings = isFav
          ? current.buildings.filter((id) => id !== buildingId)
          : [...current.buildings, buildingId];

        const nextFavorites: UserFavorites = {
          ...current,
          buildings: nextBuildings,
        };

        set({ favorites: nextFavorites });

        // Update authStore user object
        const updatedUser = { ...user, favorites: nextFavorites };
        useAuthStore.setState({ user: updatedUser });

        // Sync with backend API
        apiUpdateFavorites(nextFavorites).catch((err) => {
          console.error('Failed to sync favorites with server:', err);
        });

        return true;
      },

      togglePlaceFavorite: (place: FavoritePlace) => {
        const user = useAuthStore.getState().user;
        if (!user) {
          // Visitor is not logged in -> return false so UI can show login prompt
          return false;
        }

        const current = get().favorites;
        const isFav = current.places.some((p) => p.id === place.id);
        const nextPlaces = isFav
          ? current.places.filter((p) => p.id !== place.id)
          : [...current.places, place];

        const nextFavorites: UserFavorites = {
          ...current,
          places: nextPlaces,
        };

        set({ favorites: nextFavorites });

        // Update authStore user object
        const updatedUser = { ...user, favorites: nextFavorites };
        useAuthStore.setState({ user: updatedUser });

        // Sync with backend API
        apiUpdateFavorites(nextFavorites).catch((err) => {
          console.error('Failed to sync favorites with server:', err);
        });

        return true;
      },

      setFavorites: (favorites: UserFavorites) => {
        set({ favorites });
      },
    }),
    { name: 'inroute-favorites' },
  ),
);
