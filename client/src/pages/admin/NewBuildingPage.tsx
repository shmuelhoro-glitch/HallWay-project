import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createBuilding, findAddressOnMap } from '../../api/admin';
import type { MapPoint } from '../../api/admin';
import { ApiError } from '../../api/client';
import { BUILDING_TYPE_LABELS } from '../../types/building';
import type { BuildingType } from '../../types/building';
import { getErrorMessage } from '../../utils/errorMessage';
import LocationPickerMap from '../../components/admin/LocationPickerMap';
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

  // The spot on the map. The admin can look the address up, see the pin, and move it.
  // Without a pin the server looks the address up by itself when the building is saved.
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapMessage, setMapMessage] = useState<string | null>(null);

  // The pin belongs to the address it was found for: a new address starts over
  function changeAddress(newAddress: string, newCity: string) {
    setAddress(newAddress);
    setCity(newCity);
    setPoint(null);
    setIsMapOpen(false);
    setMapMessage(null);
  }

  // The address is not on the map: the admin puts the pin there by hand, and the building can still be saved
  function askForManualPin() {
    setPoint(null);
    setIsMapOpen(true);
    setMapMessage('לא מצאנו את הכתובת במפה. לחצו במפה על המיקום של המבנה.');
  }

  async function handleLocate() {
    setIsLocating(true);
    setMapMessage(null);

    try {
      setPoint(await findAddressOnMap(address.trim(), city.trim()));
      setIsMapOpen(true);
      setMapMessage('זה המיקום שמצאנו. אם הסיכה לא במקום, גררו אותה או לחצו במפה.');
    } catch (locateError) {
      if (locateError instanceof ApiError && locateError.code === 'ADDRESS_NOT_FOUND') {
        askForManualPin();
      } else {
        setMapMessage(getErrorMessage(locateError, 'לא הצלחנו לאתר את הכתובת כרגע. נסו שוב.'));
      }
    } finally {
      setIsLocating(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const building = await createBuilding({
        name,
        type,
        address,
        city,
        alert_area: alertArea,
        floors_count: Number(floorsCount),
        ...(point ?? {}), // the pin, when there is one
      });
      navigate(`/admin/${building.id}/floors`);
    } catch (saveError) {
      // Nothing that was typed is lost. An address the server can't find opens the map for a pin by hand.
      if (saveError instanceof ApiError && saveError.code === 'ADDRESS_NOT_FOUND') {
        askForManualPin();
      }
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
                onChange={(event) => changeAddress(event.target.value, city)}
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
                onChange={(event) => changeAddress(address, event.target.value)}
              />
            </div>

            <div className="form-wide">
              <div className="locate-row">
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={isLocating || address.trim().length < 2 || city.trim().length < 2}
                  onClick={handleLocate}
                >
                  {isLocating ? 'מאתר...' : 'איתור הכתובת במפה'}
                </button>
                <span className="field-hint locate-hint">
                  {point ? 'המיקום שבמפה הוא זה שיישמר.' : 'לא חובה: בלי איתור, המיקום נקבע לפי הכתובת בזמן השמירה.'}
                </span>
              </div>

              {mapMessage && <p className="message-info">{mapMessage}</p>}
              {isMapOpen && <LocationPickerMap point={point} onChange={setPoint} />}

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

          {error && <p className="message-error" role="alert">{error}</p>}

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
