import type { Building } from '../../types/building';
import type { BuildingResult } from '../../utils/buildingSearch';
import { formatDistance } from '../../utils/distance';
import { BuildingTypeIcon, ChevronIcon, StarIcon } from '../ui/Icons';
import { useFavoritesStore } from '../../store/favoritesStore';
import './NearbyBuildings.css';

interface NearbyBuildingsProps {
  results: BuildingResult[]; // already sorted: the closest first
  onPick: (building: Building) => void;
  isExpanded?: boolean;
  onPromptLogin?: () => void;
}

const MAX_CARDS_COLLAPSED = 10;

// Displays buildings: horizontal row when collapsed, full vertical list when expanded
function NearbyBuildings({ results, onPick, isExpanded = false, onPromptLogin }: NearbyBuildingsProps) {
  const isBuildingFavorite = useFavoritesStore((state) => state.isBuildingFavorite);
  const toggleBuildingFavorite = useFavoritesStore((state) => state.toggleBuildingFavorite);

  function handleToggleFavorite(e: React.MouseEvent, buildingId: string) {
    e.stopPropagation();
    const success = toggleBuildingFavorite(buildingId);
    if (!success && onPromptLogin) {
      onPromptLogin();
    }
  }

  if (isExpanded) {
    return (
      <div className="nearby-list">
        {results.map(({ building, distanceKm }) => {
          const isFav = isBuildingFavorite(building.id);
          return (
            <div
              key={building.id}
              className="nearby-list-item"
              onClick={() => onPick(building)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onPick(building);
                }
              }}
            >
              <span className="nearby-card-icon">
                <BuildingTypeIcon type={building.type} />
              </span>
              <div className="nearby-list-info">
                <span className="nearby-list-name">{building.name}</span>
                <span className="nearby-list-meta">
                  {distanceKm !== null ? `${formatDistance(distanceKm)} · ${building.city}` : building.city}
                  {building.address ? ` · ${building.address}` : ''}
                </span>
              </div>
              <div className="nearby-list-actions">
                <button
                  type="button"
                  className="nearby-list-fav-btn"
                  aria-label={isFav ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
                  title={isFav ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
                  onClick={(e) => handleToggleFavorite(e, building.id)}
                >
                  <StarIcon size={20} filled={isFav} />
                </button>
                <span className="nearby-list-arrow" aria-hidden="true">
                  <ChevronIcon size={18} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="nearby-row">
      {results.slice(0, MAX_CARDS_COLLAPSED).map(({ building, distanceKm }) => (
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

