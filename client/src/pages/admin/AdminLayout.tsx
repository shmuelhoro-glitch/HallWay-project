import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useParams } from 'react-router-dom';
import { getMyBuildings } from '../../api/admin';
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

    // The building itself is open to everyone, so we also ask which buildings this user manages.
    // The server checks it again on every change - this is only to show a clear message.
    Promise.all([getBuildingById(buildingId), getMyBuildings()])
      .then(([data, myBuildings]) => {
        if (isCancelled) return;
        if (!myBuildings.some((item) => item.id === buildingId)) {
          setError('המבנה הזה לא בניהולכם.');
          return;
        }
        setBuilding(data);
        setError(null);
      })
      .catch(() => {
        if (isCancelled) return;
        setError('לא הצלחנו לטעון את המבנה.');
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
            חזרה למבנים
          </Link>
        </div>
      </div>
    );
  }

  if (!building) {
    return (
      <div className="admin-screen">
        <div className="screen-message">טוען...</div>
      </div>
    );
  }

  const context: AdminContext = {
    building,
    reloadBuilding: () => setLoadAttempt((current) => current + 1),
  };

  const floorsText = building.floors.length === 1 ? 'תוכנית קומה אחת' : `${building.floors.length} תוכניות קומה`;

  return (
    <div className="admin-screen">
      <header className="admin-topbar">
        <Link to="/admin" className="icon-btn" aria-label="חזרה למבנים">
          <BackIcon />
        </Link>
        <div className="admin-topbar-titles">
          <h1 className="admin-title">{building.name}</h1>
          <p className="admin-subtitle">
            {BUILDING_TYPE_LABELS[building.type] ?? building.type} · {building.city} · {floorsText}
          </p>
        </div>
        <Link to={`/b/${building.id}`} className="btn btn-small">
          תצוגת מבקר
        </Link>
        <UserMenu />
      </header>

      <nav className="admin-tabs" aria-label="חלקי המבנה">
        <NavLink to="floors" className="admin-tab">
          קומות
        </NavLink>
        <NavLink to="places" className="admin-tab">
          מקומות
        </NavLink>
        <NavLink to="graph" className="admin-tab">
          מעברים
        </NavLink>
        <NavLink to="qr" className="admin-tab">
          קודי QR
        </NavLink>
        <NavLink to="check" className="admin-tab">
          בדיקה
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
