import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { getBuildingCheck, getMyBuildings } from '../../api/admin';
import type { BuildingCheck } from '../../api/admin';
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
  const [setup, setSetup] = useState<BuildingCheck | null>(null);
  const location = useLocation();

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

  // How far the setup of the building got, for the marks on the tabs.
  // Asked again on every move between tabs, so a tab that was just finished gets its mark.
  useEffect(() => {
    let isCancelled = false;

    getBuildingCheck(buildingId)
      .then((result) => {
        if (!isCancelled) setSetup(result);
      })
      .catch(() => {
        // The marks are only a help. Without them the screens work the same.
      });

    return () => {
      isCancelled = true;
    };
  }, [buildingId, location.pathname]);

  const errorCount = setup ? setup.problems.filter((problem) => problem.level === 'error').length : 0;

  function doneMark(isDone: boolean) {
    if (!isDone) return null;
    return (
      <span className="admin-tab-mark" title="הושלם">
        ✓
      </span>
    );
  }

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
        {/* The tabs are also the steps of setting a building up: a mark shows which ones are done */}
        <NavLink to="floors" className="admin-tab">
          קומות
          {doneMark(setup !== null && setup.counts.floors > 0)}
        </NavLink>
        <NavLink to="places" className="admin-tab">
          מקומות
          {doneMark(setup !== null && setup.counts.places > 0)}
        </NavLink>
        <NavLink to="graph" className="admin-tab">
          מעברים
          {doneMark(setup !== null && setup.counts.edges > 0)}
        </NavLink>
        <NavLink to="qr" className="admin-tab">
          קודי QR
        </NavLink>
        <NavLink to="check" className="admin-tab">
          בדיקה
          {errorCount > 0 ? (
            <span className="admin-tab-mark is-error" title={`${errorCount} שגיאות`}>
              {errorCount}
            </span>
          ) : (
            doneMark(setup !== null && setup.counts.edges > 0)
          )}
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
