import { useAlertStore } from '../../store/alertStore';
import { useCountdown } from '../../hooks/useCountdown';
import type { Floor } from '../../types/building';
import type { Place } from '../../types/place';
import LandmarkPicker from './LandmarkPicker';
import { CheckIcon, SirenIcon } from '../ui/Icons';
import './RedAlertModal.css';

interface RedAlertModalProps {
  buildingName: string;
  floors: Floor[];
  places: Place[];
  currentFloor: number;
  onPickLandmark: (place: Place) => void;
  onScan: () => void;
}

function RedAlertModal({ buildingName, floors, places, currentFloor, onPickLandmark, onScan }: RedAlertModalProps) {
  const status = useAlertStore((state) => state.status);
  const alert = useAlertStore((state) => state.alert);
  const receivedAt = useAlertStore((state) => state.receivedAt);
  const isMinimized = useAlertStore((state) => state.isMinimized);
  const minimize = useAlertStore((state) => state.minimize);
  const clearAlert = useAlertStore((state) => state.clearAlert);

  const secondsLeft = useCountdown(receivedAt, alert ? alert.countdown : 0);

  if (status === 'none' || isMinimized) {
    return null;
  }

  // alert:end arrived
  if (status === 'ended') {
    return (
      <div className="red-alert red-alert-ended" role="alertdialog" aria-label="The event has ended">
        <div className="red-alert-ended-content">
          <div className="red-alert-ended-icon">
            <CheckIcon size={36} />
          </div>
          <h1 className="red-alert-title">The event has ended</h1>
          <p className="red-alert-subtitle">You can leave the protected space.</p>
        </div>
        <button type="button" className="btn red-alert-ok" onClick={clearAlert}>
          OK
        </button>
      </div>
    );
  }

  return (
    <div className="red-alert" role="alertdialog" aria-label="Red alert">
      <div className="red-alert-source">
        <span className="red-alert-source-icon">
          <SirenIcon size={18} />
        </span>
        Home Front Command alert
      </div>

      <div className="red-alert-head">
        <div>
          <h1 className="red-alert-title">Red Alert</h1>
          <p className="red-alert-subtitle">
            {alert?.title} · {buildingName}
          </p>
        </div>
        <div className="red-alert-timer" role="timer" aria-label={`${secondsLeft} seconds to reach a protected space`}>
          <span className="red-alert-seconds">{secondsLeft}</span>
          <span className="red-alert-seconds-label">seconds</span>
        </div>
      </div>

      <div className="red-alert-card">
        <h2 className="red-alert-card-title">Where are you now?</h2>
        <p className="red-alert-card-text">We'll show the route to the nearest protected space.</p>

        <div className="red-alert-picker">
          <LandmarkPicker
            floors={floors}
            places={places}
            initialFloor={currentFloor}
            onPick={onPickLandmark}
            onScan={onScan}
          />
        </div>

        <button type="button" className="text-btn red-alert-skip" onClick={minimize}>
          Just show protected spaces on the map
        </button>
      </div>

      <p className="red-alert-disclaimer">For assistance only. Follow Home Front Command instructions.</p>
    </div>
  );
}

export default RedAlertModal;
