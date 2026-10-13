import { useNavigate, useLocation } from 'react-router-dom';
import { HomeIcon, MapIcon, SearchIcon, StarIcon, UserIcon } from '../ui/Icons';
import { useAuthStore } from '../../store/authStore';
import './BottomNavbar.css';

export type NavTabId = 'home' | 'map' | 'search' | 'favorites' | 'profile';

interface BottomNavbarProps {
  activeTab?: NavTabId;
  onTabSelect?: (tab: NavTabId) => void;
  onOpenUserMenu?: () => void;
}

export default function BottomNavbar({
  activeTab,
  onTabSelect,
  onOpenUserMenu,
}: BottomNavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  // Deduce active tab if not passed explicitly
  const currentTab: NavTabId = activeTab ?? (
    location.pathname === '/' ? 'home' :
    location.pathname === '/favorites' ? 'favorites' :
    location.pathname.startsWith('/b/') ? 'map' :
    'home'
  );

  function handleTabClick(tab: NavTabId) {
    if (onTabSelect) {
      onTabSelect(tab);
    }

    if (tab === 'home') {
      if (location.pathname !== '/') {
        navigate('/');
      }
    } else if (tab === 'favorites') {
      if (location.pathname !== '/favorites') {
        navigate('/favorites');
      }
    } else if (tab === 'profile') {
      if (onOpenUserMenu) {
        onOpenUserMenu();
      } else if (!user) {
        navigate('/login');
      } else {
        navigate('/favorites');
      }
    }
  }

  return (
    <nav className="bottom-navbar" aria-label="ניווט ראשי">
      <div className="bottom-navbar-dock">
        <button
          type="button"
          className={`bottom-nav-item ${currentTab === 'home' ? 'is-active' : ''}`}
          onClick={() => handleTabClick('home')}
          aria-label="דף הבית"
        >
          <span className="bottom-nav-icon-wrapper">
            <HomeIcon size={22} />
          </span>
          <span className="bottom-nav-label">בית</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${currentTab === 'map' ? 'is-active' : ''}`}
          onClick={() => handleTabClick('map')}
          aria-label="תצוגת מפה"
        >
          <span className="bottom-nav-icon-wrapper">
            <MapIcon size={22} />
          </span>
          <span className="bottom-nav-label">מפה</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${currentTab === 'search' ? 'is-active' : ''}`}
          onClick={() => handleTabClick('search')}
          aria-label="חיפוש"
        >
          <span className="bottom-nav-icon-wrapper">
            <SearchIcon size={22} />
          </span>
          <span className="bottom-nav-label">חיפוש</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${currentTab === 'favorites' ? 'is-active' : ''}`}
          onClick={() => handleTabClick('favorites')}
          aria-label="מועדפים"
        >
          <span className="bottom-nav-icon-wrapper">
            <StarIcon size={22} filled={currentTab === 'favorites'} />
          </span>
          <span className="bottom-nav-label">מועדפים</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${currentTab === 'profile' ? 'is-active' : ''}`}
          onClick={() => handleTabClick('profile')}
          aria-label={user ? `החשבון שלי (${user.username})` : 'כניסה לחשבון'}
        >
          <span className="bottom-nav-icon-wrapper">
            <UserIcon size={22} />
          </span>
          <span className="bottom-nav-label">{user ? 'פרופיל' : 'כניסה'}</span>
        </button>
      </div>
    </nav>
  );
}
