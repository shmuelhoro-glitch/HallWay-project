import { useEffect, useState } from 'react';
import { getPlaces } from '../../api/places';
import { useDebounce } from '../../hooks/useDebounce';
import { getFloorName } from '../../utils/floors';
import type { Floor } from '../../types/building';
import type { Place } from '../../types/place';
import CategoryFilter from './CategoryFilter';
import { ChevronIcon, CloseIcon, SearchIcon } from '../ui/Icons';
import './SearchBar.css';

interface SearchBarProps {
  buildingId: string;
  categories: string[];
  floors: Floor[];
  onSelectPlace: (place: Place) => void;
}

function SearchBar({ buildingId, categories, floors, onSelectPlace }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [hasError, setHasError] = useState(false);

  // Wait 300ms after the last key before asking the server
  const debouncedQuery = useDebounce(query.trim(), 300);
  const hasFilter = debouncedQuery !== '' || category !== null || floor !== null;

  useEffect(() => {
    if (!hasFilter) return;

    let isCancelled = false;

    getPlaces(buildingId, {
      q: debouncedQuery || undefined,
      category: category ?? undefined,
      floor: floor ?? undefined,
    })
      .then((places) => {
        if (isCancelled) return;
        setResults(places);
        setHasError(false);
      })
      .catch(() => {
        if (isCancelled) return;
        setResults([]);
        setHasError(true);
      });

    // If the user typed again before the answer came, ignore the old answer
    return () => {
      isCancelled = true;
    };
  }, [buildingId, debouncedQuery, category, floor, hasFilter]);

  function handleClose() {
    setQuery('');
    setCategory(null);
    setFloor(null);
    setIsOpen(false);
  }

  function handleSelect(place: Place) {
    onSelectPlace(place);
    handleClose();
  }

  return (
    <div className="search-bar">
      <label className="sr-only" htmlFor="place-search">
        Search a place
      </label>
      <div className="search-field">
        <SearchIcon />
        <input
          id="place-search"
          type="search"
          placeholder="Store, service or shelter"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
        />
        {isOpen && (
          <button type="button" className="icon-btn icon-btn-plain" aria-label="Close search" onClick={handleClose}>
            <CloseIcon />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="search-panel">
          <CategoryFilter
            categories={categories}
            selectedCategory={category}
            onCategoryChange={setCategory}
            floors={floors}
            selectedFloor={floor}
            onFloorChange={setFloor}
          />

          {hasFilter && (
            <div className="search-results">
              {hasError && <p className="list-empty">Search is not available right now.</p>}
              {!hasError && results.length === 0 && <p className="list-empty">No places found.</p>}

              {results.map((place) => (
                <button key={place._id} type="button" className="search-result" onClick={() => handleSelect(place)}>
                  <span>
                    <span className="search-result-name">{place.name}</span>
                    <span className="search-result-meta">
                      {place.category} · {getFloorName(floors, place.floor)}
                    </span>
                  </span>
                  {place.type === 'shelter' ? <span className="badge badge-green">Shelter</span> : <ChevronIcon />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
