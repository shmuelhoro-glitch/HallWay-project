import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { BUILDING_TYPE_LABELS } from '../../types/building';
import type { Building, BuildingType } from '../../types/building';
import type { BuildingResult } from '../../utils/buildingSearch';
import { formatDistance } from '../../utils/distance';
import type { RecentBuilding } from '../../store/recentStore';
import { BuildingTypeIcon, ChevronIcon, ClockIcon, CloseIcon, SearchIcon } from '../ui/Icons';
import './BuildingSearch.css';

interface BuildingSearchProps {
  text: string;
  onTextChange: (text: string) => void;
  type: BuildingType | null;
  onTypeChange: (type: BuildingType | null) => void;
  results: BuildingResult[]; // already filtered and sorted by the page
  onPick: (building: Building) => void; // one building was picked from the list
  onShowAll: () => void; // Enter with many results: show them all on the map
  recent: RecentBuilding[];
  onPickRecent: (buildingId: string) => void;
  onClearRecent: () => void;
}

const TYPE_FILTERS: { value: BuildingType | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'mall', label: 'Malls' },
  { value: 'hospital', label: 'Hospitals' },
  { value: 'campus', label: 'Campuses' },
];

const MAX_SUGGESTIONS = 6;

// Shows the part of the name that matches the search in bold
function HighlightedName({ name, query }: { name: string; query: string }) {
  const start = name.toLowerCase().indexOf(query.toLowerCase());
  if (query === '' || start === -1) return <>{name}</>;

  const end = start + query.length;
  return (
    <>
      {name.slice(0, start)}
      <mark>{name.slice(start, end)}</mark>
      {name.slice(end)}
    </>
  );
}

function BuildingSearch({
  text,
  onTextChange,
  type,
  onTypeChange,
  results,
  onPick,
  onShowAll,
  recent,
  onPickRecent,
  onClearRecent,
}: BuildingSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = text.trim();
  const suggestions = results.slice(0, MAX_SUGGESTIONS);
  const hasMore = results.length > MAX_SUGGESTIONS;

  // An empty search shows the recent buildings. Nothing to show = no list at all.
  const showRecent = query === '' && recent.length > 0;
  const showList = isOpen && (query !== '' || showRecent);

  // Closes the list and hides the phone keyboard
  function closeList() {
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function handlePick(building: Building) {
    onPick(building);
    closeList();
  }

  // Enter: one result = pick it. Many results = show them all on the map.
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (results.length === 1) {
      handlePick(results[0].building);
    } else if (results.length > 1) {
      onShowAll();
      closeList();
    }
  }

  function handleClear() {
    onTextChange('');
    inputRef.current?.focus();
  }

  return (
    <div className="building-search">
      <form role="search" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="building-search-input">
          Search a building, city or address
        </label>
        <div className="search-field">
          <SearchIcon />
          <input
            ref={inputRef}
            id="building-search-input"
            type="search"
            enterKeyHint="search"
            placeholder="Where are you going today?"
            autoComplete="off"
            value={text}
            onChange={(event) => {
              onTextChange(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeList();
            }}
          />
          {text !== '' && (
            <button type="button" className="icon-btn icon-btn-plain" aria-label="Clear search" onClick={handleClear}>
              <CloseIcon />
            </button>
          )}
        </div>
      </form>

      {showList && (
        // preventDefault on mouse down: the input keeps the focus, so the list doesn't close before the click
        <div className="search-dropdown" onMouseDown={(event) => event.preventDefault()}>
          {showRecent && (
            <>
              <div className="search-dropdown-header">
                <span>Recently visited</span>
                <button type="button" className="text-btn" onClick={onClearRecent}>
                  Clear
                </button>
              </div>
              {recent.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="search-suggestion"
                  onClick={() => {
                    onPickRecent(item.id);
                    closeList();
                  }}
                >
                  <span className="search-suggestion-icon">
                    <ClockIcon size={18} />
                  </span>
                  <span className="search-suggestion-text">
                    <span className="search-suggestion-name">{item.name}</span>
                    <span className="search-suggestion-meta">{item.city}</span>
                  </span>
                  <ChevronIcon />
                </button>
              ))}
            </>
          )}

          {query !== '' && suggestions.length === 0 && (
            <p className="search-dropdown-empty">
              No buildings match “{query}”.
              <br />
              Try a building name, a city or a street.
            </p>
          )}

          {query !== '' &&
            suggestions.map(({ building, distanceKm }) => (
              <button
                key={building.id}
                type="button"
                className="search-suggestion"
                onClick={() => handlePick(building)}
              >
                <span className="search-suggestion-icon">
                  <BuildingTypeIcon type={building.type} />
                </span>
                <span className="search-suggestion-text">
                  <span className="search-suggestion-name">
                    <HighlightedName name={building.name} query={query} />
                  </span>
                  <span className="search-suggestion-meta">
                    {BUILDING_TYPE_LABELS[building.type] ?? building.type} · {building.city}
                  </span>
                </span>
                {distanceKm !== null && <span className="search-suggestion-distance">{formatDistance(distanceKm)}</span>}
              </button>
            ))}

          {query !== '' && hasMore && (
            <button
              type="button"
              className="search-show-all"
              onClick={() => {
                onShowAll();
                closeList();
              }}
            >
              Show all {results.length} on the map
            </button>
          )}
        </div>
      )}

      <div className="chip-row building-search-types" role="group" aria-label="Building type">
        {TYPE_FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            className="chip"
            aria-pressed={type === filter.value}
            onClick={() => onTypeChange(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default BuildingSearch;
