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
import { BackIcon, ChatIcon, PencilIcon } from '../components/ui/Icons';
import './BuildingPage.css';

interface BuildingPageProps {
  buildingId: string;
  nodeParam: string | null; // ?node=   from a QR code: where the visitor stands
  targetParam: string | null; // ?target= from "navigate to me": where to go
}

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

  // ---------- Building data ----------
  const [building, setBuilding] = useState<BuildingDetails | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [floorChoice, setFloorChoice] = useState<number | null>(null);

  // ---------- Navigation ----------
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Destination | null>(
    targetParam ? { label: 'your friend', nodeId: targetParam } : null,
  );
  const [route, setRoute] = useState<RouteNode[] | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [isShelterRoute, setIsShelterRoute] = useState(false);

  // ---------- Open panels ----------
  // Without ?node= we don't know where the visitor is, so we ask right away
  const [isPickerOpen, setIsPickerOpen] = useState(nodeParam === null);
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
        setLoadError('Could not load this building.');
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
    async (from: StartPoint, to: Destination) => {
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
          startRoute(startPoint, { label: 'your friend', nodeId: targetParam });
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
  async function findShelterRoute(from: StartPoint) {
    setStart(from);
    setFloorChoice(from.floor);
    setIsPickerOpen(false);
    setSelectedPlace(null);
    minimizeAlert();

    setRoute(null);
    setIsShelterRoute(true);
    setDestination({ label: 'the protected space' });
    setRouteStatus('loading');

    try {
      const path = await getNearestShelter({ buildingId, fromNodeId: from.nodeId });

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
            Back to the map
          </Link>
        </div>
      </div>
    );
  }

  if (!building) {
    return (
      <div className="screen">
        <div className="screen-message">Loading building...</div>
      </div>
    );
  }

  const floors = [...building.floors].sort((a, b) => a.floor - b.floor);

  if (floors.length === 0) {
    return (
      <div className="screen">
        <div className="screen-message">
          <p>This building has no floor plans yet.</p>
          <Link to="/" className="btn btn-outline">
            Back to the map
          </Link>
        </div>
      </div>
    );
  }

  // ---------- What is on screen ----------

  const currentFloor = floors.find((floor) => floor.floor === floorChoice) ?? floors[0];
  const planUrl = getPlanUrl(buildingId, currentFloor.floor);
  const floorPlaces = places.filter((place) => place.floor === currentFloor.floor);
  const categories = [...new Set(places.map((place) => place.category).filter(Boolean))].sort();

  let subtitle = building.city;
  if (route && destination) {
    subtitle = `Route to ${destination.label}`;
  } else if (start) {
    subtitle = `You are near ${start.label}`;
  }

  let floorBadge = getFloorName(floors, currentFloor.floor);
  if (start && start.floor === currentFloor.floor) {
    floorBadge += ' · You are here';
  }

  const chatButton = (
    <button type="button" className="btn btn-outline" onClick={() => setIsChatOpen(true)}>
      <ChatIcon />
      Chat
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
          onNavigate={() => handleNavigate(selectedPlace)}
          onClose={() => setSelectedPlace(null)}
          onOpenChat={() => setIsChatOpen(true)}
        />
      );
    }

    // Nothing selected: a short hint, or the state of a waiting route
    let title = 'Where to?';
    let text = 'Search for a place or tap one on the map.';

    if (destination) {
      title = isShelterRoute ? 'Route to a protected space' : `Route to ${destination.label}`;

      if (routeStatus === 'loading') {
        text = 'Finding the best route...';
      } else if (routeStatus === 'no-route') {
        text = 'No route found. A passage may be blocked right now.';
      } else if (routeStatus === 'error') {
        text = 'Something went wrong. Please try again.';
      } else if (!start) {
        text = 'Tell us where you are to start.';
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
              Cancel
            </button>
          )}
        </div>

        <div className="sheet-actions">
          {!start && (
            <button type="button" className="btn btn-primary" onClick={() => setIsPickerOpen(true)}>
              Set my location
            </button>
          )}
          {canRetry && (
            <button type="button" className="btn btn-primary" onClick={handleRetry}>
              Try again
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
        <button type="button" className="icon-btn" aria-label="Back to the map" onClick={() => navigate('/')}>
          <BackIcon />
        </button>
        <div className="building-heading">
          <div className="building-name">{building.name}</div>
          <div className="building-subtitle">{subtitle}</div>
        </div>
        {/* Only a building manager sees the edit button */}
        {isAdmin && (
          <Link to={`/admin/${buildingId}/places`} className="icon-btn" aria-label="Edit this building" title="Edit this building">
            <PencilIcon size={20} />
          </Link>
        )}
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
