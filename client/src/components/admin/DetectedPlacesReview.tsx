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
  { value: 'store', label: 'Store' },
  { value: 'service', label: 'Service' },
  { value: 'shelter', label: 'Shelter' },
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
        Found on {floorName}: {rows.length}
      </h2>
      <p className="admin-card-text">
        Each place gets its point in the middle of its shape (the numbers on the map). You can move a point later, for
        example to a far door. Nothing is saved until you press Add.
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
                aria-label={`Name of place ${row.key}`}
                maxLength={60}
                disabled={isSaving || !row.include}
                value={row.name}
                onChange={(event) => updateRow(row.key, { name: event.target.value })}
              />
              <div className="review-second-line">
                <input
                  className="field-input review-input"
                  aria-label={`Category of place ${row.key}`}
                  maxLength={40}
                  disabled={isSaving || !row.include}
                  value={row.category}
                  onChange={(event) => updateRow(row.key, { category: event.target.value })}
                />
                <select
                  className="field-input review-input review-type"
                  aria-label={`Type of place ${row.key}`}
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
              {row.alreadyAdded && <p className="review-note">Already in Places</p>}
              {!row.alreadyAdded && !row.isSuggested && (
                <p className="review-note">Usually not a destination (elevator, stairs, entrance...)</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasEmptyField && <p className="message-error">Every place you add needs a name and a category.</p>}
      {error && <p className="message-error review-errors">{error}</p>}
      {progress && <p className="message-info">{progress}</p>}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={isSaving || chosen.length === 0 || hasEmptyField}
          onClick={onAdd}
        >
          {isSaving ? 'Adding...' : `Add ${chosen.length} ${chosen.length === 1 ? 'place' : 'places'}`}
        </button>
        <button type="button" className="btn btn-outline" disabled={isSaving} onClick={onCancel}>
          Skip
        </button>
      </div>
    </section>
  );
}

export default DetectedPlacesReview;
