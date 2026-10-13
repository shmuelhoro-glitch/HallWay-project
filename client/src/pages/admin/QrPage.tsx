import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGraph, getQrUrl } from '../../api/admin';
import type { GraphNode } from '../../types/graph';
import { getFloorName } from '../../utils/floors';
import { useAdminBuilding } from './adminContext';
import { PrinterIcon } from '../../components/ui/Icons';

// The "QR codes" tab: one code for every point of type "QR code", ready to print.
// A visitor who scans it opens the building with "You are here" on that point.
function QrPage() {
  const { building } = useAdminBuilding();

  const [qrNodes, setQrNodes] = useState<GraphNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    // The whole building at once (no floor)
    getGraph(building.id)
      .then((graph) => {
        if (isCancelled) return;
        const onlyQr = graph.nodes.filter((node) => node.type === 'qr');
        onlyQr.sort((a, b) => a.floor - b.floor || a.label.localeCompare(b.label));
        setQrNodes(onlyQr);
      })
      .catch(() => {
        if (isCancelled) return;
        setError('לא הצלחנו לטעון את נקודות ה-QR.');
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [building.id]);

  if (isLoading) {
    return <p className="message-info is-loading" role="status">טוען...</p>;
  }

  if (error) {
    return <p className="message-error" role="alert">{error}</p>;
  }

  if (qrNodes.length === 0) {
    return (
      <div className="admin-empty">
        <p>
          עדיין אין נקודות QR. בלשונית "מעברים" בחרו "עריכה", לחצו על נקודה ליד כניסה או מעלית, ושנו את הסוג שלה
          ל"קוד QR".
        </p>
        <Link to="../graph" className="btn btn-primary">
          מעבר למעברים
        </Link>
      </div>
    );
  }

  return (
    <div className="qr-page">
      <div className="qr-toolbar">
        <p className="admin-card-text">
          {qrNodes.length === 1 ? 'קוד אחד' : `${qrNodes.length} קודים`}. הדפיסו אותם ותלו כל אחד במקום שלו במבנה.
        </p>
        <button type="button" className="btn btn-primary qr-print" onClick={() => window.print()}>
          <PrinterIcon />
          הדפסה
        </button>
      </div>

      <div className="qr-grid">
        {qrNodes.map((node) => (
          <figure key={node.id} className="qr-card">
            <img className="qr-image" src={getQrUrl(building.id, node.id)} alt={`קוד QR: ${node.label}`} />
            <figcaption>
              <div className="qr-building">{building.name}</div>
              <div className="qr-label">{node.label || 'נקודת QR'}</div>
              <div className="qr-floor">{getFloorName(building.floors, node.floor)}</div>
              <div className="qr-scan">סרקו כדי לנווט</div>
            </figcaption>
            {/* For a quick test on the computer, without a phone */}
            <Link className="text-btn qr-test" to={`/b/${building.id}?node=${node.id}`}>
              בדיקת הקוד
            </Link>
          </figure>
        ))}
      </div>
    </div>
  );
}

export default QrPage;
