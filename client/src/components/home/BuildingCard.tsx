import { BUILDING_TYPE_LABELS } from '../../types/building';
import type { Building } from '../../types/building';
import { formatDistance, getBuildingPoint } from '../../utils/distance';
import { BuildingTypeIcon, CloseIcon, DirectionsIcon } from '../ui/Icons';
import './BuildingCard.css';

interface BuildingCardProps {
  building: Building;
  distanceKm: number | null; // null = we don't know where the user is
  onEnter: () => void;
  onClose: () => void;
}

// The details of the selected building, inside the bottom sheet
function BuildingCard({ building, distanceKm, onEnter, onClose }: BuildingCardProps) {
  const point = getBuildingPoint(building);

  // Opens Google Maps (the app on a phone) with driving directions to the building
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;

  const typeLabel = BUILDING_TYPE_LABELS[building.type] ?? building.type;
  const floorsText = building.floors_count === 1 ? '1 floor' : `${building.floors_count} floors`;

  return (
    <>
      <div className="sheet-header">
        <div className="building-card-heading">
          <span className="building-card-icon">
            <BuildingTypeIcon type={building.type} size={20} />
          </span>
          <div className="building-card-titles">
            <h2 className="sheet-title">{building.name}</h2>
            <p className="sheet-text">
              {typeLabel} · {building.city} · {floorsText}
            </p>
          </div>
        </div>
        <button type="button" className="icon-btn icon-btn-plain" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="building-card-details">
        {building.address && <span className="building-card-address">{building.address}</span>}
        {distanceKm !== null && <span className="badge badge-blue">{formatDistance(distanceKm)} away</span>}
      </div>

      <div className="sheet-actions">
        <button type="button" className="btn btn-primary" onClick={onEnter}>
          Enter building
        </button>
        <a className="btn btn-outline" href={directionsUrl} target="_blank" rel="noreferrer">
          <DirectionsIcon />
          Directions
        </a>
      </div>
    </>
  );
}

export default BuildingCard;
