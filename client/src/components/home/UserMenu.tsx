import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { LogoutIcon } from '../ui/Icons';
import './UserMenu.css';

// A small round button with the first letter of the name.
// A tap opens a small menu with the name, the email and "Log out".
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

  function handleLogout() {
    setIsOpen(false);
    logout();
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-avatar"
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
