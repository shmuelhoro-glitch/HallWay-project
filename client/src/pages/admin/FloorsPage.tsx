import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { uploadFloor } from '../../api/admin';
import { getPlanUrl } from '../../api/buildings';
import type { Floor } from '../../types/building';
import { getErrorMessage } from '../../utils/errorMessage';
import { FloorFileError, floorFileToSvg } from '../../utils/floorFile';
import { useAdminBuilding } from './adminContext';
import FloorMap from '../../components/map/FloorMap';
import { UploadIcon } from '../../components/ui/Icons';

// The "Floors" tab: upload a plan for each floor, see it, replace it.
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

  const shownFloor = floors.find((floor) => floor.floor === previewFloor) ?? floors[0] ?? null;

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Choose a file first.');
      return;
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
      setSuccess(`Floor ${number} was saved.`);

      // Ready for the next floor
      setFloorNumber(String(number + 1));
      setFloorName('');
      setFile(null);
      setFileInputKey((current) => current + 1);
    } catch (uploadError) {
      if (uploadError instanceof FloorFileError) {
        setError(uploadError.message);
      } else {
        setError(getErrorMessage(uploadError, 'Could not upload the plan. Please try again.'));
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
          />
        ) : (
          <div className="screen-message">The plan you upload will show here.</div>
        )}
      </div>

      <div className="admin-panel">
        <section className="admin-card">
          <h2 className="admin-card-title">Floor plans</h2>
          <p className="admin-card-text">
            {floors.length} of {building.floors_count} uploaded.
          </p>

          {floors.map((floor) => (
            <div key={floor.floor} className="admin-row">
              <div className="admin-row-main">
                <div className="admin-row-name">
                  Floor {floor.floor}
                  {floor.name ? ` · ${floor.name}` : ''}
                </div>
                <div className="admin-row-meta">
                  {floor.width} × {floor.height}
                  {shownFloor && shownFloor.floor === floor.floor ? ' · showing' : ''}
                </div>
              </div>
              <button type="button" className="text-btn" onClick={() => setPreviewFloor(floor.floor)}>
                Show
              </button>
              <button type="button" className="text-btn" onClick={() => startReplace(floor)}>
                Replace
              </button>
            </div>
          ))}

          {floors.length > 0 && (
            <Link to="../places" className="btn btn-primary floors-next">
              Next: add places
            </Link>
          )}
        </section>

        <form className="admin-card" onSubmit={handleUpload}>
          <h2 className="admin-card-title">Upload a plan</h2>
          <p className="admin-card-text">SVG, PNG or JPG. The same floor number again replaces its plan.</p>

          <div className="form-grid">
            <div>
              <label className="field-label" htmlFor="floor-number">
                Floor number
              </label>
              <input
                id="floor-number"
                className="field-input"
                type="number"
                required
                step={1}
                value={floorNumber}
                onChange={(event) => setFloorNumber(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="floor-name">
                Name (optional)
              </label>
              <input
                id="floor-name"
                className="field-input"
                maxLength={50}
                placeholder="Ground floor"
                value={floorName}
                onChange={(event) => setFloorName(event.target.value)}
              />
            </div>
            <p className="field-hint form-wide">0 is the ground floor. Basements are -1, -2.</p>

            <div className="form-wide">
              <label className="field-label" htmlFor="floor-file">
                Plan file
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
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FloorsPage;
