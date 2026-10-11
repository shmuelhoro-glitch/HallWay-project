import { useState } from 'react';
import type { Floor } from '../../types/building';
import type { Place } from '../../types/place';
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
          <h2 className="sheet-title">Where are you?</h2>
          <p className="sheet-text">Pick the place you are next to, or tap it on the map.</p>
        </div>
        <button type="button" className="icon-btn icon-btn-plain" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="segmented location-picker-floors" role="group" aria-label="Floor">
        {floors.map((item) => (
          <button
            key={item.floor}
            type="button"
            aria-pressed={item.floor === floor}
            onClick={() => setFloor(item.floor)}
          >
            Floor {item.floor}
          </button>
        ))}
      </div>

      <div className="list-label">I'm near...</div>
      <div className="list location-picker-list">
        {floorPlaces.length === 0 && <p className="list-empty">No places on this floor yet.</p>}
        {floorPlaces.map((place) => (
          <button key={place._id} type="button" className="list-button" onClick={() => onPick(place)}>
            {place.name}
            <ChevronIcon />
          </button>
        ))}
      </div>

      <div className="or-divider">or</div>

      <button type="button" className="btn btn-dark" onClick={onScan}>
        <QrIcon />
        Scan the nearest QR code
      </button>
    </div>
  );
}

export default LocationPicker;
