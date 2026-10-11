import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getBuildings } from '../api/buildings';
import { useDebounce } from '../hooks/useDebounce';
import { useAuthStore } from '../store/authStore';
import { BUILDING_TYPE_LABELS } from '../types/building';
import type { Building, BuildingType } from '../types/building';
import BuildingsMap from '../components/home/BuildingsMap';
import BuildingFilters from '../components/home/BuildingFilters';
import QrScanner from '../components/alert/QrScanner';
import type { QrResult } from '../components/alert/QrScanner';
import { Logo, QrIcon } from '../components/ui/Icons';
import './HomePage.css';

function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [city, setCity] = useState('');
  const [type, setType] = useState<BuildingType | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Ask the server only after the user stopped typing for 300ms
  const debouncedCity = useDebounce(city.trim(), 300);

  useEffect(() => {
    let isCancelled = false;

    getBuildings({ city: debouncedCity, type: type ?? undefined })
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
  }, [debouncedCity, type]);

  const selectedBuilding = buildings.find((building) => building.id === selectedId) ?? null;

  function handleScan(result: QrResult) {
    setIsScannerOpen(false);
    navigate(`/b/${result.buildingId}?node=${result.nodeId}`);
  }

  return (
    <div className="screen">
      <header className="home-header">
        <div className="home-header-row">
          <div className="home-logo">
            <Logo />
            <span>InRoute</span>
          </div>

          {user ? (
            <div className="home-user">
              <span className="home-username">{user.username}</span>
              <button type="button" className="btn btn-small" onClick={logout}>
                Log out
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-small">
              Log in
            </Link>
          )}
        </div>

        <h1 className="home-title">Where are you going today?</h1>
        <p className="home-subtitle">Pick a building on the map, or scan the code at the entrance.</p>
      </header>

      <BuildingFilters city={city} onCityChange={setCity} type={type} onTypeChange={setType} />

      <div className="home-map">
        <BuildingsMap
          buildings={buildings}
          selectedId={selectedId}
          onSelect={(building) => setSelectedId(building.id)}
        />
      </div>

      <div className="sheet">
        <div className="sheet-handle" />

        {selectedBuilding ? (
          <>
            <h2 className="sheet-title">{selectedBuilding.name}</h2>
            <p className="sheet-text">
              {selectedBuilding.city} · {BUILDING_TYPE_LABELS[selectedBuilding.type] ?? selectedBuilding.type} ·{' '}
              {selectedBuilding.floors_count} floors
            </p>
          </>
        ) : (
          <>
            <h2 className="sheet-title">Pick a building</h2>
            <p className="sheet-text">
              {isLoading && 'Loading buildings...'}
              {!isLoading && !error && buildings.length === 0 && 'No buildings found.'}
              {!isLoading && !error && buildings.length > 0 && `${buildings.length} buildings on the map.`}
            </p>
            {error && <p className="message-error">{error}</p>}
          </>
        )}

        <div className="sheet-actions">
          {selectedBuilding && (
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/b/${selectedBuilding.id}`)}>
              Enter building
            </button>
          )}
          <button
            type="button"
            className={selectedBuilding ? 'btn btn-outline' : 'btn btn-outline home-scan-wide'}
            onClick={() => setIsScannerOpen(true)}
          >
            <QrIcon />
            Scan QR
          </button>
        </div>
      </div>

      {isScannerOpen && <QrScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} />}
    </div>
  );
}

export default HomePage;
