import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Logo } from '../ui/Icons';
import '../../pages/AuthPages.css';

// Wraps every admin screen:
// - not logged in -> to the login page, and back here after it
// - logged in, but as a visitor -> a short page that explains, with the way to ask for access
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
    // The same look as the login and the request pages, so it does not feel like an error screen
    return (
      <div className="screen auth-screen">
        <Link to="/" className="auth-logo">
          <Logo />
          <span>InRoute</span>
        </Link>

        <h1 className="auth-title">אזור הניהול</h1>
        <p className="auth-subtitle">כאן מנהלי מבנים מוסיפים קומות, מקומות ומעברים.</p>

        <div className="auth-form">
          <p className="auth-text">לחשבון שלכם עדיין אין גישת ניהול. מנהלים מבנה? שלחו לנו פנייה ונחזור אליכם.</p>
          <Link to="/join" className="btn btn-primary auth-submit">
            בקשת גישת ניהול
          </Link>
          <Link to="/" className="btn btn-outline auth-second">
            חזרה למפה
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedRoute;
