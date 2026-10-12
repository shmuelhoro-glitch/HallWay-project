import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

// Wraps every admin screen:
// - not logged in -> to the login page, and back here after it
// - logged in, but as a visitor -> a short message
// - building manager -> the screen itself
function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    const redirect = encodeURIComponent(location.pathname);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  const isAdmin = user.role === 'admin' || user.role === 'super';
  if (!isAdmin) {
    return (
      <div className="screen">
        <div className="screen-message">
          <p>האזור הזה מיועד למנהלי מבנים.</p>
          <Link to="/" className="btn btn-outline">
            חזרה למפה
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedRoute;
