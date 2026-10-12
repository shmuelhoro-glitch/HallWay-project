import { useState } from 'react';
import type { Floor } from '../../types/building';
import type { Place } from '../../types/place';
import { getDefaultFloorName } from '../../utils/floors';
import { ChevronIcon, CloseIcon, QrIcon } from '../ui/Icons';
import './LocationPicker.css';

interface LocationPickerProps {
  places: Place[];
  floors: Floor[];
  initialFloor: number;
  onPick: (place: Place) => void;
  onScan: () => void;
  onClose: () => void;
}

// "I'm near..." - the visitor picks a place, and its entry node is the starting point
function LocationPicker({ places, floors, initialFloor, onPick, onScan, onClose }: LocationPickerProps) {
  const [floor, setFloor] = useState(initialFloor);

  // Landmarks first, then by name
  const floorPlaces = places
    .filter((place) => place.floor === floor)
    .sort((a, b) => {
      if (a.isLandmark !== b.isLandmark) {
        return a.isLandmark ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="location-picker">
      <div className="sheet-header">
        <div>
          <h2 className="sheet-title">איפה אתם?</h2>
          <p className="sheet-text">בחרו את המקום שלידכם, או לחצו עליו במפה.</p>
        </div>
        <button type="button" className="icon-btn icon-btn-plain" aria-label="סגירה" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="segmented location-picker-floors" role="group" aria-label="קומה">
        {floors.map((item) => (
          <button
            key={item.floor}
            type="button"
            aria-pressed={item.floor === floor}
            onClick={() => setFloor(item.floor)}
          >
            {getDefaultFloorName(item.floor)}
          </button>
        ))}
      </div>

      <div className="list-label">אני ליד...</div>
      <div className="list location-picker-list">
        {floorPlaces.length === 0 && <p className="list-empty">עדיין אין מקומות בקומה הזאת.</p>}
        {floorPlaces.map((place) => (
          <button key={place._id} type="button" className="list-button" onClick={() => onPick(place)}>
            {place.name}
            <ChevronIcon />
          </button>
        ))}
      </div>

      <div className="or-divider">או</div>

      <button type="button" className="btn btn-dark" onClick={onScan}>
        <QrIcon />
        סריקת קוד ה-QR הקרוב
      </button>
    </div>
  );
}

export default LocationPicker;
