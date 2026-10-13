import { useMemo, useState } from 'react';
import type { Floor } from '../../types/building';
import type { Place } from '../../types/place';
import { getFloorName } from '../../utils/floors';
import { DirectionsIcon, MapIcon, SearchIcon, StarIcon, StoreIcon, ShieldIcon } from '../ui/Icons';
import { useFavoritesStore } from '../../store/favoritesStore';
import './StoresDirectory.css';

interface StoresDirectoryProps {
  places: Place[];
  floors: Floor[];
  currentFloor: number;
  onSelectPlace: (place: Place) => void;
  onNavigateToPlace: (place: Place) => void;
  onShowOnMap: (place: Place) => void;
  onPromptLogin?: () => void;
}

export default function StoresDirectory({
  places,
  floors,
  currentFloor,
  onSelectPlace,
  onNavigateToPlace,
  onShowOnMap,
  onPromptLogin,
}: StoresDirectoryProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null); // null = all floors
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const favoritePlaces = useFavoritesStore((state) => state.favorites?.places ?? []);
  const togglePlaceFavorite = useFavoritesStore((state) => state.togglePlaceFavorite);

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    places.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [places]);

  // Filtered places
  const filteredPlaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    return places.filter((p) => {
      if (selectedFloor !== null && p.floor !== selectedFloor) return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (favoritesOnly && !favoritePlaces.some((fav) => fav.id === p._id)) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.category || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [places, search, selectedCategory, selectedFloor, favoritesOnly, favoritePlaces]);

  function handleToggleFav(e: React.MouseEvent, place: Place) {
    e.stopPropagation();
    const success = togglePlaceFavorite({
      id: place._id,
      buildingId: place.buildingId,
      name: place.name,
      category: place.category,
      floor: place.floor,
    });
    if (!success && onPromptLogin) {
      onPromptLogin();
    }
  }

  return (
    <div className="stores-directory">
      {/* Search Input */}
      <div className="stores-directory-search">
        <SearchIcon size={18} />
        <input
          type="search"
          className="stores-search-input"
          placeholder="חיפוש חנות, מסעדה או שירות..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            className="stores-search-clear"
            onClick={() => setSearch('')}
            aria-label="נקה חיפוש"
          >
            ✕
          </button>
        )}
      </div>

      {/* Floor Filter */}
      <div className="segmented stores-floor-tabs" role="group" aria-label="סינון קומה">
        <button
          type="button"
          aria-pressed={selectedFloor === null}
          onClick={() => setSelectedFloor(null)}
        >
          כל הקומות ({places.length})
        </button>
        {floors.map((fl) => {
          const count = places.filter((p) => p.floor === fl.floor).length;
          const isCurrent = fl.floor === currentFloor;
          return (
            <button
              key={fl.floor}
              type="button"
              aria-pressed={selectedFloor === fl.floor}
              onClick={() => setSelectedFloor(fl.floor)}
              title={isCurrent ? 'הקומה הנוכחית שלך' : undefined}
            >
              {getFloorName(floors, fl.floor)}{isCurrent ? ' 📍' : ''} ({count})
            </button>
          );
        })}
      </div>

      {/* Category Pills */}
      <div className="chip-row stores-category-chips" role="group" aria-label="סינון קטגוריות">
        <button
          type="button"
          className={`chip ${!selectedCategory && !favoritesOnly ? 'chip-active' : ''}`}
          onClick={() => {
            setSelectedCategory(null);
            setFavoritesOnly(false);
          }}
        >
          הכול
        </button>

        <button
          type="button"
          className={`chip ${favoritesOnly ? 'chip-active' : ''}`}
          onClick={() => {
            setFavoritesOnly(!favoritesOnly);
            setSelectedCategory(null);
          }}
        >
          <StarIcon size={14} filled={favoritesOnly} />
          <span>מועדפים ({favoritePlaces.length})</span>
        </button>

        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`chip ${selectedCategory === cat && !favoritesOnly ? 'chip-active' : ''}`}
            onClick={() => {
              setSelectedCategory(selectedCategory === cat ? null : cat);
              setFavoritesOnly(false);
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Stores List */}
      <div className="stores-directory-list">
        {filteredPlaces.length === 0 ? (
          <div className="stores-empty-state">
            <p>לא נמצאו מקומות תואמים לחיפוש.</p>
          </div>
        ) : (
          filteredPlaces.map((place) => {
            const isFav = favoritePlaces.some((item) => item.id === place._id);
            const isShelter = place.type === 'shelter';
            const floorLabel = getFloorName(floors, place.floor);

            return (
              <div
                key={place._id}
                className="store-card"
                onClick={() => onSelectPlace(place)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSelectPlace(place);
                }}
              >
                <div className="store-card-main">
                  <div className={`store-card-icon ${isShelter ? 'is-shelter' : ''}`}>
                    {isShelter ? <ShieldIcon size={20} /> : <StoreIcon size={20} />}
                  </div>

                  <div className="store-card-info">
                    <div className="store-card-name-row">
                      <h4 className="store-card-name">{place.name}</h4>
                      {place.isLandmark && <span className="store-landmark-tag">⭐</span>}
                    </div>

                    <div className="store-card-meta">
                      <span className="store-meta-badge is-cat">{place.category || 'כללי'}</span>
                      <span className="store-meta-badge is-floor">{floorLabel}</span>
                      {place.hours && <span className="store-meta-hours">🕒 {place.hours}</span>}
                    </div>
                  </div>
                </div>

                <div className="store-card-actions">
                  <button
                    type="button"
                    className="store-btn is-map"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowOnMap(place);
                    }}
                    title="הצג במפה"
                    aria-label="הצג במפה"
                  >
                    <MapIcon size={16} />
                  </button>

                  <button
                    type="button"
                    className="store-btn is-nav"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToPlace(place);
                    }}
                    title="ניווט אל המקום"
                  >
                    <DirectionsIcon size={16} />
                    <span>ניווט</span>
                  </button>

                  <button
                    type="button"
                    className={`store-btn is-fav ${isFav ? 'is-active' : ''}`}
                    onClick={(e) => handleToggleFav(e, place)}
                    title={isFav ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
                    aria-label={isFav ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
                  >
                    <StarIcon size={17} filled={isFav} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
