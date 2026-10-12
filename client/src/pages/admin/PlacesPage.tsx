import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPlace, deletePlace, updatePlace } from '../../api/admin';
import type { PlaceInput } from '../../api/admin';
import { getPlanUrl } from '../../api/buildings';
import { getPlaces } from '../../api/places';
import type { Place } from '../../types/place';
import type { SvgPoint } from '../../utils/svgCoords';
import { getErrorMessage } from '../../utils/errorMessage';
import { getFloorName } from '../../utils/floors';
import { useAdminBuilding } from './adminContext';
import FloorMap from '../../components/map/FloorMap';
import FloorSwitcher from '../../components/map/FloorSwitcher';
import PlacesLayer from '../../components/map/PlacesLayer';
import DraftPointLayer from '../../components/admin/DraftPointLayer';
import PlaceForm from '../../components/admin/PlaceForm';
import { EMPTY_PLACE_FORM } from '../../components/admin/placeFormValues';
import type { PlaceFormValues } from '../../components/admin/placeFormValues';
import { ChevronIcon, PlusIcon } from '../../components/ui/Icons';

const PLACE_TYPE_LABELS = { store: 'חנות', service: 'שירות', shelter: 'מרחב מוגן' };

// Only the fields that really changed. Important: a place whose entrance was moved
// in the walkways editor keeps it there, as long as the admin didn't move the place itself.
function getChanges(original: Place, input: PlaceInput): Partial<PlaceInput> {
  const changes: Partial<PlaceInput> = {};
  if (input.name !== original.name) changes.name = input.name;
  if (input.type !== original.type) changes.type = input.type;
  if (input.category !== original.category) changes.category = input.category;
  if (input.hours !== (original.hours ?? '')) changes.hours = input.hours;
  if (input.url !== (original.url ?? '')) changes.url = input.url;
  if (input.isLandmark !== original.isLandmark) changes.isLandmark = input.isLandmark;
  if (input.x !== original.x) changes.x = input.x;
  if (input.y !== original.y) changes.y = input.y;
  return changes;
}

// The "Places" tab: the places of each floor, on the map and in a list
function PlacesPage() {
  const { building } = useAdminBuilding();
  const floors = building.floors;

  const [floor, setFloor] = useState(floors.length > 0 ? floors[0].floor : 0);
  const [places, setPlaces] = useState<Place[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The form: null = closed. editingId null = a new place.
  const [form, setForm] = useState<PlaceFormValues | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // The places of the floor on screen
  useEffect(() => {
    let isCancelled = false;

    getPlaces(building.id, { floor })
      .then((data) => {
        if (isCancelled) return;
        setPlaces(data);
        setLoadError(null);
      })
      .catch(() => {
        if (isCancelled) return;
        setLoadError('לא הצלחנו לטעון את המקומות.');
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [building.id, floor]);

  // The categories of the whole building, as suggestions in the form
  useEffect(() => {
    getPlaces(building.id)
      .then((allPlaces) => {
        const unique = new Set(allPlaces.map((place) => place.category));
        setCategories([...unique].sort());
      })
      .catch(() => setCategories([]));
  }, [building.id]);

  if (floors.length === 0) {
    return (
      <div className="admin-empty">
        <p>קודם צריך להעלות תוכנית קומה. את המקומות מוסיפים על גבי התוכנית.</p>
        <Link to="../floors" className="btn btn-primary">
          מעבר לקומות
        </Link>
      </div>
    );
  }

  const currentFloor = floors.find((item) => item.floor === floor) ?? floors[0];

  function closeForm() {
    setForm(null);
    setEditingId(null);
    setFormError(null);
  }

  function changeFloor(newFloor: number) {
    setFloor(newFloor);
    setIsLoading(true);
    closeForm();
  }

  function startNew() {
    setEditingId(null);
    setForm(EMPTY_PLACE_FORM);
    setFormError(null);
  }

  function startEdit(place: Place) {
    setEditingId(place._id);
    setForm({
      name: place.name,
      type: place.type,
      category: place.category,
      hours: place.hours ?? '',
      url: place.url ?? '',
      isLandmark: place.isLandmark,
      x: place.x,
      y: place.y,
    });
    setFormError(null);
  }

  // While the form is open, a click on the map puts the place there
  function handleMapClick(point: SvgPoint) {
    if (!form) return;
    setForm({ ...form, x: Math.round(point.x), y: Math.round(point.y) });
  }

  // A click on a place opens it. While a form is open we ignore it, so typing is not lost.
  function handlePlaceClick(place: Place) {
    if (form) return;
    startEdit(place);
  }

  async function handleSave() {
    if (!form || form.x === null || form.y === null) return;

    const input: PlaceInput = {
      floor,
      name: form.name.trim(),
      type: form.type,
      category: form.category.trim(),
      x: form.x,
      y: form.y,
      hours: form.hours.trim(),
      url: form.url.trim(),
      isLandmark: form.isLandmark,
    };

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingId === null) {
        const created = await createPlace(building.id, input);
        setPlaces([...places, created]);
      } else {
        const original = places.find((place) => place._id === editingId);
        if (!original) return;

        const changes = getChanges(original, input);
        if (Object.keys(changes).length > 0) {
          const updated = await updatePlace(building.id, editingId, changes);
          setPlaces(places.map((place) => (place._id === editingId ? updated : place)));
        }
      }

      if (!categories.includes(input.category)) {
        setCategories([...categories, input.category].sort());
      }
      closeForm();
    } catch (saveError) {
      setFormError(getErrorMessage(saveError, 'לא הצלחנו לשמור את המקום. נסו שוב.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    const place = places.find((item) => item._id === editingId);
    if (!place) return;

    const isSure = window.confirm(`למחוק את "${place.name}"? גם החיבורים שלו למעברים יימחקו.`);
    if (!isSure) return;

    setIsSaving(true);
    try {
      await deletePlace(building.id, place._id);
      setPlaces(places.filter((item) => item._id !== place._id));
      closeForm();
    } catch (deleteError) {
      setFormError(getErrorMessage(deleteError, 'לא הצלחנו למחוק את המקום. נסו שוב.'));
    } finally {
      setIsSaving(false);
    }
  }

  const sortedPlaces = [...places].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="admin-split">
      <div className="admin-map">
        <FloorMap
          key={currentFloor.floor}
          planUrl={getPlanUrl(building.id, currentFloor.floor)}
          width={currentFloor.width}
          height={currentFloor.height}
          onMapClick={handleMapClick}
        >
          <PlacesLayer
            places={places}
            selectedPlaceId={editingId}
            highlightShelters={false}
            onSelect={handlePlaceClick}
            showAllLabels
          />
          {form && form.x !== null && form.y !== null && <DraftPointLayer x={form.x} y={form.y} />}
        </FloorMap>

        {form && <div className="admin-map-hint">לחצו במפה על המיקום של המקום</div>}
        <FloorSwitcher floors={floors} currentFloor={currentFloor.floor} onChange={changeFloor} />
      </div>

      <div className="admin-panel">
        {form ? (
          <PlaceForm
            values={form}
            onChange={setForm}
            isNew={editingId === null}
            categories={categories}
            isSaving={isSaving}
            error={formError}
            onSubmit={handleSave}
            onCancel={closeForm}
            onDelete={handleDelete}
          />
        ) : (
          <section className="admin-card">
            <div className="sheet-header">
              <div>
                <h2 className="admin-card-title">{getFloorName(floors, currentFloor.floor)}</h2>
                <p className="admin-card-text">
                  {places.length === 1 ? 'מקום אחד' : `${places.length} מקומות`}. לחצו על מקום כדי לערוך אותו.
                </p>
              </div>
            </div>

            <button type="button" className="btn btn-primary places-add" onClick={startNew}>
              <PlusIcon />
              הוספת מקום
            </button>

            {isLoading && <p className="message-info">טוען...</p>}
            {loadError && <p className="message-error">{loadError}</p>}

            {sortedPlaces.map((place) => (
              <button key={place._id} type="button" className="admin-row places-row" onClick={() => startEdit(place)}>
                <span className="admin-row-main">
                  <span className="admin-row-name">{place.name}</span>
                  <span className="admin-row-meta">
                    {PLACE_TYPE_LABELS[place.type]} · {place.category}
                    {place.isLandmark ? ' · נקודת ציון' : ''}
                  </span>
                </span>
                <ChevronIcon />
              </button>
            ))}

            {places.length > 0 && (
              <p className="field-hint">
                השלב הבא: לחבר את הכניסה של כל מקום למעבר, בלשונית "מעברים". בלי החיבור הזה מבקרים לא יוכלו לנווט
                אליו.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default PlacesPage;
