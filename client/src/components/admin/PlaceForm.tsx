import type { FormEvent } from 'react';
import type { PlaceType } from '../../types/place';
import type { PlaceFormValues } from './placeFormValues';

const PLACE_TYPES: { value: PlaceType; label: string }[] = [
  { value: 'store', label: 'Store' },
  { value: 'service', label: 'Service' },
  { value: 'shelter', label: 'Shelter' },
];

interface PlaceFormProps {
  values: PlaceFormValues;
  onChange: (values: PlaceFormValues) => void;
  isNew: boolean;
  categories: string[]; // the categories already used in the building, as suggestions
  isSaving: boolean;
  error: string | null;
  onSubmit: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function PlaceForm({ values, onChange, isNew, categories, isSaving, error, onSubmit, onCancel, onDelete }: PlaceFormProps) {
  // One helper for all the fields: copy the values and change one of them
  function setField<K extends keyof PlaceFormValues>(field: K, value: PlaceFormValues[K]) {
    onChange({ ...values, [field]: value });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  const hasPoint = values.x !== null && values.y !== null;

  return (
    <form className="admin-card" onSubmit={handleSubmit}>
      <h2 className="admin-card-title">{isNew ? 'New place' : 'Edit place'}</h2>
      <p className="admin-card-text">
        {hasPoint ? 'Click on the map to move it.' : 'Click on the map where the place is.'}
      </p>

      <label className="field-label" htmlFor="place-name">
        Name
      </label>
      <input
        id="place-name"
        className="field-input"
        required
        maxLength={60}
        value={values.name}
        onChange={(event) => setField('name', event.target.value)}
      />

      <span className="field-label">Type</span>
      <div className="segmented" role="group" aria-label="Place type">
        {PLACE_TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={values.type === option.value}
            onClick={() => setField('type', option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor="place-category">
        Category
      </label>
      <input
        id="place-category"
        className="field-input"
        required
        maxLength={40}
        list="place-categories"
        placeholder="Food, Fashion, Health..."
        value={values.category}
        onChange={(event) => setField('category', event.target.value)}
      />
      <datalist id="place-categories">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      <label className="field-label" htmlFor="place-hours">
        Opening hours (optional)
      </label>
      <input
        id="place-hours"
        className="field-input"
        maxLength={80}
        placeholder="Sun-Thu 10:00-22:00"
        value={values.hours}
        onChange={(event) => setField('hours', event.target.value)}
      />

      <label className="field-label" htmlFor="place-url">
        Website (optional)
      </label>
      <input
        id="place-url"
        className="field-input"
        type="url"
        placeholder="https://"
        value={values.url}
        onChange={(event) => setField('url', event.target.value)}
      />

      <label className="field-check">
        <input
          type="checkbox"
          checked={values.isLandmark}
          onChange={(event) => setField('isLandmark', event.target.checked)}
        />
        Landmark
      </label>
      <p className="field-hint">
        Visitors pick a landmark to say where they are, for example during a red alert. Up to 5 on a floor.
      </p>

      {error && <p className="message-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSaving || !hasPoint}>
          {isSaving ? 'Saving...' : isNew ? 'Add place' : 'Save'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
        {!isNew && (
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={isSaving}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

export default PlaceForm;
