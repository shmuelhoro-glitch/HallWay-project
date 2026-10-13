import { useMemo, useState } from 'react';
import type { Floor } from '../../types/building';
import type { Place } from '../../types/place';
import { getDefaultFloorName, getFloorName } from '../../utils/floors';
import { ChevronIcon, CloseIcon, QrIcon, SearchIcon } from '../ui/Icons';

interface LandmarkPickerProps {
  floors: Floor[];
  places: Place[];
  initialFloor: number; // the floor the visitor is on now, selected in advance
  onPick: (place: Place) => void;
  onScan: () => void;
}

// During an alert: search a store by name, or pick floor + landmark, or scan QR
function LandmarkPicker({ floors, places, initialFloor, onPick, onScan }: LandmarkPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [floor, setFloor] = useState(initialFloor);

  // Stores matching the search query across all floors
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return places
      .filter(
        (place) =>
          place.type !== 'shelter' &&
          (place.name.toLowerCase().includes(q) ||
            (place.category && place.category.toLowerCase().includes(q)))
      )
      .slice(0, 10);
  }, [places, searchQuery]);

  // Fallback landmarks / stores for the selected floor
  const floorPlaces = places.filter((place) => place.floor === floor && place.type !== 'shelter');
  const landmarks = floorPlaces.filter((place) => place.isLandmark);
  const floorItems = landmarks.length > 0 ? landmarks : floorPlaces.slice(0, 8);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div>
      {/* Search store input */}
      <div className="search-field" style={{ marginBottom: '14px' }}>
        <SearchIcon />
        <input
          type="search"
          placeholder="חיפוש חנות או מקום (למשל: זארה, קפה...)"
          autoComplete="off"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          aria-label="חיפוש חנות בחירום"
        />
        {isSearching && (
          <button
            type="button"
            className="icon-btn icon-btn-plain"
            aria-label="ניקוי חיפוש"
            onClick={() => setSearchQuery('')}
            style={{ width: '32px', height: '32px', padding: 0 }}
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>

      {isSearching ? (
        <div>
          <div className="list-label">תוצאות חיפוש:</div>
          <div className="list" style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {searchResults.length === 0 ? (
              <p className="list-empty">לא נמצאו חנויות תואמות. נסו לבחור לפי קומה או לסרוק קוד QR.</p>
            ) : (
              searchResults.map((place) => (
                <button
                  key={place._id}
                  type="button"
                  className="list-button"
                  onClick={() => onPick(place)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'start' }}>
                    <span style={{ fontWeight: 600 }}>{place.name}</span>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      {place.category ? `${place.category} · ` : ''}
                      {getFloorName(floors, place.floor)}
                    </span>
                  </div>
                  <ChevronIcon />
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
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

          <div className="list-label">ליד איזה מקום אתם?</div>
          <div className="list">
            {floorItems.length === 0 && (
              <p className="list-empty">אין נקודות ציון בקומה הזאת. השתמשו בחיפוש למעלה או סרקו קוד QR.</p>
            )}
            {floorItems.map((place) => (
              <button
                key={place._id}
                type="button"
                className="list-button"
                onClick={() => onPick(place)}
              >
                {place.name}
                <ChevronIcon />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="or-divider">או</div>

      <button type="button" className="btn btn-dark" onClick={onScan}>
        <QrIcon />
        סריקת קוד ה-QR הקרוב
      </button>
    </div>
  );
}

export default LandmarkPicker;
