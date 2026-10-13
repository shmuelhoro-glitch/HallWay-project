import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteBuilding } from '../../api/admin';
import type { BuildingDetails } from '../../types/building';
import { getErrorMessage } from '../../utils/errorMessage';

interface DeleteBuildingCardProps {
  building: BuildingDetails;
}

// Deleting a whole building. It can't be undone, so the manager first has to ask for it,
// and then to type the name of the building.
function DeleteBuildingCard({ building }: DeleteBuildingCardProps) {
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNameRight = typedName.trim() === building.name.trim();

  function close() {
    setIsOpen(false);
    setTypedName('');
    setError(null);
  }

  async function handleDelete(event: FormEvent) {
    event.preventDefault();
    if (!isNameRight || isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteBuilding(building.id);
      navigate('/admin', { replace: true });
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'לא הצלחנו למחוק את המבנה. נסו שוב.'));
      setIsDeleting(false);
    }
  }

  return (
    <section className="admin-card">
      <h2 className="admin-card-title">מחיקת המבנה</h2>
      <p className="admin-card-text">
        המבנה יימחק עם כל מה שיש בו: תוכניות הקומה, המקומות, המעברים והצ'אט. קודי QR שכבר הודפסו יפסיקו לעבוד. אי
        אפשר לבטל את המחיקה.
      </p>

      {!isOpen ? (
        <div className="form-actions">
          <button type="button" className="btn btn-danger" onClick={() => setIsOpen(true)}>
            מחיקת המבנה
          </button>
        </div>
      ) : (
        <form onSubmit={handleDelete}>
          <label className="field-label" htmlFor="delete-building-name">
            כדי לאשר, הקלידו את שם המבנה: <strong dir="auto">{building.name}</strong>
          </label>
          <input
            id="delete-building-name"
            className="field-input"
            dir="auto"
            autoComplete="off"
            autoFocus
            value={typedName}
            disabled={isDeleting}
            onChange={(event) => setTypedName(event.target.value)}
          />

          {error && <p className="message-error" role="alert">{error}</p>}

          <div className="form-actions">
            <button type="submit" className="btn btn-danger" disabled={!isNameRight || isDeleting}>
              {isDeleting ? 'מוחק...' : 'מחיקה לצמיתות'}
            </button>
            <button type="button" className="btn btn-outline" disabled={isDeleting} onClick={close}>
              ביטול
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default DeleteBuildingCard;
