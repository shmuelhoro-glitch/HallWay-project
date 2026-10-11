import type { Floor } from '../../types/building';
import './FloorSwitcher.css';

interface FloorSwitcherProps {
  floors: Floor[];
  currentFloor: number;
  onChange: (floor: number) => void;
}

function FloorSwitcher({ floors, currentFloor, onChange }: FloorSwitcherProps) {
  // Highest floor on top, like in an elevator
  const floorsTopToBottom = [...floors].sort((a, b) => b.floor - a.floor);

  return (
    <div className="floor-switcher" role="group" aria-label="Choose floor">
      {floorsTopToBottom.map((floor) => (
        <button
          key={floor.floor}
          type="button"
          aria-pressed={floor.floor === currentFloor}
          aria-label={floor.name || `Floor ${floor.floor}`}
          onClick={() => onChange(floor.floor)}
        >
          {floor.floor}
        </button>
      ))}
    </div>
  );
}

export default FloorSwitcher;
