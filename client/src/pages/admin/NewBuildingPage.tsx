import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createBuilding } from '../../api/admin';
import { BUILDING_TYPE_LABELS } from '../../types/building';
import type { BuildingType } from '../../types/building';
import { getErrorMessage } from '../../utils/errorMessage';
import { BackIcon } from '../../components/ui/Icons';
import './Admin.css';

const BUILDING_TYPES: BuildingType[] = ['mall', 'hospital', 'campus', 'office', 'other'];

// /admin/new - step 1 of a new building: its details.
// Step 2 (floor plans) is the Floors tab, we go there right after saving.
function NewBuildingPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [type, setType] = useState<BuildingType>('mall');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [alertArea, setAlertArea] = useState('');
  const [floorsCount, setFloorsCount] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      // The server finds the map location (lat, lng) from the address by itself
      const building = await createBuilding({
        name,
        type,
        address,
        city,
        alert_area: alertArea,
        floors_count: Number(floorsCount),
      });
      navigate(`/admin/${building.id}/floors`);
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'לא הצלחנו לשמור את המבנה. נסו שוב.'));
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-screen">
      <header className="admin-topbar">
        <Link to="/admin" className="icon-btn" aria-label="חזרה למבנים">
          <BackIcon />
        </Link>
        <div className="admin-topbar-titles">
          <h1 className="admin-title">מבנה חדש</h1>
          <p className="admin-subtitle">שלב 1 מתוך 2: פרטי המבנה. אחר כך: תוכניות הקומות.</p>
        </div>
      </header>

      <div className="admin-content">
        <form className="admin-card new-building-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-wide">
              <label className="field-label" htmlFor="building-name">
                שם המבנה
              </label>
              <input
                id="building-name"
                className="field-input"
                required
                minLength={2}
                placeholder="קניון הים"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="building-type">
                סוג המבנה
              </label>
              <select
                id="building-type"
                className="field-input"
                value={type}
                onChange={(event) => setType(event.target.value as BuildingType)}
              >
                {BUILDING_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {BUILDING_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="building-floors">
                מספר הקומות
              </label>
              <input
                id="building-floors"
                className="field-input"
                type="number"
                required
                min={1}
                max={200}
                value={floorsCount}
                onChange={(event) => setFloorsCount(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="building-address">
                רחוב ומספר
              </label>
              <input
                id="building-address"
                className="field-input"
                required
                minLength={2}
                placeholder="הרברט סמואל 1"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="building-city">
                עיר
              </label>
              <input
                id="building-city"
                className="field-input"
                required
                minLength={2}
                placeholder="תל אביב"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>

            <div className="form-wide">
              <p className="field-hint">את המיקום במפה אנחנו מוצאים לפי הכתובת והעיר.</p>

              <label className="field-label" htmlFor="building-alert-area">
                אזור התרעה
              </label>
              <input
                id="building-alert-area"
                className="field-input"
                dir="auto"
                required
                placeholder="תל אביב - מרכז העיר"
                value={alertArea}
                onChange={(event) => setAlertArea(event.target.value)}
              />
              <p className="field-hint">
                שם האזור בדיוק כפי שפיקוד העורף כותב אותו. התרעת צבע אדום באזור הזה תפתח למבקרים את מסך המרחב המוגן.
              </p>
            </div>
          </div>

          {error && <p className="message-error">{error}</p>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'שומר...' : 'שמירה והמשך לקומות'}
            </button>
            <Link to="/admin" className="btn btn-outline">
              ביטול
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewBuildingPage;
