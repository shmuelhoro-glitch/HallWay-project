import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createPlace, uploadFloor } from '../../api/admin';
import { getPlanUrl } from '../../api/buildings';
import { getPlaces } from '../../api/places';
import type { Floor } from '../../types/building';
import { getErrorMessage } from '../../utils/errorMessage';
import { FloorFileError, floorFileToSvg } from '../../utils/floorFile';
import { getDefaultFloorName } from '../../utils/floors';
import { detectPlacesInPlan } from '../../utils/placeDetection';
import type { ReviewRow } from '../../utils/placeDetection';
import { useAdminBuilding } from './adminContext';
import FloorMap from '../../components/map/FloorMap';
import DetectedPointsLayer from '../../components/admin/DetectedPointsLayer';
import DetectedPlacesReview from '../../components/admin/DetectedPlacesReview';
import { UploadIcon } from '../../components/ui/Icons';

// The places found in one floor plan, waiting for the admin's approval
interface PlacesReview {
  floor: number;
  floorName: string;
  rows: ReviewRow[];
}

function floorLabel(floorNumber: number, name: string): string {
  return name ? name : getDefaultFloorName(floorNumber);
}

// The "Floors" tab: upload a plan for each floor, see it, replace it.
// After an upload, the stores written in the plan are found and offered as places.
function FloorsPage() {
  const { building, reloadBuilding } = useAdminBuilding();
  const floors = building.floors; // already sorted from the lowest floor up

  const nextFloorNumber = floors.length === 0 ? 0 : Math.max(...floors.map((floor) => floor.floor)) + 1;

  const [previewFloor, setPreviewFloor] = useState<number | null>(floors.length > 0 ? floors[0].floor : null);
  const [planVersion, setPlanVersion] = useState(0); // changes after an upload, so the new plan is loaded

  const [floorNumber, setFloorNumber] = useState(String(nextFloorNumber));
  const [floorName, setFloorName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0); // a new key = an empty file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Finding the stores in a plan, and adding them
  const [review, setReview] = useState<PlacesReview | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isAddingPlaces, setIsAddingPlaces] = useState(false);
  const [addProgress, setAddProgress] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const shownFloor = floors.find((floor) => floor.floor === previewFloor) ?? floors[0] ?? null;

  // Finds the stores written in the plan and opens the review list.
  // svgText: the plan we just uploaded. Without it, the saved plan is downloaded from the server.
  async function findPlaces(floorNumber: number, name: string, svgText?: string) {
    setNotice(null);
    setAddError(null);
    setIsDetecting(true);

    try {
      const text = svgText ?? (await (await fetch(getPlanUrl(building.id, floorNumber))).text());
      const detected = detectPlacesInPlan(text);

      if (detected.length === 0) {
        setReview(null);
        setNotice(
          `לא נמצאו שמות של חנויות בתוכנית של ${floorLabel(floorNumber, name)}. אפשר להוסיף מקומות ידנית בלשונית "מקומות".`,
        );
        return;
      }

      // A name that is already on this floor is left out, so nothing is added twice
      const existing = await getPlaces(building.id, { floor: floorNumber });
      const existingNames = new Set(existing.map((place) => place.name.trim().toLowerCase()));

      const rows: ReviewRow[] = detected.map((place) => {
        const alreadyAdded = existingNames.has(place.name.trim().toLowerCase());
        return { ...place, alreadyAdded, include: place.isSuggested && !alreadyAdded };
      });

      setReview({ floor: floorNumber, floorName: floorLabel(floorNumber, name), rows });
      setPreviewFloor(floorNumber);
    } catch {
      setNotice('לא הצלחנו לקרוא את התוכנית. נסו שוב.');
    } finally {
      setIsDetecting(false);
    }
  }

  // Adds the places the admin left checked, one by one, and reports each failure by name
  async function addReviewedPlaces() {
    if (!review) return;
    const chosen = review.rows.filter((row) => row.include);

    setIsAddingPlaces(true);
    setAddError(null);

    const addedKeys: number[] = [];
    const failures: string[] = [];

    for (let index = 0; index < chosen.length; index++) {
      const row = chosen[index];
      setAddProgress(`מוסיף ${index + 1} מתוך ${chosen.length}...`);

      try {
        await createPlace(building.id, {
          floor: review.floor,
          name: row.name.trim(),
          type: row.type,
          category: row.category.trim(),
          x: row.x,
          y: row.y,
          hours: '',
          url: '',
          isLandmark: false,
        });
        addedKeys.push(row.key);
      } catch (placeError) {
        failures.push(`${row.name}: ${getErrorMessage(placeError)}`);
      }
    }

    setIsAddingPlaces(false);
    setAddProgress(null);

    if (failures.length === 0) {
      setReview(null);
      const added = addedKeys.length === 1 ? 'מקום אחד נוסף' : `${addedKeys.length} מקומות נוספו`;
      setSuccess(`${added} אל ${review.floorName}. השלב הבא: לחבר אותם למעברים.`);
      return;
    }

    // Some failed: the ones that were added are marked, the failed ones stay checked to try again
    setReview({
      ...review,
      rows: review.rows.map((row) =>
        addedKeys.includes(row.key) ? { ...row, include: false, alreadyAdded: true } : row,
      ),
    });
    setAddError(`לא נוספו: ${failures.join(' · ')}`);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('בחרו קובץ קודם.');
      return;
    }

    // Replacing a plan can't be undone, and the points and places stay where they were on the old one
    const existing = floors.find((floor) => floor.floor === Number(floorNumber));
    if (existing) {
      const isSure = window.confirm(
        `ל${floorLabel(existing.floor, existing.name)} כבר יש תוכנית. להחליף אותה?\n\nהנקודות, המעברים והמקומות נשארים במקומם, אז כדאי שהתוכנית החדשה תהיה באותו גודל.`,
      );
      if (!isSure) return;
    }

    setError(null);
    setSuccess(null);
    setIsUploading(true);

    try {
      const svg = await floorFileToSvg(file);
      const number = Number(floorNumber);
      await uploadFloor(building.id, number, floorName.trim(), svg);

      reloadBuilding(); // the floors list in the title and here
      setPreviewFloor(number);
      setPlanVersion((current) => current + 1);
      setSuccess(`התוכנית של ${floorLabel(number, floorName.trim())} נשמרה.`);

      // Ready for the next floor
      const uploadedName = floorName.trim();
      setFloorNumber(String(number + 1));
      setFloorName('');
      setFile(null);
      setFileInputKey((current) => current + 1);

      // The stores written in this plan, for the admin to approve
      await findPlaces(number, uploadedName, svg);
    } catch (uploadError) {
      if (uploadError instanceof FloorFileError) {
        setError(uploadError.message);
      } else {
        setError(getErrorMessage(uploadError, 'לא הצלחנו להעלות את התוכנית. נסו שוב.'));
      }
    } finally {
      setIsUploading(false);
    }
  }

  // "Replace": the same floor number again overwrites the plan
  function startReplace(floor: Floor) {
    setFloorNumber(String(floor.floor));
    setFloorName(floor.name);
    setSuccess(null);
    setError(null);
    fileInputRef.current?.focus();
  }

  return (
    <div className="admin-split">
      <div className="admin-map">
        {shownFloor ? (
          <FloorMap
            key={`${shownFloor.floor}-${planVersion}`}
            planUrl={`${getPlanUrl(building.id, shownFloor.floor)}?v=${planVersion}`}
            width={shownFloor.width}
            height={shownFloor.height}
          >
            {/* The numbered points only on the floor they were found on */}
            {review && review.floor === shownFloor.floor && <DetectedPointsLayer rows={review.rows} />}
          </FloorMap>
        ) : (
          <div className="screen-message">התוכנית שתעלו תוצג כאן.</div>
        )}
      </div>

      <div className="admin-panel">
        {review && (
          <DetectedPlacesReview
            floorName={review.floorName}
            rows={review.rows}
            onRowsChange={(rows) => setReview({ ...review, rows })}
            isSaving={isAddingPlaces}
            progress={addProgress}
            error={addError}
            onAdd={addReviewedPlaces}
            onCancel={() => setReview(null)}
          />
        )}

        <section className="admin-card">
          <h2 className="admin-card-title">תוכניות קומה</h2>
          <p className="admin-card-text">
            הועלו {floors.length} מתוך {building.floors_count}.
          </p>

          {floors.map((floor) => (
            <div key={floor.floor} className="admin-row">
              <div className="admin-row-main">
                <div className="admin-row-name">
                  {getDefaultFloorName(floor.floor)}
                  {floor.name ? ` · ${floor.name}` : ''}
                </div>
                <div className="admin-row-meta">
                  {/* dir="ltr": the size is width × height, and must not be turned around in Hebrew text */}
                  <span dir="ltr">
                    {floor.width} × {floor.height}
                  </span>
                  {shownFloor && shownFloor.floor === floor.floor ? ' · מוצגת' : ''}
                </div>
              </div>
              <button type="button" className="text-btn" onClick={() => setPreviewFloor(floor.floor)}>
                הצגה
              </button>
              <button type="button" className="text-btn" onClick={() => startReplace(floor)}>
                החלפה
              </button>
              <button
                type="button"
                className="text-btn"
                disabled={isDetecting || isAddingPlaces}
                onClick={() => findPlaces(floor.floor, floor.name)}
              >
                איתור מקומות
              </button>
            </div>
          ))}

          {isDetecting && <p className="message-info">מחפש שמות של חנויות בתוכנית...</p>}
          {notice && <p className="message-info">{notice}</p>}

          {floors.length > 0 && (
            <Link to="../places" className="btn btn-primary floors-next">
              השלב הבא: הוספת מקומות
            </Link>
          )}
        </section>

        <form className="admin-card" onSubmit={handleUpload}>
          <h2 className="admin-card-title">העלאת תוכנית</h2>
          <p className="admin-card-text">SVG, PNG או JPG. העלאה לאותו מספר קומה מחליפה את התוכנית הקיימת.</p>

          <div className="form-grid">
            <div>
              <label className="field-label" htmlFor="floor-number">
                מספר הקומה
              </label>
              <input
                id="floor-number"
                className="field-input ltr-text"
                type="number"
                required
                step={1}
                value={floorNumber}
                onChange={(event) => setFloorNumber(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="floor-name">
                שם (לא חובה)
              </label>
              <input
                id="floor-name"
                className="field-input"
                maxLength={50}
                placeholder="קומת קרקע"
                value={floorName}
                onChange={(event) => setFloorName(event.target.value)}
              />
            </div>
            <p className="field-hint form-wide">קומת הקרקע היא 0. למרתף מזינים מספר שלילי.</p>

            <div className="form-wide">
              <label className="field-label" htmlFor="floor-file">
                קובץ התוכנית
              </label>
              <input
                key={fileInputKey}
                ref={fileInputRef}
                id="floor-file"
                className="field-input floors-file"
                type="file"
                accept=".svg,image/svg+xml,image/png,image/jpeg"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {error && <p className="message-error">{error}</p>}
          {success && <p className="message-success">{success}</p>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isUploading}>
              <UploadIcon />
              {isUploading ? 'מעלה...' : 'העלאה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FloorsPage;
