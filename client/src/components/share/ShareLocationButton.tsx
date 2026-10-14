import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import type { StartPoint } from '../../types/navigation';
import { ShareIcon } from '../ui/Icons';
import './ShareLocationButton.css';

interface ShareLocationButtonProps {
  buildingId: string;
  start: StartPoint | null;
  floorName: string;
  onNeedLocation: () => void; // opens "I'm near..." when we don't know where the user is
}

// "Navigate to me": shares a link that opens the building with the user's spot as the target
function ShareLocationButton({ buildingId, start, floorName, onNeedLocation }: ShareLocationButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEscapeKey(() => setIsConfirmOpen(false), isConfirmOpen);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  function handleButtonClick() {
    if (!start) {
      onNeedLocation();
      return;
    }
    // First the user confirms where they are standing
    setIsConfirmOpen(true);
  }

  function handleChangeLocation() {
    setIsConfirmOpen(false);
    onNeedLocation();
  }

  // Must run from a click: navigator.share and clipboard need a user action and https / localhost
  async function handleShare() {
    if (!start) return;

    const link = `${window.location.origin}/b/${buildingId}?target=${start.nodeId}`;
    setIsConfirmOpen(false);

    // Phones: the system share menu. Computers without it: copy the link.
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'נווטו אליי', text: `אני ליד ${start.label}`, url: link });
      } catch {
        // The user closed the share menu - nothing to do
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      showToast('הקישור הועתק');
    } catch {
      showToast('לא הצלחנו להעתיק את הקישור');
    }
  }

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label="נווטו אליי: שיתוף המיקום שלי"
        onClick={handleButtonClick}
      >
        <ShareIcon />
      </button>

      {/* In document.body: the button sits in the header, and anything drawn inside the header
          stays under the floating parts of the screen (the bottom dock), whatever its z-index */}
      {isConfirmOpen && start && createPortal(
        <div className="overlay" onClick={() => setIsConfirmOpen(false)}>
          <div
            className="dialog"
            role="dialog"
            aria-label="שיתוף המיקום שלי"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="sheet-title">לשתף את המיקום שלכם?</h2>
            <p className="sheet-text">מי שיקבל את הקישור ינווט ישר אליכם.</p>

            <div className="share-spot">
              <span className="share-spot-label">אתם ליד</span>
              <span className="share-spot-name">
                {start.label} · {floorName}
              </span>
            </div>

            <div className="sheet-actions">
              <button type="button" className="btn btn-primary" onClick={handleShare}>
                שיתוף הקישור
              </button>
              <button type="button" className="btn btn-outline" onClick={handleChangeLocation}>
                אני לא כאן
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {toast && createPortal(
        <div className="share-toast" role="status">
          {toast}
        </div>,
        document.body,
      )}
    </>
  );
}

export default ShareLocationButton;
