import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { useSettingsStore } from '../store/settingsStore';
import { getBuildings } from '../api/buildings';
import type { Building } from '../types/building';
import { BUILDING_TYPE_LABELS } from '../types/building';
import { getDefaultFloorName } from '../utils/floors';
import {
  AccessibleIcon,
  BackIcon,
  BuildingTypeIcon,
  ChevronIcon,
  MoonIcon,
  StarIcon,
  SunIcon,
} from '../components/ui/Icons';
import BottomNavbar from '../components/navigation/BottomNavbar';
import './FavoritesPage.css';

type TabType = 'all' | 'buildings' | 'places';

function FavoritesPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const favorites = useFavoritesStore((state) => state.favorites);
  const toggleBuilding = useFavoritesStore((state) => state.toggleBuildingFavorite);
  const togglePlace = useFavoritesStore((state) => state.togglePlaceFavorite);

  const theme = useSettingsStore((state) => state.theme);
  const toggleTheme = useSettingsStore((state) => state.toggleTheme);
  const accessibleDefault = useSettingsStore((state) => state.accessibleDefault);
  const toggleAccessibleDefault = useSettingsStore((state) => state.toggleAccessibleDefault);

  const [allBuildings, setAllBuildings] = useState<Building[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Load all buildings so we can show details of favorite buildings
  useEffect(() => {
    getBuildings()
      .then((data) => setAllBuildings(data))
      .catch((err) => console.error('Failed to load buildings:', err));
  }, []);

  const favBuildings = favorites?.buildings ?? [];
  const favPlaces = favorites?.places ?? [];

  // Filtered favorite buildings
  const favoriteBuildings = useMemo(() => {
    return allBuildings.filter((b) => favBuildings.includes(b.id));
  }, [allBuildings, favBuildings]);

  // All distinct categories from saved places and buildings
  const categories = useMemo(() => {
    const cats = new Set<string>();
    favPlaces.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    favoriteBuildings.forEach((b) => {
      const label = BUILDING_TYPE_LABELS[b.type] ?? b.type;
      cats.add(label);
    });
    return Array.from(cats);
  }, [favPlaces, favoriteBuildings]);

  // Filtered lists by selected category
  const displayedBuildings = useMemo(() => {
    if (activeTab === 'places') return [];
    if (!selectedCategory) return favoriteBuildings;
    return favoriteBuildings.filter((b) => {
      const label = BUILDING_TYPE_LABELS[b.type] ?? b.type;
      return label === selectedCategory;
    });
  }, [activeTab, selectedCategory, favoriteBuildings]);

  const displayedPlaces = useMemo(() => {
    if (activeTab === 'buildings') return [];
    if (!selectedCategory) return favPlaces;
    return favPlaces.filter((p) => p.category === selectedCategory);
  }, [activeTab, selectedCategory, favPlaces]);

  const totalCount = displayedBuildings.length + displayedPlaces.length;

  if (!user) {
    return (
      <div className="favorites-page">
        <header className="favorites-header">
          <button type="button" className="icon-btn" onClick={() => navigate('/')} aria-label="חזרה">
            <BackIcon />
          </button>
          <h1 className="favorites-title">האזור האישי</h1>
        </header>

        <div className="favorites-guest-card">
          <div className="favorites-guest-icon">
            <StarIcon size={40} filled />
          </div>
          <h2>רוצים לשמור מועדפים?</h2>
          <p>התחברו למערכת כדי לנהל את המבנים והחנויות האהובים עליכם ולגשת אליהם מכל מכשיר.</p>
          <div className="favorites-guest-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
              התחברות למערכת
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/register')}>
              הרשמה לחשבון חדש
            </button>
          </div>
        </div>
        <BottomNavbar activeTab="favorites" />
      </div>
    );
  }

  return (
    <div className="favorites-page">
      <header className="favorites-header">
        <button type="button" className="icon-btn" onClick={() => navigate('/')} aria-label="חזרה לדף הבית">
          <BackIcon />
        </button>
        <div>
          <h1 className="favorites-title">האזור האישי</h1>
          <p className="favorites-subtitle">המועדפים וההגדרות של {user.username}</p>
        </div>
      </header>

      {/* Settings & Preferences */}
      <section className="favorites-settings-card" aria-label="הגדרות והעדפות">
        <h2 className="favorites-settings-title">העדפות שימוש</h2>
        <div className="favorites-settings-row">
          <div className="favorites-settings-info">
            <span className="favorites-settings-label">
              <AccessibleIcon size={18} />
              <span>ניווט נגיש כברירת מחדל</span>
            </span>
            <span className="favorites-settings-desc">
              תמיד להעדיף מעליות ולמנוע מסלולים הכוללים מדרגות
            </span>
          </div>
          <button
            type="button"
            className={`toggle-switch ${accessibleDefault ? 'is-active' : ''}`}
            onClick={toggleAccessibleDefault}
            aria-pressed={accessibleDefault}
            aria-label="הפעלת ניווט נגיש כברירת מחדל"
          >
            <span className="toggle-switch-slider" />
          </button>
        </div>

        <div className="favorites-settings-row">
          <div className="favorites-settings-info">
            <span className="favorites-settings-label">
              {theme === 'dark' ? <MoonIcon size={18} /> : <SunIcon size={18} />}
              <span>ערכת נושא</span>
            </span>
            <span className="favorites-settings-desc">
              {theme === 'dark' ? 'מצב כהה (Dark Mode) פעיל' : 'מצב מואר (Light Mode) פעיל'}
            </span>
          </div>
          <button
            type="button"
            className={`toggle-switch ${theme === 'dark' ? 'is-active' : ''}`}
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label="מעבר בין מצב כהה למצב מואר"
          >
            <span className="toggle-switch-slider" />
          </button>
        </div>
      </section>

      {/* Tabs */}
      <div className="segmented favorites-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          aria-pressed={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
        >
          הכול ({favBuildings.length + favPlaces.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'buildings'}
          aria-pressed={activeTab === 'buildings'}
          onClick={() => setActiveTab('buildings')}
        >
          מבנים ({favBuildings.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'places'}
          aria-pressed={activeTab === 'places'}
          onClick={() => setActiveTab('places')}
        >
          חנויות ומקומות ({favPlaces.length})
        </button>
      </div>

      {/* Category Filter Chips */}
      {categories.length > 0 && (
        <div className="chip-row favorites-chips" role="group" aria-label="סינון לפי קטגוריה">
          <button
            type="button"
            className="chip"
            aria-pressed={selectedCategory === null}
            onClick={() => setSelectedCategory(null)}
          >
            כל הקטגוריות
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className="chip"
              aria-pressed={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <main className="favorites-content">
        {totalCount === 0 && (
          <div className="favorites-empty">
            <div className="favorites-empty-icon">
              <StarIcon size={36} />
            </div>
            <h3>אין מועדפים להצגה</h3>
            <p>
              {selectedCategory
                ? 'לא נמצאו מועדפים בקטגוריה זו.'
                : 'לחצו על הכוכב בכרטיס מבנה או בחנות כדי להוסיף אותם לאזור האישי שלכם.'}
            </p>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>
              חיפוש מבנים וחנויות
            </button>
          </div>
        )}

        {/* Favorite Buildings Section */}
        {displayedBuildings.length > 0 && (
          <section className="favorites-section">
            <h2 className="favorites-section-title">
              מבנים שמורים ({displayedBuildings.length})
            </h2>
            <div className="favorites-list">
              {displayedBuildings.map((building) => (
                <div key={building.id} className="favorites-card">
                  <div
                    className="favorites-card-main"
                    onClick={() => navigate(`/b/${building.id}`)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="favorites-card-icon">
                      <BuildingTypeIcon type={building.type} size={22} />
                    </span>
                    <div className="favorites-card-info">
                      <span className="favorites-card-name">{building.name}</span>
                      <span className="favorites-card-meta">
                        {BUILDING_TYPE_LABELS[building.type] ?? building.type} · {building.city}
                      </span>
                    </div>
                  </div>
                  <div className="favorites-card-actions">
                    <button
                      type="button"
                      className="icon-btn icon-btn-plain"
                      aria-label="הסרה ממועדפים"
                      title="הסרה ממועדפים"
                      onClick={() => toggleBuilding(building.id)}
                    >
                      <StarIcon size={20} filled />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-plain"
                      aria-label="כניסה למבנה"
                      onClick={() => navigate(`/b/${building.id}`)}
                    >
                      <ChevronIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Favorite Places Section */}
        {displayedPlaces.length > 0 && (
          <section className="favorites-section">
            <h2 className="favorites-section-title">
              חנויות ומקומות שמורים ({displayedPlaces.length})
            </h2>
            <div className="favorites-list">
              {displayedPlaces.map((place) => {
                const bName =
                  allBuildings.find((b) => b.id === place.buildingId)?.name || 'מבנה';
                return (
                  <div key={place.id} className="favorites-card">
                    <div
                      className="favorites-card-main"
                      onClick={() => navigate(`/b/${place.buildingId}`)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="favorites-card-info">
                        <span className="favorites-card-name">{place.name}</span>
                        <span className="favorites-card-meta">
                          {place.category} · {bName} · {getDefaultFloorName(place.floor)}
                        </span>
                      </div>
                    </div>
                    <div className="favorites-card-actions">
                      <button
                        type="button"
                        className="icon-btn icon-btn-plain"
                        aria-label="הסרה ממועדפים"
                        title="הסרה ממועדפים"
                        onClick={() => togglePlace(place)}
                      >
                        <StarIcon size={20} filled />
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-primary"
                        onClick={() => navigate(`/b/${place.buildingId}`)}
                      >
                        ניווט
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
      <BottomNavbar activeTab="favorites" />
    </div>
  );
}

export default FavoritesPage;
