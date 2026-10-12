import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { DashboardIcon, LogoutIcon } from '../ui/Icons';
import './UserMenu.css';

// A small round button with the first letter of the name.
// A tap opens a small menu with the name, the email and "Log out".
// A building manager (admin) also gets "Manage buildings" there.
function UserMenu() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // While the menu is open: a click outside it or Escape closes it
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!user) {
    return (
      <Link to="/login" className="user-login-link">
        Log in
      </Link>
    );
  }

  // If the server didn't send a name, use the email. If nothing at all, "?".
  const displayName = user.username || user.email || '';
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';
  const isAdmin = user.role === 'admin' || user.role === 'super';

  function handleLogout() {
    setIsOpen(false);
    logout();
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className={isAdmin ? 'user-avatar is-admin' : 'user-avatar'}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        {initial}
      </button>

      {isOpen && (
        <div className="user-popover" role="menu">
          <div className="user-popover-name">{user.username}</div>
          {user.email && <div className="user-popover-email">{user.email}</div>}
          <div className="user-popover-role">{isAdmin ? 'Building manager' : 'Visitor'}</div>

          {isAdmin && (
            <Link to="/admin" role="menuitem" className="user-popover-link" onClick={() => setIsOpen(false)}>
              <DashboardIcon />
              Manage buildings
            </Link>
          )}

          <button type="button" role="menuitem" className="user-popover-item" onClick={handleLogout}>
            <LogoutIcon />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
