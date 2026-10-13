import { useState } from 'react';
import type { Place } from '../../types/place';
import type { RouteStatus } from '../../types/navigation';
import { AccessibleIcon, ChatIcon, ClockIcon, CloseIcon, DirectionsIcon, LinkIcon, StarIcon, StoreIcon, ShieldIcon } from '../ui/Icons';
import { useFavoritesStore } from '../../store/favoritesStore';
import LoginPromptModal from '../favorites/LoginPromptModal';
import './PlaceDetails.css';

interface PlaceDetailsProps {
  place: Place;
  floorName: string;
  routeStatus: RouteStatus;
  accessible?: boolean;
  onToggleAccessible?: () => void;
  onNavigate: () => void;
  onClose: () => void;
  onOpenChat: () => void;
}

// Only real web links. A link like "javascript:..." from the database is not shown.
function isWebLink(url: string | undefined): url is string {
  return url !== undefined && (url.startsWith('https://') || url.startsWith('http://'));
}

function PlaceDetails({
  place,
  floorName,
  routeStatus,
  accessible = false,
  onToggleAccessible,
  onNavigate,
  onClose,
  onOpenChat,
}: PlaceDetailsProps) {
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const isFavorite = useFavoritesStore((state) => state.isPlaceFavorite(place._id));
  const togglePlace = useFavoritesStore((state) => state.togglePlaceFavorite);

  const isLoading = routeStatus === 'loading';

  function handleToggleFavorite() {
    const success = togglePlace({
      id: place._id,
      buildingId: place.buildingId,
      name: place.name,
      category: place.category,
      floor: place.floor,
    });
    if (!success) {
      setIsPromptOpen(true);
    }
  }

  const isShelter = place.type === 'shelter';

  return (
    <div className={`place-details-card ${isShelter ? 'is-shelter' : ''}`}>
      <div className="place-card-top">
        <div className="place-card-avatar-group">
          <div className={`place-card-avatar ${isShelter ? 'is-shelter-avatar' : ''}`}>
            {isShelter ? <ShieldIcon size={24} /> : <StoreIcon size={24} />}
          </div>
          <div className="place-card-titles">
            <h2 className="place-card-title">{place.name}</h2>
            <div className="place-card-chips">
              <span className="place-chip is-category">{place.category || 'חנות'}</span>
              <span className="place-chip is-floor">{floorName}</span>
              {place.isLandmark && <span className="place-chip is-landmark">⭐ נקודת ציון</span>}
            </div>
          </div>
        </div>

        <div className="place-card-actions-top">
          <button
            type="button"
            className={`place-fav-btn ${isFavorite ? 'is-active' : ''}`}
            aria-label={isFavorite ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
            title={isFavorite ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
            onClick={handleToggleFavorite}
          >
            <StarIcon size={20} filled={isFavorite} />
          </button>
          <button type="button" className="place-close-btn" aria-label="סגירה" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        </div>
      </div>

      <div className="place-card-info-row">
        {place.hours && (
          <span className="place-info-pill">
            <ClockIcon size={15} />
            <span>{place.hours}</span>
          </span>
        )}
        {onToggleAccessible && (
          <button
            type="button"
            className={`place-info-pill is-accessible-toggle ${accessible ? 'is-active' : ''}`}
            onClick={onToggleAccessible}
            aria-pressed={accessible}
            title={accessible ? 'מסלול נגיש פעיל (מעליות בלבד)' : 'הפעלת מסלול נגיש (מעליות בלבד)'}
          >
            <AccessibleIcon size={15} />
            <span>{accessible ? 'מסלול נגיש (מעליות)' : 'מסלול נגיש'}</span>
          </button>
        )}
        {isWebLink(place.url) && (
          <a className="place-info-pill is-link" href={place.url} target="_blank" rel="noreferrer">
            <LinkIcon size={15} />
            <span>לאתר האינטרנט</span>
          </a>
        )}
      </div>

      {routeStatus === 'no-route' && (
        <div className="place-error-box" role="alert">
          {accessible
            ? 'לא נמצא מסלול נגיש (ללא מדרגות). ייתכן שאין מעלית לקומה המבוקשת או שמעבר חסום כרגע.'
            : 'לא נמצא מסלול. ייתכן שמעבר חסום כרגע.'}
        </div>
      )}
      {routeStatus === 'error' && <div className="place-error-box" role="alert">משהו השתבש. נסו שוב.</div>}

      <div className="place-card-buttons">
        <button type="button" className="btn btn-primary place-navigate-btn" onClick={onNavigate} disabled={isLoading}>
          <DirectionsIcon size={20} />
          <span>{isLoading ? 'מחפש מסלול...' : 'ניווט אל המקום'}</span>
        </button>
        <button type="button" className="btn btn-outline place-chat-btn" onClick={onOpenChat}>
          <ChatIcon size={18} />
          <span>צ׳אט</span>
        </button>
      </div>

      <LoginPromptModal
        isOpen={isPromptOpen}
        onClose={() => setIsPromptOpen(false)}
        title="רוצים לשמור את המקום?"
      />
    </div>
  );
}

export default PlaceDetails;
