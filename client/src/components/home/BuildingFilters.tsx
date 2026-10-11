import type { BuildingType } from '../../types/building';
import { SearchIcon } from '../ui/Icons';
import './BuildingFilters.css';

interface BuildingFiltersProps {
  city: string;
  onCityChange: (city: string) => void;
  type: BuildingType | null;
  onTypeChange: (type: BuildingType | null) => void;
}

const TYPE_FILTERS: { value: BuildingType | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'mall', label: 'Malls' },
  { value: 'hospital', label: 'Hospitals' },
  { value: 'campus', label: 'Campuses' },
];

function BuildingFilters({ city, onCityChange, type, onTypeChange }: BuildingFiltersProps) {
  return (
    <div className="building-filters">
      <label className="sr-only" htmlFor="city-search">
        Search by city
      </label>
      <div className="search-field">
        <SearchIcon />
        <input
          id="city-search"
          type="search"
          placeholder="Search by city"
          autoComplete="off"
          value={city}
          onChange={(event) => onCityChange(event.target.value)}
        />
      </div>

      <div className="chip-row building-filters-types" role="group" aria-label="Building type">
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

export default BuildingFilters;
