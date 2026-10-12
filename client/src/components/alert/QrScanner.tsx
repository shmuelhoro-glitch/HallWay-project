import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CloseIcon } from '../ui/Icons';
import './QrScanner.css';

export interface QrResult {
  buildingId: string;
  nodeId: string;
}

interface QrScannerProps {
  onScan: (result: QrResult) => void;
  onClose: () => void;
}

const READER_ID = 'qr-reader';

// Our codes hold a link like https://site/b/<buildingId>?node=<nodeId>
function parseQrText(text: string): QrResult | null {
  try {
    const url = new URL(text);
    const match = url.pathname.match(/^\/b\/([^/]+)\/?$/);
    const nodeId = url.searchParams.get('node');

    if (!match || !nodeId) {
      return null;
    }
    return { buildingId: match[1], nodeId };
  } catch {
    return null;
  }
}

// Works only on https or localhost, because the browser asks for the camera
function QrScanner({ onScan, onClose }: QrScannerProps) {
  const [error, setError] = useState<string | null>(null);

  // Always call the newest onScan, without restarting the camera
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let startPromise: Promise<unknown> | null = null;
    let isDone = false;

    // setTimeout: in React StrictMode the effect runs twice. The first run is
    // cancelled before the camera starts, so only one camera is opened.
    const timer = setTimeout(() => {
      scanner = new Html5Qrcode(READER_ID);
      startPromise = scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 220 },
          (decodedText) => {
            if (isDone) return;
            const result = parseQrText(decodedText);
            if (!result) {
              setError('זה לא קוד של InRoute.');
              return;
            }
            isDone = true;
            onScanRef.current(result);
          },
          () => {
            // No code in this frame - normal, nothing to do
          },
        )
        .catch(() => {
          setError('לא הצלחנו לפתוח את המצלמה. אפשרו גישה למצלמה ונסו שוב.');
        });
    }, 0);

    return () => {
      clearTimeout(timer);
      if (scanner && startPromise) {
        const runningScanner = scanner;
        startPromise
          .then(() => runningScanner.stop())
          .catch(() => {
            // The camera was not running
          });
      }
    };
  }, []);

  return (
    <div className="overlay qr-overlay">
      <div className="dialog qr-scanner" role="dialog" aria-label="סריקת קוד QR">
        <div className="sheet-header">
          <div>
            <h2 className="sheet-title">סריקת קוד QR</h2>
            <p className="sheet-text">כוונו את המצלמה אל שלט של InRoute.</p>
          </div>
          <button type="button" className="icon-btn icon-btn-plain" aria-label="סגירה" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div id={READER_ID} className="qr-reader" />

        {error && <p className="message-error">{error}</p>}
      </div>
    </div>
  );
}

export default QrScanner;
