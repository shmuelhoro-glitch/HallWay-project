import { useState } from 'react';
import type { Floor } from '../../types/building';
import type { Place } from '../../types/place';
import { ChevronIcon, QrIcon } from '../ui/Icons';

interface LandmarkPickerProps {
  floors: Floor[];
  places: Place[];
  initialFloor: number; // the floor the visitor is on now, selected in advance
  onPick: (place: Place) => void;
  onScan: () => void;
}

// During an alert: pick a floor, then one of its (up to 5) landmarks
function LandmarkPicker({ floors, places, initialFloor, onPick, onScan }: LandmarkPickerProps) {
  const [floor, setFloor] = useState(initialFloor);

  const landmarks = places.filter((place) => place.floor === floor && place.isLandmark);

  return (
    <div>
      <div className="segmented" role="group" aria-label="Floor">
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

      <div className="list-label">Near which place?</div>
      <div className="list">
        {landmarks.length === 0 && <p className="list-empty">No landmarks on this floor. Scan a QR code.</p>}
        {landmarks.map((place) => (
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

export default LandmarkPicker;
