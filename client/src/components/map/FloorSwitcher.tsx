import type { Floor } from '../../types/building';
import { getDefaultFloorName } from '../../utils/floors';
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
    <div className="floor-switcher" role="group" aria-label="בחירת קומה">
      {floorsTopToBottom.map((floor) => (
        // dir="ltr": without it the minus of a basement (-1) is drawn after the number
        <button
          key={floor.floor}
          type="button"
          dir="ltr"
          aria-pressed={floor.floor === currentFloor}
          aria-label={floor.name || getDefaultFloorName(floor.floor)}
          onClick={() => onChange(floor.floor)}
        >
          {floor.floor}
        </button>
      ))}
    </div>
  );
}

export default FloorSwitcher;
