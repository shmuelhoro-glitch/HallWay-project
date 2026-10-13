import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBuildings } from '../api/buildings';
import { useUserLocation } from '../hooks/useUserLocation';
import type { LocationStatus } from '../hooks/useUserLocation';
import { useRecentStore } from '../store/recentStore';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import type { Building, BuildingType } from '../types/building';
import { searchBuildings } from '../utils/buildingSearch';
import { findClosestBuildingWithinRadius, getBuildingPoint, getDistanceKm } from '../utils/distance';
import BuildingsMap from '../components/home/BuildingsMap';
import type { MapFocus } from '../components/home/BuildingsMap';
import BuildingSearch from '../components/home/BuildingSearch';
import NearbyBuildings from '../components/home/NearbyBuildings';
import BuildingCard from '../components/home/BuildingCard';
import UserMenu from '../components/home/UserMenu';
import LoginPromptModal from '../components/favorites/LoginPromptModal';
import QrScanner from '../components/alert/QrScanner';
import type { QrResult } from '../components/alert/QrScanner';
import { ChevronDownIcon, ChevronUpIcon, Logo, QrIcon } from '../components/ui/Icons';
import './HomePage.css';

const MAX_AUTO_ENTER_ACCURACY_M = 100;
const BUILDING_ZOOM = 16; // close enough to see the building and the streets around it

// The line under the list title, when we don't have the user's location
function getLocationMessage(status: LocationStatus): string | null {
  if (status === 'locating') return 'מאתרים את המיקום שלכם...';
  if (status === 'denied') return 'הגישה למיקום חסומה. כדי לראות מה קרוב אליכם, אפשרו לאתר גישה למיקום בהגדרות הדפדפן.';
  if (status === 'unavailable') return 'לא הצלחנו לאתר את המיקום שלכם.';
  if (status === 'insecure') return 'איתור המיקום פועל רק באתר מאובטח (https).';
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
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  const favoriteBuildings = useFavoritesStore((state) => state.favorites?.buildings ?? []);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);

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
        setError('לא הצלחנו לטעון את המבנים.');
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
  const baseResults = searchBuildings(buildings, searchText, type, userPoint);
  const results = favoritesOnly
    ? baseResults.filter(({ building }) => (favoriteBuildings || []).includes(building.id))
    : baseResults;

  const selectedBuilding = buildings.find((building) => building.id === selectedId) ?? null;
  const selectedDistance =
    selectedBuilding && userPoint ? getDistanceKm(userPoint, getBuildingPoint(selectedBuilding)) : null;

  // A logged-in user is greeted by name
  const searchPlaceholder = user && user.username ? `לאן הולכים, ${user.username}?` : 'לאן הולכים היום?';

  // ---------- Actions ----------

  // Auto-enter closest building if user is within 150m (and has not already exited/entered in this session)
  useEffect(() => {
    if (!userPosition || buildings.length === 0 || isLoading) return;
    // A position that may be hundreds of meters off says nothing about which building this is
    if (userPosition.accuracy > MAX_AUTO_ENTER_ACCURACY_M) return;

    const hasAutoEntered = sessionStorage.getItem('inroute_auto_entered');
    if (hasAutoEntered) return;

    const match = findClosestBuildingWithinRadius({ lat: userPosition.lat, lng: userPosition.lng }, buildings);
    if (match) {
      sessionStorage.setItem('inroute_auto_entered', match.building.id);
      addRecent(match.building);
      navigate(`/b/${match.building.id}`, {
        state: { autoEntered: true, buildingName: match.building.name },
      });
    }
  }, [userPosition, buildings, isLoading, addRecent, navigate]);

  function handleToggleFavorites() {
    if (!user) {
      setIsLoginPromptOpen(true);
      return;
    }
    setFavoritesOnly(!favoritesOnly);
  }

  function selectBuilding(building: Building) {
    const point = getBuildingPoint(building);
    setSelectedId(building.id);
    setIsSheetExpanded(false);
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
    sessionStorage.setItem('inroute_auto_entered', building.id);
    addRecent(building);
    navigate(`/b/${building.id}`);
  }

  function handleScan(result: QrResult) {
    setIsScannerOpen(false);
    sessionStorage.setItem('inroute_auto_entered', result.buildingId);

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

    let title = 'כל המבנים';
    if (isSearching) {
      title = 'תוצאות חיפוש';
    } else if (userPosition) {
      title = 'קרוב אליכם';
    }

    const locationMessage = isSearching ? null : getLocationMessage(locationStatus);

    return (
      <>
        <div className="sheet-header">
          <div className="sheet-title-group">
            <h2 className="sheet-title">{title}</h2>
            {!isLoading && !error && <span className="home-count">{results.length}</span>}
          </div>
          {!isLoading && !error && results.length > 0 && (
            <button
              type="button"
              className="sheet-toggle-expand-btn"
              onClick={() => setIsSheetExpanded(!isSheetExpanded)}
              aria-expanded={isSheetExpanded}
            >
              {isSheetExpanded ? (
                <>
                  <span>חזרה למפה</span>
                  <ChevronDownIcon size={16} />
                </>
              ) : (
                <>
                  <span>הצג הכול</span>
                  <ChevronUpIcon size={16} />
                </>
              )}
            </button>
          )}
        </div>

        {locationMessage && !isSheetExpanded && (
          <p className="sheet-text">
            {locationMessage}
            {locationStatus === 'unavailable' && (
              <button type="button" className="text-btn" onClick={locate}>
                נסו שוב
              </button>
            )}
          </p>
        )}

        {isLoading && <p className="message-info is-loading" role="status">טוען מבנים...</p>}

        {error && (
          <p className="message-error" role="alert">
            {error}{' '}
            <button type="button" className="text-btn home-retry" onClick={handleRetryLoad}>
              נסו שוב
            </button>
          </p>
        )}

        {!isLoading && !error && results.length === 0 && <p className="message-info">לא נמצאו מבנים.</p>}

        {results.length > 0 && (
          <NearbyBuildings
            results={results}
            onPick={selectBuilding}
            isExpanded={isSheetExpanded}
            onPromptLogin={() => setIsLoginPromptOpen(true)}
          />
        )}

        <div className="sheet-actions">
          <button type="button" className="btn btn-outline home-scan-wide" onClick={() => setIsScannerOpen(true)}>
            <QrIcon />
            סריקת קוד ה-QR שבכניסה
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

      <h1 className="sr-only">חיפוש מבנה</h1>

      <BuildingSearch
        text={searchText}
        onTextChange={setSearchText}
        type={type}
        onTypeChange={(newType) => {
          setFavoritesOnly(false);
          handleTypeChange(newType);
        }}
        favoritesOnly={favoritesOnly}
        onToggleFavorites={handleToggleFavorites}
        results={results}
        onPick={selectBuilding}
        onShowAll={showResultsOnMap}
        recent={recent}
        onPickRecent={(buildingId) => {
          sessionStorage.setItem('inroute_auto_entered', buildingId);
          navigate(`/b/${buildingId}`);
        }}
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

      <div className={`sheet${isSheetExpanded ? ' is-expanded' : ''}`}>
        <button
          type="button"
          className="sheet-handle-btn"
          onClick={() => {
            if (!selectedBuilding) {
              setIsSheetExpanded(!isSheetExpanded);
            }
          }}
          aria-label={isSheetExpanded ? 'כיווץ המגירה למפה' : 'הרחבת המגירה לרשימה מלאה'}
        >
          <div className="sheet-handle" />
        </button>
        {renderSheetContent()}
      </div>

      {isScannerOpen && <QrScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} />}

      <LoginPromptModal
        isOpen={isLoginPromptOpen}
        onClose={() => setIsLoginPromptOpen(false)}
        title="רוצים לראות מועדפים?"
      />
    </div>
  );
}

export default HomePage;
