import { useState } from 'react';
import type { Floor } from '../../types/building';
import type { Place } from '../../types/place';
import { getDefaultFloorName } from '../../utils/floors';
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
      <div className="segmented" role="group" aria-label="קומה">
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

      <div className="list-label">ליד איזה מקום?</div>
      <div className="list">
        {landmarks.length === 0 && <p className="list-empty">אין נקודות ציון בקומה הזאת. סרקו קוד QR.</p>}
        {landmarks.map((place) => (
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

export default LandmarkPicker;
