import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBuildings } from '../../api/buildings';
import { BUILDING_TYPE_LABELS } from '../../types/building';
import type { Building } from '../../types/building';
import UserMenu from '../../components/home/UserMenu';
import { BuildingTypeIcon, ChevronIcon, Logo, PlusIcon, SearchIcon } from '../../components/ui/Icons';
import './Admin.css';
import './AdminHomePage.css';

// /admin - all the buildings. A building opens its admin screens.
function AdminHomePage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let isCancelled = false;

    getBuildings()
      .then((data) => {
        if (isCancelled) return;
        setBuildings(data);
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
  }, []);

  // A simple filter by name or city, while typing
  const query = search.trim().toLowerCase();
  const shownBuildings = buildings.filter(
    (building) =>
      building.name.toLowerCase().includes(query) || building.city.toLowerCase().includes(query),
  );

  return (
    <div className="admin-screen">
      <header className="admin-topbar">
        <div className="admin-topbar-titles">
          <Link to="/" className="admin-logo">
            <Logo />
            <span>InRoute</span>
          </Link>
        </div>
        <UserMenu />
      </header>

      <div className="admin-content">
        <div className="admin-home-head">
          <div>
            <h1 className="admin-title">Manage buildings</h1>
            <p className="admin-subtitle">Pick a building to edit its floors, places and walkways.</p>
          </div>
          <Link to="/admin/new" className="btn btn-primary admin-home-new">
            <PlusIcon />
            New building
          </Link>
        </div>

        <div className="search-field admin-home-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search by name or city"
            aria-label="Search buildings"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {isLoading && <p className="message-info">Loading buildings...</p>}
        {error && <p className="message-error">{error}</p>}

        {!isLoading && !error && buildings.length === 0 && (
          <div className="admin-empty">
            <p>No buildings yet.</p>
            <Link to="/admin/new" className="btn btn-primary">
              Add the first building
            </Link>
          </div>
        )}

        <div className="admin-building-grid">
          {shownBuildings.map((building) => (
            <Link key={building.id} to={`/admin/${building.id}`} className="admin-building-card">
              <span className="admin-building-icon">
                <BuildingTypeIcon type={building.type} size={20} />
              </span>
              <span className="admin-building-text">
                <span className="admin-row-name">{building.name}</span>
                <span className="admin-row-meta">
                  {BUILDING_TYPE_LABELS[building.type] ?? building.type} · {building.city} · {building.floors_count}{' '}
                  {building.floors_count === 1 ? 'floor' : 'floors'}
                </span>
              </span>
              <ChevronIcon />
            </Link>
          ))}
        </div>

        {!isLoading && buildings.length > 0 && shownBuildings.length === 0 && (
          <p className="message-info">No building matches “{search}”.</p>
        )}
      </div>
    </div>
  );
}

export default AdminHomePage;
