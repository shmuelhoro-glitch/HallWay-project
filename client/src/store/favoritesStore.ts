import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FavoritePlace, UserFavorites } from '../types/auth';
import { useAuthStore } from './authStore';
import { getFavorites, updateFavorites } from '../api/auth';

const NO_FAVORITES: UserFavorites = { buildings: [], places: [] };

interface FavoritesState {
  favorites: UserFavorites;
  ownerId: string | null; // the user these favorites belong to
  isBuildingFavorite: (buildingId: string) => boolean;
  isPlaceFavorite: (placeId: string) => boolean;
  // Both return false when nobody is logged in, so the screen can ask the visitor to log in
  toggleBuildingFavorite: (buildingId: string) => boolean;
  togglePlaceFavorite: (place: FavoritePlace) => boolean;
}

// The favorites of the logged-in user. The server keeps them; the copy in localStorage only
// shows them right away when the page opens, before the server answered.
export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (_set, get) => ({
      favorites: NO_FAVORITES,
      ownerId: null,

      isBuildingFavorite: (buildingId) => get().favorites.buildings.includes(buildingId),

      isPlaceFavorite: (placeId) => get().favorites.places.some((place) => place.id === placeId),

      toggleBuildingFavorite: (buildingId) => {
        const { buildings, places } = get().favorites;
        const isFavorite = buildings.includes(buildingId);

        return saveFavorites({
          buildings: isFavorite ? buildings.filter((id) => id !== buildingId) : [...buildings, buildingId],
          places,
        });
      },

      togglePlaceFavorite: (place) => {
        const { buildings, places } = get().favorites;
        const isFavorite = places.some((item) => item.id === place.id);

        return saveFavorites({
          buildings,
          places: isFavorite ? places.filter((item) => item.id !== place.id) : [...places, place],
        });
      },
    }),
    { name: 'inroute-favorites' },
  ),
);

// Counts the changes made here, so an answer of the server that was asked for before a change
// does not bring the old list back
let changeCount = 0;

// Shows the change right away and sends the whole list to the server
function saveFavorites(next: UserFavorites): boolean {
  const user = useAuthStore.getState().user;
  if (!user) return false;

  changeCount += 1;
  useFavoritesStore.setState({ favorites: next, ownerId: user.id });

  updateFavorites(next).catch(() => {
    // Not saved: show what the server really has, and not a star that will be gone tomorrow
    loadFavorites(user.id);
  });

  return true;
}

async function loadFavorites(userId: string) {
  const changesBefore = changeCount;

  try {
    const { favorites } = await getFavorites();

    const isStillThisUser = useAuthStore.getState().user?.id === userId;
    if (isStillThisUser && changeCount === changesBefore) {
      useFavoritesStore.setState({ favorites, ownerId: userId });
    }
  } catch {
    // No answer: the saved copy stays
  }
}

// Another user (or nobody) in this browser: the favorites of the last one must not stay
function followUser(userId: string | null) {
  if (useFavoritesStore.getState().ownerId !== userId) {
    useFavoritesStore.setState({ favorites: NO_FAVORITES, ownerId: userId });
  }
  if (userId) {
    loadFavorites(userId);
  }
}

followUser(useAuthStore.getState().user?.id ?? null);

useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) {
    followUser(state.user?.id ?? null);
  }
});
