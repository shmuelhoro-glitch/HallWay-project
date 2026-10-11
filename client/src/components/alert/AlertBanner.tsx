import { useAlertStore } from '../../store/alertStore';
import { useCountdown } from '../../hooks/useCountdown';
import { SirenIcon } from '../ui/Icons';
import './AlertBanner.css';

// A red bar at the top while the alert is active and the big window is closed
function AlertBanner() {
  const status = useAlertStore((state) => state.status);
  const alert = useAlertStore((state) => state.alert);
  const receivedAt = useAlertStore((state) => state.receivedAt);
  const isMinimized = useAlertStore((state) => state.isMinimized);
  const restore = useAlertStore((state) => state.restore);

  const secondsLeft = useCountdown(receivedAt, alert ? alert.countdown : 0);

  if (status !== 'active' || !isMinimized) {
    return null;
  }

  return (
    <div className="alert-banner" role="alert">
      <SirenIcon size={18} />
      <span className="alert-banner-text">
        Red Alert · <strong>{secondsLeft}s</strong>
      </span>
      <button type="button" className="alert-banner-button" onClick={restore}>
        Where am I?
      </button>
    </div>
  );
}

export default AlertBanner;
