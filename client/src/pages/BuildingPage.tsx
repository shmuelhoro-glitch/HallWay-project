import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import type { SvgPoint } from '../utils/svgCoords';

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
import StoresDirectory from '../components/places/StoresDirectory';
import { BackIcon, ChatIcon, MapIcon, MoonIcon, PencilIcon, SirenIcon, StarIcon, StoreIcon, SunIcon } from '../components/ui/Icons';
import { simulateAlert, stopAlert } from '../api/alerts';
import { useFavoritesStore } from '../store/favoritesStore';
import { useSettingsStore } from '../store/settingsStore';
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
  const location = useLocation();
  const socket = useBuildingRoom(buildingId);

  const [showAutoEnterToast, setShowAutoEnterToast] = useState(Boolean(location.state?.autoEntered));

  useEffect(() => {
    if (showAutoEnterToast) {
      const timer = setTimeout(() => {
        setShowAutoEnterToast(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [showAutoEnterToast]);

  const start = useLocationStore((state) => state.start);
  const setStart = useLocationStore((state) => state.setStart);
  const clearStart = useLocationStore((state) => state.clearStart);
  const alertStatus = useAlertStore((state) => state.status);
  const minimizeAlert = useAlertStore((state) => state.minimize);
  const clearAlert = useAlertStore((state) => state.clearAlert);

  const user = useAuthStore((state) => state.user);
  const isAdmin = user !== null && (user.role === 'admin' || user.role === 'super');
  const isSuper = user !== null && user.role === 'super';

  const isBuildingFav = useFavoritesStore((state) => state.isBuildingFavorite(buildingId));
  const toggleBuildingFav = useFavoritesStore((state) => state.toggleBuildingFavorite);
  const favoritePlaces = useFavoritesStore((state) => state.favorites?.places ?? []);

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
  const theme = useSettingsStore((state) => state.theme);
  const toggleTheme = useSettingsStore((state) => state.toggleTheme);
  const accessibleDefault = useSettingsStore((state) => state.accessibleDefault);

  const [accessible, setAccessible] = useState(accessibleDefault);
  // View mode switcher: map view vs stores directory
  const [activeView, setActiveView] = useState<'map' | 'stores'>('map');
  // The same value, for startRoute. If startRoute itself depended on "accessible" it would be a new
  // function after every press, the ?node= effect would run again, and the visitor would jump back
  // to the QR point he came from.
  const accessibleRef = useRef(accessibleDefault);

  // ---------- Open panels ----------
  // A visitor first looks around: the map and the search come before any question.
  // "Where are you?" opens by itself only for a "navigate to me" link, where a route is waiting for it.
  const [isPickerOpen, setIsPickerOpen] = useState(nodeParam === null && targetParam !== null);
  const [scanPurpose, setScanPurpose] = useState<'start' | 'shelter' | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  // Track unread chat messages when chat panel is closed
  useEffect(() => {
    function handleChatMessage() {
      if (!isChatOpen) {
        setHasUnreadChat(true);
      }
    }
    socket.on('chat:message', handleChatMessage);
    return () => {
      socket.off('chat:message', handleChatMessage);
    };
  }, [socket, isChatOpen]);

  function handleOpenChat() {
    setIsChatOpen(true);
    setHasUnreadChat(false);
  }

  // Load the building (with its floors) and all of its places
  useEffect(() => {
    let isCancelled = false;

    Promise.all([getBuildingById(buildingId), getPlaces(buildingId)])
      .then(([buildingData, placesData]) => {
        if (isCancelled) return;
        setBuilding(buildingData);
        setPlaces(Array.isArray(placesData) ? placesData : []);
      })
      .catch((err) => {
        console.error('Failed to load building data:', err);
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
      const useAccessible = isAccessible ?? accessibleRef.current;
      setDestination(to);
      setRoute(null);
      setIsShelterRoute(false);
      setRouteStatus('loading');

      try {
        if (!from?.nodeId) {
          console.error('startRoute error: starting point has no nodeId', from);
          setRouteStatus('error');
          return;
        }

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
      } catch (err) {
        console.error('startRoute failed to fetch route:', err);
        setRouteStatus('error');
      }
    },
    [buildingId],
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

  function handleDirectoryNavigate(place: Place) {
    setFloorChoice(place.floor);
    setActiveView('map');
    handleNavigate(place);
  }

  function handleDirectoryShowOnMap(place: Place) {
    setFloorChoice(place.floor);
    setSelectedPlace(place);
    setActiveView('map');
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
    accessibleRef.current = nextAccessible;
    setAccessible(nextAccessible);

    if (start && destination) {
      if (isShelterRoute) {
        findShelterRoute(start, nextAccessible);
      } else {
        startRoute(start, destination, nextAccessible);
      }
    }
  }

  // A drill: only for the owners of the system. Everyone in the building gets it, marked as a drill.
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

  const floors = Array.isArray(building?.floors)
    ? [...building.floors].sort((a, b) => a.floor - b.floor)
    : [];

  if (floors.length === 0) {
    return (
      <div className="screen">
        <div className="screen-message">
          <h2 className="screen-message-title">{building.name}</h2>
          <p className="screen-message-text">
            למבנה זה עדיין אין תוכניות קומה במערכת.
          </p>
          <Link to="/" className="btn btn-primary">
            חזרה למפה הראשית
          </Link>
        </div>
      </div>
    );
  }

  // ---------- What is on screen ----------

  const currentFloor = floors.find((floor) => floor.floor === floorChoice) ?? floors[0];
  const planUrl = getPlanUrl(buildingId, currentFloor.floor);

  // A long plan does not fit a phone whole, so the map opens where the visitor needs it:
  // on the route of this floor, or on "you are here". A new start or a new route opens it again there.
  const routeOnFloor = route ? route.find((node) => node.floor === currentFloor.floor) : undefined;
  const mapStart = routeOnFloor ?? (start && start.floor === currentFloor.floor ? start : null);
  const mapKey = `${planUrl}|${start ? start.nodeId : ''}|${route ? `${route[0].id}-${route.length}` : ''}`;
  const floorPlaces = (places || []).filter(
    (place) =>
      place.floor === currentFloor.floor &&
      (!favoritesOnly || (Array.isArray(favoritePlaces) && favoritePlaces.some((item) => item?.id === place._id)))
  );
  const categories = [...new Set(places.map((place) => place.category).filter(Boolean))].sort();

  let subtitle = building.city;
  if (route && destination) {
    subtitle = `מסלול אל ${destination.label}`;
  } else if (start) {
    subtitle = `אתם ליד ${start.label}`;
  }

  const chatButton = (
    <button type="button" className="btn btn-outline" onClick={handleOpenChat}>
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
          onOpenChat={handleOpenChat}
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
          onToggleAccessible={handleToggleAccessible}
          onNavigate={() => handleNavigate(selectedPlace)}
          onClose={() => setSelectedPlace(null)}
          onOpenChat={handleOpenChat}
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

    if (destination) {
      return (
        <div className="building-quick-sheet">
          <div className="sheet-header">
            <div>
              <h2 className="sheet-title">{title}</h2>
              <p className="sheet-text">{text}</p>
            </div>
            <button type="button" className="text-btn" onClick={handleEndRoute}>
              ביטול
            </button>
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
        </div>
      );
    }

    return null;
  }

  // A tap next to a place (not exactly on its point) still picks it: the closest place, if it is near
  // the finger. Not much more than a fingertip, or in a busy mall every tap picks some store, and
  // a tap on an empty spot could never close the card.
  function handleMapClick(point: SvgPoint, unitsPerPixel: number) {
    if (floorPlaces.length === 0) return;

    const MAX_SNAP_DISTANCE = 32 * unitsPerPixel;

    let closestPlace: Place | null = null;
    let minDistance = Infinity;

    for (const place of floorPlaces) {
      const dist = Math.hypot(place.x - point.x, place.y - point.y);
      if (dist < minDistance) {
        minDistance = dist;
        closestPlace = place;
      }
    }

    if (closestPlace && minDistance <= MAX_SNAP_DISTANCE) {
      handleMapPlaceClick(closestPlace);
    } else {
      // Tapped far outside on empty area: clear selected place unless picking a location
      if (!isPickerOpen) {
        setSelectedPlace(null);
      }
    }
  }

  return (
    <div className="screen">
      <AlertBanner />

      {showAutoEnterToast && (
        <div className="auto-enter-banner" role="status">
          <div className="auto-enter-content">
            <span className="auto-enter-icon">📍</span>
            <span className="auto-enter-text">
              זיהינו שהגעתם אל <strong>{building.name}</strong> והעברנו אתכם למפה הפנימית
            </span>
          </div>
          <div className="auto-enter-actions">
            <button
              type="button"
              className="auto-enter-btn-back"
              onClick={() => navigate('/')}
            >
              חזרה למפת העיר
            </button>
            <button
              type="button"
              className="auto-enter-btn-close"
              onClick={() => setShowAutoEnterToast(false)}
              aria-label="סגירה"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <header className="building-topbar-floating">
        <button
          type="button"
          className="building-round-btn"
          aria-label="חזרה למפה הראשית"
          onClick={() => navigate('/')}
        >
          <BackIcon />
        </button>

        <div className="building-title-pill">
          <span className="building-title-name">{building.name}</span>
          <span className="building-title-sep">·</span>
          <span className="building-title-floor">{subtitle}</span>
        </div>

        <div className="building-topbar-actions">
          <button
            type="button"
            className="building-icon-pill"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'מעבר למצב מואר' : 'מעבר למצב כהה'}
            title={theme === 'dark' ? 'מצב מואר' : 'מצב כהה'}
          >
            {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>

          <button
            type="button"
            className={`building-icon-pill ${isBuildingFav ? 'is-active' : ''}`}
            aria-label={isBuildingFav ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
            title={isBuildingFav ? 'הסרה ממועדפים' : 'שמירה במועדפים'}
            onClick={handleToggleBuildingFavorite}
          >
            <StarIcon size={18} filled={isBuildingFav} />
          </button>

          <button
            type="button"
            className="building-icon-pill has-badge"
            aria-label="צ׳אט המבנה"
            title="צ׳אט המבנה"
            onClick={handleOpenChat}
          >
            <ChatIcon size={18} />
            {hasUnreadChat && <span className="chat-unread-dot" aria-label="הודעה חדשה בצ'אט" />}
          </button>

          {isAdmin && (
            <Link to={`/admin/${buildingId}/places`} className="building-icon-pill" aria-label="עריכת המבנה" title="עריכת המבנה">
              <PencilIcon size={18} />
            </Link>
          )}

          {isSuper && (
            <button
              type="button"
              className="building-icon-pill"
              aria-label={alertStatus === 'active' ? 'עצירת התרגיל' : 'תרגיל צבע אדום'}
              title={alertStatus === 'active' ? 'עצירת התרגיל' : 'תרגיל צבע אדום'}
              onClick={handleToggleAlertSimulation}
            >
              <SirenIcon size={18} />
            </button>
          )}

          <ShareLocationButton
            buildingId={buildingId}
            start={start}
            floorName={start ? getFloorName(floors, start.floor) : ''}
            onNeedLocation={() => setIsPickerOpen(true)}
          />
        </div>
      </header>

      {activeView === 'map' && (
        <div className="building-floating-search-wrap">
          <div className="building-search-field">
            <SearchBar
              buildingId={buildingId}
              categories={categories}
              floors={floors}
              onSelectPlace={handleSearchSelect}
            />
          </div>
          <button
            type="button"
            className={`building-icon-pill ${favoritesOnly ? 'is-active' : ''}`}
            onClick={handleToggleFavoritesFilter}
            aria-pressed={favoritesOnly}
            title={favoritesOnly ? 'הצגת כל המקומות' : 'הצגת מקומות מועדפים בלבד'}
          >
            <StarIcon size={18} filled={favoritesOnly} />
          </button>
        </div>
      )}

      {activeView === 'stores' ? (
        <div className="building-stores-screen">
          <StoresDirectory
            places={places}
            floors={floors}
            currentFloor={currentFloor.floor}
            onSelectPlace={handleDirectoryShowOnMap}
            onNavigateToPlace={handleDirectoryNavigate}
            onShowOnMap={handleDirectoryShowOnMap}
            onPromptLogin={() => setIsLoginPromptOpen(true)}
          />
        </div>
      ) : (
        <div className="building-map full-screen">
          <FloorMap
            key={mapKey}
            planUrl={planUrl}
            width={currentFloor.width}
            height={currentFloor.height}
            onMapClick={handleMapClick}
            startAt={mapStart}
          >
            <PlacesLayer
              places={floorPlaces}
              selectedPlaceId={selectedPlace ? selectedPlace._id : null}
              highlightShelters={alertStatus === 'active'}
              onSelect={handleMapPlaceClick}
            />
            {route && <RouteLayer path={route} currentFloor={currentFloor.floor} />}
            {start && start.floor === currentFloor.floor && <LocationMarker x={start.x} y={start.y} />}
          </FloorMap>

          <FloorSwitcher floors={floors} currentFloor={currentFloor.floor} onChange={setFloorChoice} />
        </div>
      )}

      {/* Floating Sheet Card for Active Selection */}
      {(selectedPlace || (route && destination) || isPickerOpen || destination) && activeView === 'map' && (
        <div className="sheet sheet-floating-card" role="dialog" aria-modal="true">
          <div className="sheet-handle" />
          {renderSheetContent()}
        </div>
      )}

      {/* Option 3 Hero Component: Floating Mode Switcher Dock */}
      {!selectedPlace && !(route && destination) && !isPickerOpen && !destination && (
        <div className="floating-mode-dock" role="tablist" aria-label="מעבר בין תצוגות">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'map'}
            className={`floating-dock-pill ${activeView === 'map' ? 'is-active' : ''}`}
            onClick={() => setActiveView('map')}
          >
            <MapIcon size={18} />
            <span>מפה מלאה</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'stores'}
            className={`floating-dock-pill ${activeView === 'stores' ? 'is-active' : ''}`}
            onClick={() => setActiveView('stores')}
          >
            <StoreIcon size={18} />
            <span>קטלוג חנויות ({places.length})</span>
          </button>
        </div>
      )}

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
