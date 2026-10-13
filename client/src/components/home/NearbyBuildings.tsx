import type { Building } from '../../types/building';
import { BUILDING_TYPE_LABELS } from '../../types/building';
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
  const favoriteBuildings = useFavoritesStore((state) => state.favorites?.buildings ?? []);
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
          const isFav = favoriteBuildings.includes(building.id);
          const typeLabel = BUILDING_TYPE_LABELS[building.type] ?? building.type;
          const floorsLabel = building.floors_count === 1 ? 'קומה 1' : `${building.floors_count} קומות`;

          return (
            <div
              key={building.id}
              className={`nearby-list-item type-${building.type}`}
              onClick={() => onPick(building)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onPick(building);
                }
              }}
            >
              <div className="nearby-card-badge-icon">
                <BuildingTypeIcon type={building.type} size={22} />
              </div>

              <div className="nearby-list-info">
                <div className="nearby-list-top-row">
                  <span className="nearby-type-chip">{typeLabel}</span>
                  {building.floors_count > 0 && (
                    <span className="nearby-floors-chip">{floorsLabel}</span>
                  )}
                </div>

                <h3 className="nearby-list-name">{building.name}</h3>

                <div className="nearby-list-meta-row">
                  {distanceKm !== null && (
                    <span className="nearby-meta-pill is-distance">
                      📍 {formatDistance(distanceKm)}
                    </span>
                  )}
                  <span className="nearby-meta-pill">{building.city}</span>
                  {building.address && (
                    <span className="nearby-meta-address">{building.address}</span>
                  )}
                </div>
              </div>

              <div className="nearby-list-actions">
                <button
                  type="button"
                  className={`nearby-list-fav-btn ${isFav ? 'is-fav' : ''}`}
                  aria-label={isFav ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
                  title={isFav ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
                  onClick={(e) => handleToggleFavorite(e, building.id)}
                >
                  <StarIcon size={20} filled={isFav} />
                </button>
                <span className="nearby-list-arrow-pill" aria-hidden="true">
                  <ChevronIcon size={16} />
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
      {results.slice(0, MAX_CARDS_COLLAPSED).map(({ building, distanceKm }) => {
        const isFav = favoriteBuildings.includes(building.id);
        const typeLabel = BUILDING_TYPE_LABELS[building.type] ?? building.type;
        const floorsLabel = building.floors_count === 1 ? 'קומה 1' : `${building.floors_count} קומות`;

        return (
          <div
            key={building.id}
            className={`nearby-card type-${building.type}`}
            onClick={() => onPick(building)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onPick(building);
              }
            }}
          >
            <div className="nearby-card-header">
              <div className="nearby-card-icon-tag">
                <span className="nearby-card-icon">
                  <BuildingTypeIcon type={building.type} size={18} />
                </span>
                <span className="nearby-type-badge">{typeLabel}</span>
              </div>
              <button
                type="button"
                className={`nearby-card-fav-btn ${isFav ? 'is-fav' : ''}`}
                aria-label={isFav ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
                onClick={(e) => handleToggleFavorite(e, building.id)}
              >
                <StarIcon size={18} filled={isFav} />
              </button>
            </div>

            <div className="nearby-card-content">
              <h3 className="nearby-card-name">{building.name}</h3>
              <div className="nearby-card-badges">
                {distanceKm !== null && (
                  <span className="nearby-card-badge is-dist">
                    {formatDistance(distanceKm)}
                  </span>
                )}
                <span className="nearby-card-badge">{building.city}</span>
                {building.floors_count > 0 && (
                  <span className="nearby-card-badge is-floors">{floorsLabel}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default NearbyBuildings;
