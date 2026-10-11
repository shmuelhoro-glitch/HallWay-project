import type { Floor } from '../../types/building';
import './CategoryFilter.css';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  floors: Floor[];
  selectedFloor: number | null;
  onFloorChange: (floor: number | null) => void;
}

function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
  floors,
  selectedFloor,
  onFloorChange,
}: CategoryFilterProps) {
  return (
    <div className="category-filter">
      <label className="sr-only" htmlFor="floor-filter">
        Floor
      </label>
      <select
        id="floor-filter"
        className="category-filter-floor"
        value={selectedFloor === null ? '' : String(selectedFloor)}
        onChange={(event) => onFloorChange(event.target.value === '' ? null : Number(event.target.value))}
      >
        <option value="">All floors</option>
        {floors.map((floor) => (
          <option key={floor.floor} value={floor.floor}>
            {floor.name || `Floor ${floor.floor}`}
          </option>
        ))}
      </select>

      <div className="chip-row" role="group" aria-label="Category">
        <button
          type="button"
          className="chip"
          aria-pressed={selectedCategory === null}
          onClick={() => onCategoryChange(null)}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className="chip"
            aria-pressed={selectedCategory === category}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CategoryFilter;
