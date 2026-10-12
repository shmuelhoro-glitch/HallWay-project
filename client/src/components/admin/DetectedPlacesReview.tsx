import type { PlaceType } from '../../types/place';
import type { ReviewRow } from '../../utils/placeDetection';

interface DetectedPlacesReviewProps {
  floorName: string;
  rows: ReviewRow[];
  onRowsChange: (rows: ReviewRow[]) => void;
  isSaving: boolean;
  progress: string | null; // "Adding 3 of 9..."
  error: string | null;
  onAdd: () => void;
  onCancel: () => void;
}

const PLACE_TYPES: { value: PlaceType; label: string }[] = [
  { value: 'store', label: 'חנות' },
  { value: 'service', label: 'שירות' },
  { value: 'shelter', label: 'מרחב מוגן' },
];

// The list of stores found in the plan. Nothing is saved until the admin presses "Add".
// He can leave a row out, fix a name or a category, and change the type.
function DetectedPlacesReview({
  floorName,
  rows,
  onRowsChange,
  isSaving,
  progress,
  error,
  onAdd,
  onCancel,
}: DetectedPlacesReviewProps) {
  // Changes one field of one row, and keeps the rest as they are
  function updateRow(key: number, changes: Partial<ReviewRow>) {
    onRowsChange(rows.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  const chosen = rows.filter((row) => row.include);
  const hasEmptyField = chosen.some((row) => row.name.trim() === '' || row.category.trim() === '');

  return (
    <section className="admin-card review-card">
      <h2 className="admin-card-title">
        נמצאו {rows.length} מקומות · {floorName}
      </h2>
      <p className="admin-card-text">
        כל מקום מקבל נקודה במרכז הצורה שלו (המספרים שבמפה). אפשר להזיז נקודה אחר כך, למשל אל דלת רחוקה. שום דבר לא
        נשמר עד שלוחצים על "הוספה".
      </p>

      <div className="review-list">
        {rows.map((row) => (
          <div key={row.key} className={row.include ? 'review-row' : 'review-row is-out'}>
            <label className="review-check">
              <input
                type="checkbox"
                checked={row.include}
                disabled={isSaving}
                onChange={(event) => updateRow(row.key, { include: event.target.checked })}
              />
              <span className="review-number">{row.key}</span>
            </label>

            <div className="review-fields">
              <input
                className="field-input review-input"
                aria-label={`השם של מקום ${row.key}`}
                maxLength={60}
                disabled={isSaving || !row.include}
                value={row.name}
                onChange={(event) => updateRow(row.key, { name: event.target.value })}
              />
              <div className="review-second-line">
                <input
                  className="field-input review-input"
                  aria-label={`הקטגוריה של מקום ${row.key}`}
                  maxLength={40}
                  disabled={isSaving || !row.include}
                  value={row.category}
                  onChange={(event) => updateRow(row.key, { category: event.target.value })}
                />
                <select
                  className="field-input review-input review-type"
                  aria-label={`הסוג של מקום ${row.key}`}
                  disabled={isSaving || !row.include}
                  value={row.type}
                  onChange={(event) => updateRow(row.key, { type: event.target.value as PlaceType })}
                >
                  {PLACE_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {row.alreadyAdded && <p className="review-note">כבר נמצא ברשימת המקומות</p>}
              {!row.alreadyAdded && !row.isSuggested && (
                <p className="review-note">בדרך כלל לא יעד לניווט (מעלית, מדרגות, כניסה...)</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasEmptyField && <p className="message-error">לכל מקום שמוסיפים צריך שם וקטגוריה.</p>}
      {error && <p className="message-error review-errors">{error}</p>}
      {progress && <p className="message-info">{progress}</p>}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={isSaving || chosen.length === 0 || hasEmptyField}
          onClick={onAdd}
        >
          {isSaving ? 'מוסיף...' : chosen.length === 1 ? 'הוספת מקום אחד' : `הוספת ${chosen.length} מקומות`}
        </button>
        <button type="button" className="btn btn-outline" disabled={isSaving} onClick={onCancel}>
          דילוג
        </button>
      </div>
    </section>
  );
}

export default DetectedPlacesReview;
