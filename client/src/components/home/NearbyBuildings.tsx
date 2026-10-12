import type { Building } from '../../types/building';
import type { BuildingResult } from '../../utils/buildingSearch';
import { formatDistance } from '../../utils/distance';
import { BuildingTypeIcon } from '../ui/Icons';
import './NearbyBuildings.css';

interface NearbyBuildingsProps {
  results: BuildingResult[]; // already sorted: the closest first
  onPick: (building: Building) => void;
}

const MAX_CARDS = 10;

// A row of small cards you swipe sideways. Takes little height, so the map stays big.
function NearbyBuildings({ results, onPick }: NearbyBuildingsProps) {
  return (
    <div className="nearby-row">
      {results.slice(0, MAX_CARDS).map(({ building, distanceKm }) => (
        <button key={building.id} type="button" className="nearby-card" onClick={() => onPick(building)}>
          <span className="nearby-card-icon">
            <BuildingTypeIcon type={building.type} />
          </span>
          <span className="nearby-card-text">
            <span className="nearby-card-name">{building.name}</span>
            <span className="nearby-card-meta">
              {distanceKm !== null ? `${formatDistance(distanceKm)} · ${building.city}` : building.city}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default NearbyBuildings;
