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
  const isSimulation = alert?.isSimulation === true;

  if (status === 'none' || isMinimized) {
    return null;
  }

  // alert:end arrived
  if (status === 'ended') {
    return (
      <div className="red-alert red-alert-ended" role="alertdialog" aria-label="האירוע הסתיים">
        <div className="red-alert-ended-content">
          <div className="red-alert-ended-icon">
            <CheckIcon size={36} />
          </div>
          <h1 className="red-alert-title">האירוע הסתיים</h1>
          <p className="red-alert-subtitle">אפשר לצאת מהמרחב המוגן.</p>
        </div>
        <button type="button" className="btn red-alert-ok" onClick={clearAlert}>
          אישור
        </button>
      </div>
    );
  }

  return (
    <div className="red-alert" role="alertdialog" aria-label={isSimulation ? 'תרגיל צבע אדום' : 'צבע אדום'}>
      <div className="red-alert-source">
        <span className="red-alert-source-icon">
          <SirenIcon size={18} />
        </span>
        {isSimulation ? 'תרגיל · זו לא התרעת אמת' : 'התרעת פיקוד העורף'}
      </div>

      <div className="red-alert-head">
        <div>
          <h1 className="red-alert-title">{isSimulation ? 'תרגיל צבע אדום' : 'צבע אדום'}</h1>
          <p className="red-alert-subtitle">
            {alert?.title} · {buildingName}
          </p>
        </div>
        <div className="red-alert-timer" role="timer" aria-label={`${secondsLeft} שניות להגעה למרחב מוגן`}>
          <span className="red-alert-seconds">{secondsLeft}</span>
          <span className="red-alert-seconds-label">שניות</span>
        </div>
      </div>

      <div className="red-alert-card">
        <h2 className="red-alert-card-title">איפה אתם עכשיו?</h2>
        <p className="red-alert-card-text">נציג לכם את המסלול למרחב המוגן הקרוב.</p>

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
          רק להציג את המרחבים המוגנים במפה
        </button>
      </div>

      <p className="red-alert-disclaimer">לסיוע בלבד. יש לפעול לפי הנחיות פיקוד העורף.</p>
    </div>
  );
}

export default RedAlertModal;
