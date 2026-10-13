import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getBuildingById, getPlanUrl } from '../api/buildings';
import { getPlaces } from '../api/places';
import { getNearestShelter, getNode, getRoute } from '../api/navigation';
import { useBuildingRoom } from '../socket/useBuildingRoom';
import { useLocationStore } from '../store/locationStore';
import { useAlertStore } from '../store/alertStore';
import { useAuthStore } from '../store/authStore';
import { getFloorName } from '../utils/floors';
import { nodeToStartPoint, placeToStartPoint } from '../utils/startPoint';
import type { BuildingDetails } from '../types/building';
import type { Place } from '../types/place';
import type { Destination, RouteNode, RouteStatus, StartPoint } from '../types/navigation';

import FloorMap from '../components/map/FloorMap';
import FloorSwitcher from '../components/map/FloorSwitcher';
import PlacesLayer from '../components/map/PlacesLayer';
import RouteLayer from '../components/map/RouteLayer';
import LocationMarker from '../components/map/LocationMarker';
import SearchBar from '../components/search/SearchBar';
import PlaceDetails from '../components/places/PlaceDetails';
import LocationPicker from '../components/location/LocationPicker';
import RouteSteps from '../components/route/RouteSteps';
import ChatPanel from '../components/chat/ChatPanel';
import RedAlertModal from '../components/alert/RedAlertModal';
import AlertBanner from '../components/alert/AlertBanner';
import QrScanner from '../components/alert/QrScanner';
import type { QrResult } from '../components/alert/QrScanner';
import ShareLocationButton from '../components/share/ShareLocationButton';
import { AccessibleIcon, BackIcon, ChatIcon, PencilIcon, SirenIcon, StarIcon } from '../components/ui/Icons';
import { simulateAlert, stopAlert } from '../api/alerts';
import { useFavoritesStore } from '../store/favoritesStore';
import LoginPromptModal from '../components/favorites/LoginPromptModal';
import './BuildingPage.css';

interface BuildingPageProps {
  buildingId: string;
  nodeParam: string | null; // ?node=   from a QR code: where the visitor stands
  targetParam: string | null; // ?target= from "navigate to me": where to go
}

// "Navigate to me": the name of the destination when a friend shared where he is
const MEETING_POINT_LABEL = 'נקודת המפגש';

function BuildingPage({ buildingId, nodeParam, targetParam }: BuildingPageProps) {
  const navigate = useNavigate();
  const socket = useBuildingRoom(buildingId);

  const start = useLocationStore((state) => state.start);
  const setStart = useLocationStore((state) => state.setStart);
  const clearStart = useLocationStore((state) => state.clearStart);
  const alertStatus = useAlertStore((state) => state.status);
  const minimizeAlert = useAlertStore((state) => state.minimize);
  const clearAlert = useAlertStore((state) => state.clearAlert);

  const user = useAuthStore((state) => state.user);
  const isAdmin = user !== null && (user.role === 'admin' || user.role === 'super');

  const isBuildingFav = useFavoritesStore((state) => state.isBuildingFavorite(buildingId));
  const toggleBuildingFav = useFavoritesStore((state) => state.toggleBuildingFavorite);
  const isPlaceFavorite = useFavoritesStore((state) => state.isPlaceFavorite);

  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);

  // ---------- Building data ----------
  const [building, setBuilding] = useState<BuildingDetails | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [floorChoice, setFloorChoice] = useState<number | null>(null);

  // ---------- Navigation ----------
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Destination | null>(
    targetParam ? { label: MEETING_POINT_LABEL, nodeId: targetParam } : null,
  );
  const [route, setRoute] = useState<RouteNode[] | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [isShelterRoute, setIsShelterRoute] = useState(false);
  const [accessible, setAccessible] = useState(false);

  // ---------- Open panels ----------
  // A visitor first looks around: the map and the search come before any question.
  // "Where are you?" opens by itself only for a "navigate to me" link, where a route is waiting for it.
  const [isPickerOpen, setIsPickerOpen] = useState(nodeParam === null && targetParam !== null);
  const [scanPurpose, setScanPurpose] = useState<'start' | 'shelter' | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Load the building (with its floors) and all of its places
  useEffect(() => {
    let isCancelled = false;

    Promise.all([getBuildingById(buildingId), getPlaces(buildingId)])
      .then(([buildingData, placesData]) => {
        if (isCancelled) return;
        setBuilding(buildingData);
        setPlaces(placesData);
      })
      .catch(() => {
        if (isCancelled) return;
        setLoadError('לא הצלחנו לטעון את המבנה.');
      });

    return () => {
      isCancelled = true;
    };
  }, [buildingId]);

  // Leaving the page: forget the location and any alert
  useEffect(() => {
    return () => {
      clearStart();
      clearAlert();
    };
  }, [clearStart, clearAlert]);

  // Ask the server for a route and show it
  const startRoute = useCallback(
    async (from: StartPoint, to: Destination, isAccessible?: boolean) => {
      const useAccessible = isAccessible ?? accessible;
      setDestination(to);
      setRoute(null);
      setIsShelterRoute(false);
      setRouteStatus('loading');

      try {
        const path = await getRoute({
          buildingId,
          fromNodeId: from.nodeId,
          toPlaceId: to.placeId,
          toNodeId: to.nodeId,
          accessible: useAccessible,
        });

        if (!path) {
          setRouteStatus('no-route');
          return;
        }

        setRoute(path);
        setStepIndex(0);
        setFloorChoice(path[0].floor);
        setRouteStatus('idle');
      } catch {
        setRouteStatus('error');
      }
    },
    [buildingId, accessible],
  );

  // ?node= from a QR code: that node is the starting point
  useEffect(() => {
    if (!nodeParam) return;

    let isCancelled = false;

    getNode(nodeParam)
      .then((node) => {
        if (isCancelled) return;
        const startPoint = nodeToStartPoint(node);
        setStart(startPoint);
        setFloorChoice(startPoint.floor);

        if (targetParam) {
          startRoute(startPoint, { label: MEETING_POINT_LABEL, nodeId: targetParam });
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setIsPickerOpen(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [nodeParam, targetParam, setStart, startRoute]);

  // ---------- Actions ----------

  // The visitor told us where they are (list, tap on the map or QR)
  function handleStartChosen(startPoint: StartPoint) {
    setStart(startPoint);
    setFloorChoice(startPoint.floor);
    setIsPickerOpen(false);

    // Was a destination waiting for a starting point? Go now.
    if (destination && (destination.placeId || destination.nodeId)) {
      startRoute(startPoint, destination);
    }
  }

  function handleNavigate(place: Place) {
    const to: Destination = { label: place.name, placeId: place._id };

    if (!start) {
      setDestination(to);
      setIsPickerOpen(true);
      return;
    }
    startRoute(start, to);
  }

  function handleMapPlaceClick(place: Place) {
    // While "I'm near..." is open, tapping a place on the map picks it as the start
    if (isPickerOpen) {
      handleStartChosen(placeToStartPoint(place));
      return;
    }
    setSelectedPlace(place);
  }

  function handleSearchSelect(place: Place) {
    setSelectedPlace(place);
    setFloorChoice(place.floor);
    setIsPickerOpen(false);
  }

  function handleEndRoute() {
    setRoute(null);
    setDestination(null);
    setSelectedPlace(null);
    setIsShelterRoute(false);
    setStepIndex(0);
    setRouteStatus('idle');
  }

  // Red alert: route from where the visitor is to the nearest protected space
  async function findShelterRoute(from: StartPoint, isAccessible?: boolean) {
    const useAccessible = isAccessible ?? accessible;
    setStart(from);
    setFloorChoice(from.floor);
    setIsPickerOpen(false);
    setSelectedPlace(null);
    minimizeAlert();

    setRoute(null);
    setIsShelterRoute(true);
    setDestination({ label: 'המרחב המוגן' });
    setRouteStatus('loading');

    try {
      const path = await getNearestShelter({
        buildingId,
        fromNodeId: from.nodeId,
        accessible: useAccessible,
      });

      if (!path) {
        setRouteStatus('no-route');
        return;
      }

      // The route ends at the entry node of the shelter, so we can find its name
      const lastNodeId = path[path.length - 1].id;
      const shelter = places.find((place) => place.type === 'shelter' && place.entryNodeId === lastNodeId);
      if (shelter) {
        setDestination({ label: shelter.name });
      }

      setRoute(path);
      setStepIndex(0);
      setFloorChoice(path[0].floor);
      setRouteStatus('idle');
    } catch {
      setRouteStatus('error');
    }
  }

  function handleToggleAccessible() {
    const nextAccessible = !accessible;
    setAccessible(nextAccessible);

    if (start && destination) {
      if (isShelterRoute) {
        findShelterRoute(start, nextAccessible);
      } else {
        startRoute(start, destination, nextAccessible);
      }
    }
  }

  async function handleToggleAlertSimulation() {
    try {
      if (alertStatus === 'active') {
        await stopAlert(buildingId);
      } else {
        await simulateAlert({ buildingId, countdown: 60 });
      }
    } catch (err) {
      console.error('Failed to toggle alert simulation:', err);
    }
  }

  function handleToggleBuildingFavorite() {
    const success = toggleBuildingFav(buildingId);
    if (!success) {
      setIsLoginPromptOpen(true);
    }
  }

  function handleToggleFavoritesFilter() {
    if (!user) {
      setIsLoginPromptOpen(true);
      return;
    }
    setFavoritesOnly(!favoritesOnly);
  }

  function handleRetry() {
    if (!start || !destination) return;

    if (isShelterRoute) {
      findShelterRoute(start);
    } else {
      startRoute(start, destination);
    }
  }

  async function handleScan(result: QrResult) {
    const purpose = scanPurpose;
    setScanPurpose(null);

    // A code of another building: open that building
    if (result.buildingId !== buildingId) {
      navigate(`/b/${result.buildingId}?node=${result.nodeId}`);
      return;
    }

    try {
      const node = await getNode(result.nodeId);
      const startPoint = nodeToStartPoint(node);

      if (purpose === 'shelter') {
        findShelterRoute(startPoint);
      } else {
        handleStartChosen(startPoint);
      }
    } catch {
      setIsPickerOpen(true);
    }
  }

  // ---------- Loading / error ----------

  if (loadError) {
    return (
      <div className="screen">
        <div className="screen-message">
          <p>{loadError}</p>
          <Link to="/" className="btn btn-outline">
            חזרה למפה
          </Link>
        </div>
      </div>
    );
  }

  if (!building) {
    return (
      <div className="screen">
        <div className="screen-message">טוען את המבנה...</div>
      </div>
    );
  }

  const floors = [...building.floors].sort((a, b) => a.floor - b.floor);

  if (floors.length === 0) {
    return (
      <div className="screen">
        <div className="screen-message">
          <p>למבנה הזה עדיין אין תוכניות קומה.</p>
          <Link to="/" className="btn btn-outline">
            חזרה למפה
          </Link>
        </div>
      </div>
    );
  }

  // ---------- What is on screen ----------

  const currentFloor = floors.find((floor) => floor.floor === floorChoice) ?? floors[0];
  const planUrl = getPlanUrl(buildingId, currentFloor.floor);
  const floorPlaces = places.filter(
    (place) => place.floor === currentFloor.floor && (!favoritesOnly || isPlaceFavorite(place._id))
  );
  const categories = [...new Set(places.map((place) => place.category).filter(Boolean))].sort();

  let subtitle = building.city;
  if (route && destination) {
    subtitle = `מסלול אל ${destination.label}`;
  } else if (start) {
    subtitle = `אתם ליד ${start.label}`;
  }

  let floorBadge = getFloorName(floors, currentFloor.floor);
  if (start && start.floor === currentFloor.floor) {
    floorBadge += ' · אתם כאן';
  }

  const chatButton = (
    <button type="button" className="btn btn-outline" onClick={() => setIsChatOpen(true)}>
      <ChatIcon />
      צ׳אט
    </button>
  );

  // The bottom sheet shows one thing at a time, by priority
  function renderSheetContent() {
    if (isPickerOpen) {
      return (
        <LocationPicker
          places={places}
          floors={floors}
          initialFloor={currentFloor.floor}
          onPick={(place) => handleStartChosen(placeToStartPoint(place))}
          onScan={() => setScanPurpose('start')}
          onClose={() => setIsPickerOpen(false)}
        />
      );
    }

    if (route && destination) {
      return (
        <RouteSteps
          path={route}
          floors={floors}
          destinationLabel={destination.label}
          stepIndex={stepIndex}
          isShelterRoute={isShelterRoute}
          accessible={accessible}
          onToggleAccessible={handleToggleAccessible}
          onStepChange={(nextIndex, floor) => {
            setStepIndex(nextIndex);
            setFloorChoice(floor);
          }}
          onEnd={handleEndRoute}
          onOpenChat={() => setIsChatOpen(true)}
        />
      );
    }

    if (selectedPlace) {
      const isThisDestination = destination !== null && destination.placeId === selectedPlace._id;
      return (
        <PlaceDetails
          place={selectedPlace}
          floorName={getFloorName(floors, selectedPlace.floor)}
          routeStatus={isThisDestination ? routeStatus : 'idle'}
          accessible={accessible}
          onNavigate={() => handleNavigate(selectedPlace)}
          onClose={() => setSelectedPlace(null)}
          onOpenChat={() => setIsChatOpen(true)}
        />
      );
    }

    // Nothing selected: a short hint, or the state of a waiting route
    let title = 'לאן?';
    let text = 'חפשו מקום, או לחצו עליו במפה.';

    if (destination) {
      title = isShelterRoute ? 'מסלול למרחב מוגן' : `מסלול אל ${destination.label}`;

      if (routeStatus === 'loading') {
        text = 'מחפשים את המסלול הטוב ביותר...';
      } else if (routeStatus === 'no-route') {
        text = accessible
          ? 'לא נמצא מסלול נגיש (ללא מדרגות). ייתכן שאין מעלית בבניין או שמעבר חסום כרגע.'
          : 'לא נמצא מסלול. ייתכן שמעבר חסום כרגע.';
      } else if (routeStatus === 'error') {
        text = 'משהו השתבש. נסו שוב.';
      } else if (!start) {
        text = 'כדי להתחיל, ספרו לנו איפה אתם.';
      }
    }

    const canRetry = start !== null && (routeStatus === 'no-route' || routeStatus === 'error');

    return (
      <>
        <div className="sheet-header">
          <div>
            <h2 className="sheet-title">{title}</h2>
            <p className="sheet-text">{text}</p>
          </div>
          {destination && (
            <button type="button" className="text-btn" onClick={handleEndRoute}>
              ביטול
            </button>
          )}
        </div>

        <div className="sheet-actions">
          {!start && (
            <button type="button" className="btn btn-primary" onClick={() => setIsPickerOpen(true)}>
              קביעת המיקום שלי
            </button>
          )}
          {canRetry && (
            <button type="button" className="btn btn-primary" onClick={handleRetry}>
              נסו שוב
            </button>
          )}
          {chatButton}
        </div>
      </>
    );
  }

  return (
    <div className="screen">
      <AlertBanner />

      <header className="building-topbar">
        <button type="button" className="icon-btn" aria-label="חזרה למפה" onClick={() => navigate('/')}>
          <BackIcon />
        </button>
        <div className="building-heading">
          <div className="building-name">{building.name}</div>
          <div className="building-subtitle">{subtitle}</div>
        </div>
        {/* Only a building manager sees the edit button */}
        {isAdmin && (
          <Link to={`/admin/${buildingId}/places`} className="icon-btn" aria-label="עריכת המבנה" title="עריכת המבנה">
            <PencilIcon size={20} />
          </Link>
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label={isBuildingFav ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
          title={isBuildingFav ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
          onClick={handleToggleBuildingFavorite}
        >
          <StarIcon size={20} filled={isBuildingFav} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={alertStatus === 'active' ? 'עצירת התרעת בדיקה' : 'סימולציית צבע אדום'}
          title={alertStatus === 'active' ? 'עצירת התרעת בדיקה' : 'סימולציית צבע אדום'}
          onClick={handleToggleAlertSimulation}
        >
          <SirenIcon size={20} />
        </button>
        <ShareLocationButton
          buildingId={buildingId}
          start={start}
          floorName={start ? getFloorName(floors, start.floor) : ''}
          onNeedLocation={() => setIsPickerOpen(true)}
        />
      </header>

      <div className="building-search">
        <SearchBar
          buildingId={buildingId}
          categories={categories}
          floors={floors}
          onSelectPlace={handleSearchSelect}
        />
      </div>

      <div className="building-accessibility-bar" style={{ gap: '8px' }}>
        <button
          type="button"
          className={`accessibility-toggle-btn ${accessible ? 'is-active' : ''}`}
          onClick={handleToggleAccessible}
          aria-pressed={accessible}
          title="מסלול נגיש / מעליות בלבד"
        >
          <AccessibleIcon size={18} />
          <span>מסלול נגיש / מעליות בלבד</span>
        </button>

        <button
          type="button"
          className={`accessibility-toggle-btn ${favoritesOnly ? 'is-active' : ''}`}
          onClick={handleToggleFavoritesFilter}
          aria-pressed={favoritesOnly}
          title="הצגת מקומות מועדפים בלבד"
        >
          <StarIcon size={16} filled={favoritesOnly} />
          <span>מועדפים</span>
        </button>
      </div>

      <div className="building-map">
        {/* key: a new floor = a fresh map, so zoom and position reset */}
        <FloorMap key={planUrl} planUrl={planUrl} width={currentFloor.width} height={currentFloor.height}>
          <PlacesLayer
            places={floorPlaces}
            selectedPlaceId={selectedPlace ? selectedPlace._id : null}
            highlightShelters={alertStatus === 'active'}
            onSelect={handleMapPlaceClick}
          />
          {route && <RouteLayer path={route} currentFloor={currentFloor.floor} />}
          {start && start.floor === currentFloor.floor && <LocationMarker x={start.x} y={start.y} />}
        </FloorMap>

        <div className="building-floor-badge">{floorBadge}</div>
        <FloorSwitcher floors={floors} currentFloor={currentFloor.floor} onChange={setFloorChoice} />
      </div>

      <div className="sheet">
        <div className="sheet-handle" />
        {renderSheetContent()}
      </div>

      {isChatOpen && (
        <ChatPanel
          buildingId={buildingId}
          buildingName={building.name}
          socket={socket}
          onClose={() => setIsChatOpen(false)}
        />
      )}

      <RedAlertModal
        buildingName={building.name}
        floors={floors}
        places={places}
        currentFloor={start ? start.floor : currentFloor.floor}
        onPickLandmark={(place) => findShelterRoute(placeToStartPoint(place))}
        onScan={() => setScanPurpose('shelter')}
      />

      {scanPurpose !== null && <QrScanner onScan={handleScan} onClose={() => setScanPurpose(null)} />}

      <LoginPromptModal
        isOpen={isLoginPromptOpen}
        onClose={() => setIsLoginPromptOpen(false)}
        title="רוצים לשמור למועדפים?"
      />
    </div>
  );
}

// A new link (another building, another QR code) = a brand new page with fresh state.
// That is what the key does: React throws the old page away and builds a new one.
function BuildingPageRoute() {
  const { buildingId = '' } = useParams<{ buildingId: string }>();
  const [searchParams] = useSearchParams();
  const nodeParam = searchParams.get('node');
  const targetParam = searchParams.get('target');

  return (
    <BuildingPage
      key={`${buildingId}|${nodeParam}|${targetParam}`}
      buildingId={buildingId}
      nodeParam={nodeParam}
      targetParam={targetParam}
    />
  );
}

export default BuildingPageRoute;
