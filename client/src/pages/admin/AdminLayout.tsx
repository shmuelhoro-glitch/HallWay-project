import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useParams } from 'react-router-dom';
import { getBuildingById } from '../../api/buildings';
import type { BuildingDetails } from '../../types/building';
import { BUILDING_TYPE_LABELS } from '../../types/building';
import { useAdminBuilding } from './adminContext';
import type { AdminContext } from './adminContext';
import UserMenu from '../../components/home/UserMenu';
import { BackIcon } from '../../components/ui/Icons';
import './Admin.css';

// /admin/:buildingId/... - the frame of one building: title, tabs, and the tab itself (<Outlet />).
// The building is loaded here once, and every tab gets it with useAdminBuilding().
function AdminLayout() {
  const { buildingId = '' } = useParams<{ buildingId: string }>();

  const [building, setBuilding] = useState<BuildingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0); // reloadBuilding() adds 1 = load again

  useEffect(() => {
    let isCancelled = false;

    getBuildingById(buildingId)
      .then((data) => {
        if (isCancelled) return;
        setBuilding(data);
        setError(null);
      })
      .catch(() => {
        if (isCancelled) return;
        setError('Could not load this building.');
      });

    return () => {
      isCancelled = true;
    };
  }, [buildingId, loadAttempt]);

  if (error) {
    return (
      <div className="admin-screen">
        <div className="screen-message">
          <p>{error}</p>
          <Link to="/admin" className="btn btn-outline">
            Back to buildings
          </Link>
        </div>
      </div>
    );
  }

  if (!building) {
    return (
      <div className="admin-screen">
        <div className="screen-message">Loading...</div>
      </div>
    );
  }

  const context: AdminContext = {
    building,
    reloadBuilding: () => setLoadAttempt((current) => current + 1),
  };

  const floorsText = building.floors.length === 1 ? '1 floor plan' : `${building.floors.length} floor plans`;

  return (
    <div className="admin-screen">
      <header className="admin-topbar">
        <Link to="/admin" className="icon-btn" aria-label="Back to buildings">
          <BackIcon />
        </Link>
        <div className="admin-topbar-titles">
          <h1 className="admin-title">{building.name}</h1>
          <p className="admin-subtitle">
            {BUILDING_TYPE_LABELS[building.type] ?? building.type} · {building.city} · {floorsText}
          </p>
        </div>
        <Link to={`/b/${building.id}`} className="btn btn-small">
          Open as visitor
        </Link>
        <UserMenu />
      </header>

      <nav className="admin-tabs" aria-label="Building sections">
        <NavLink to="floors" className="admin-tab">
          Floors
        </NavLink>
        <NavLink to="places" className="admin-tab">
          Places
        </NavLink>
        <NavLink to="graph" className="admin-tab">
          Walkways
        </NavLink>
        <NavLink to="qr" className="admin-tab">
          QR codes
        </NavLink>
      </nav>

      <main className="admin-content">
        <Outlet context={context} />
      </main>
    </div>
  );
}

// /admin/:buildingId without a tab: a new building starts with its floors, the rest with places
export function AdminIndexRedirect() {
  const { building } = useAdminBuilding();
  return <Navigate to={building.floors.length === 0 ? 'floors' : 'places'} replace />;
}

export default AdminLayout;
