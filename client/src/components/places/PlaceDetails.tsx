import type { Place } from '../../types/place';
import type { RouteStatus } from '../../types/navigation';
import { ChatIcon, ClockIcon, CloseIcon, LinkIcon } from '../ui/Icons';
import './PlaceDetails.css';

interface PlaceDetailsProps {
  place: Place;
  floorName: string;
  routeStatus: RouteStatus;
  onNavigate: () => void;
  onClose: () => void;
  onOpenChat: () => void;
}

// Only real web links. A link like "javascript:..." from the database is not shown.
function isWebLink(url: string | undefined): url is string {
  return url !== undefined && (url.startsWith('https://') || url.startsWith('http://'));
}

function PlaceDetails({ place, floorName, routeStatus, onNavigate, onClose, onOpenChat }: PlaceDetailsProps) {
  const isLoading = routeStatus === 'loading';

  return (
    <div className="place-details">
      <div className="sheet-header">
        <div>
          <h2 className="sheet-title">{place.name}</h2>
          <p className="sheet-text">
            {place.category} · {floorName}
          </p>
        </div>
        <button type="button" className="icon-btn icon-btn-plain" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="place-details-info">
        {place.type === 'shelter' && <span className="badge badge-green">Protected space</span>}
        {place.isLandmark && <span className="badge badge-blue">Landmark</span>}
        {place.hours && (
          <span className="place-details-row">
            <ClockIcon />
            {place.hours}
          </span>
        )}
        {isWebLink(place.url) && (
          <a className="place-details-row" href={place.url} target="_blank" rel="noreferrer">
            <LinkIcon />
            Website
          </a>
        )}
      </div>

      {routeStatus === 'no-route' && (
        <p className="message-error">No route found. A passage may be blocked right now.</p>
      )}
      {routeStatus === 'error' && <p className="message-error">Something went wrong. Please try again.</p>}

      <div className="sheet-actions">
        <button type="button" className="btn btn-primary" onClick={onNavigate} disabled={isLoading}>
          {isLoading ? 'Finding route...' : 'Navigate'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onOpenChat}>
          <ChatIcon />
          Chat
        </button>
      </div>
    </div>
  );
}

export default PlaceDetails;
