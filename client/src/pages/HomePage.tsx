import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBuildings } from '../api/buildings';
import { useUserLocation } from '../hooks/useUserLocation';
import type { LocationStatus } from '../hooks/useUserLocation';
import { useRecentStore } from '../store/recentStore';
import { useAuthStore } from '../store/authStore';
import type { Building, BuildingType } from '../types/building';
import { searchBuildings } from '../utils/buildingSearch';
import { getBuildingPoint, getDistanceKm } from '../utils/distance';
import BuildingsMap from '../components/home/BuildingsMap';
import type { MapFocus } from '../components/home/BuildingsMap';
import BuildingSearch from '../components/home/BuildingSearch';
import NearbyBuildings from '../components/home/NearbyBuildings';
import BuildingCard from '../components/home/BuildingCard';
import UserMenu from '../components/home/UserMenu';
import QrScanner from '../components/alert/QrScanner';
import type { QrResult } from '../components/alert/QrScanner';
import { Logo, QrIcon } from '../components/ui/Icons';
import './HomePage.css';

const BUILDING_ZOOM = 16; // close enough to see the building and the streets around it

// The line under the list title, when we don't have the user's location
function getLocationMessage(status: LocationStatus): string | null {
  if (status === 'locating') return 'Finding your location...';
  if (status === 'denied') return 'Location is blocked. Allow it for this site in the browser to see what is near you.';
  if (status === 'unavailable') return "We couldn't find your location.";
  if (status === 'insecure') return 'Location works only on a secure (https) site.';
  return null;
}

function HomePage() {
  const navigate = useNavigate();
  const { position: userPosition, status: locationStatus, locate } = useUserLocation();

  const user = useAuthStore((state) => state.user);
  const recent = useRecentStore((state) => state.recent);
  const addRecent = useRecentStore((state) => state.addRecent);
  const clearRecent = useRecentStore((state) => state.clearRecent);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0); // "Try again" adds 1 and loads again

  const [searchText, setSearchText] = useState('');
  const [type, setType] = useState<BuildingType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // All the buildings come from the server once.
  // The search runs here in the browser, so results show up while typing.
  useEffect(() => {
    let isCancelled = false;

    getBuildings()
      .then((data) => {
        if (isCancelled) return;
        setBuildings(data);
        setError(null);
      })
      .catch(() => {
        if (isCancelled) return;
        setError('Could not load buildings.');
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [loadAttempt]);

  const userPoint = userPosition ? { lat: userPosition.lat, lng: userPosition.lng } : null;

  // What the map, the list and the search show: filtered by text and type, best first
  const results = searchBuildings(buildings, searchText, type, userPoint);

  const selectedBuilding = buildings.find((building) => building.id === selectedId) ?? null;
  const selectedDistance =
    selectedBuilding && userPoint ? getDistanceKm(userPoint, getBuildingPoint(selectedBuilding)) : null;

  // A logged-in user is greeted by name
  const searchPlaceholder = user && user.username ? `Where to, ${user.username}?` : 'Where are you going today?';

  // ---------- Actions ----------

  function selectBuilding(building: Building) {
    const point = getBuildingPoint(building);
    setSelectedId(building.id);
    setMapFocus({ kind: 'point', lat: point.lat, lng: point.lng, zoom: BUILDING_ZOOM });
  }

  // Zoom the map out (or in) so all the results fit in it
  function showResultsOnMap() {
    if (results.length === 0) return;

    const points: [number, number][] = results.map(({ building }) => {
      const point = getBuildingPoint(building);
      return [point.lat, point.lng];
    });

    setSelectedId(null);
    setMapFocus({ kind: 'area', points });
  }

  function handleTypeChange(newType: BuildingType | null) {
    setType(newType);
    setSelectedId(null);
  }

  function enterBuilding(building: Building) {
    addRecent(building);
    navigate(`/b/${building.id}`);
  }

  function handleScan(result: QrResult) {
    setIsScannerOpen(false);

    const scannedBuilding = buildings.find((building) => building.id === result.buildingId);
    if (scannedBuilding) {
      addRecent(scannedBuilding);
    }

    navigate(`/b/${result.buildingId}?node=${result.nodeId}`);
  }

  function handleRetryLoad() {
    setIsLoading(true);
    setError(null);
    setLoadAttempt((current) => current + 1);
  }

  // ---------- The bottom sheet ----------

  function renderSheetContent() {
    if (selectedBuilding) {
      return (
        <BuildingCard
          building={selectedBuilding}
          distanceKm={selectedDistance}
          onEnter={() => enterBuilding(selectedBuilding)}
          onClose={() => setSelectedId(null)}
        />
      );
    }

    const isSearching = searchText.trim() !== '';

    let title = 'All buildings';
    if (isSearching) {
      title = 'Search results';
    } else if (userPosition) {
      title = 'Near you';
    }

    const locationMessage = isSearching ? null : getLocationMessage(locationStatus);

    return (
      <>
        <div className="sheet-header">
          <h2 className="sheet-title">{title}</h2>
          {!isLoading && !error && <span className="home-count">{results.length}</span>}
        </div>

        {locationMessage && (
          <p className="sheet-text">
            {locationMessage}
            {locationStatus === 'unavailable' && (
              <button type="button" className="text-btn" onClick={locate}>
                Try again
              </button>
            )}
          </p>
        )}

        {isLoading && <p className="message-info">Loading buildings...</p>}

        {error && (
          <p className="message-error">
            {error}{' '}
            <button type="button" className="text-btn home-retry" onClick={handleRetryLoad}>
              Try again
            </button>
          </p>
        )}

        {!isLoading && !error && results.length === 0 && <p className="message-info">No buildings found.</p>}

        {results.length > 0 && <NearbyBuildings results={results} onPick={selectBuilding} />}

        <div className="sheet-actions">
          <button type="button" className="btn btn-outline home-scan-wide" onClick={() => setIsScannerOpen(true)}>
            <QrIcon />
            Scan the QR code at the entrance
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="screen">
      <header className="home-header">
        <div className="home-logo">
          <Logo />
          <span>InRoute</span>
        </div>
        <UserMenu />
      </header>

      <h1 className="sr-only">Find a building</h1>

      <BuildingSearch
        text={searchText}
        onTextChange={setSearchText}
        type={type}
        onTypeChange={handleTypeChange}
        results={results}
        onPick={selectBuilding}
        onShowAll={showResultsOnMap}
        recent={recent}
        onPickRecent={(buildingId) => navigate(`/b/${buildingId}`)}
        onClearRecent={clearRecent}
        placeholder={searchPlaceholder}
      />

      <div className="home-map">
        <BuildingsMap
          buildings={results.map((result) => result.building)}
          selectedId={selectedId}
          onSelect={selectBuilding}
          userPosition={userPosition}
          locationStatus={locationStatus}
          onLocate={locate}
          focus={mapFocus}
        />
      </div>

      <div className="sheet">
        <div className="sheet-handle" />
        {renderSheetContent()}
      </div>

      {isScannerOpen && <QrScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} />}
    </div>
  );
}

export default HomePage;
