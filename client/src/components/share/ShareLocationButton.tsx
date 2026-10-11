import { useState } from 'react';
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
        await navigator.share({ title: 'Navigate to me', text: `I'm near ${start.label}`, url: link });
      } catch {
        // The user closed the share menu - nothing to do
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      showToast('Link copied');
    } catch {
      showToast('Could not copy the link');
    }
  }

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label="Navigate to me: share my location"
        onClick={handleButtonClick}
      >
        <ShareIcon />
      </button>

      {isConfirmOpen && start && (
        <div className="overlay" onClick={() => setIsConfirmOpen(false)}>
          <div
            className="dialog"
            role="dialog"
            aria-label="Share my location"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="sheet-title">Share where you are?</h2>
            <p className="sheet-text">Your friend gets a link that guides them to you.</p>

            <div className="share-spot">
              <span className="share-spot-label">You are near</span>
              <span className="share-spot-name">
                {start.label} · {floorName}
              </span>
            </div>

            <div className="sheet-actions">
              <button type="button" className="btn btn-primary" onClick={handleShare}>
                Share link
              </button>
              <button type="button" className="btn btn-outline" onClick={handleChangeLocation}>
                Not here
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="share-toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

export default ShareLocationButton;
