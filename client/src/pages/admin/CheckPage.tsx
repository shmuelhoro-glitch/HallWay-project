import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBuildingCheck } from '../../api/admin';
import type { CheckProblem } from '../../api/admin';
import { getCheckLink, getCheckMessage } from '../../utils/checkMessages';
import { getErrorMessage } from '../../utils/errorMessage';
import { getFloorName } from '../../utils/floors';
import { useAdminBuilding } from './adminContext';

// The "Check" tab: everything that is wrong in the building, the serious things first.
// Each line leads to the place where it is fixed.
function CheckPage() {
  const { building } = useAdminBuilding();

  const [problems, setProblems] = useState<CheckProblem[] | null>(null); // null = not loaded yet
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // "Check again" adds 1 and loads again

  useEffect(() => {
    let isCancelled = false;

    getBuildingCheck(building.id)
      .then((result) => {
        if (isCancelled) return;
        setProblems(result.problems);
        setError(null);
      })
      .catch((checkError) => {
        if (isCancelled) return;
        setError(getErrorMessage(checkError, 'לא הצלחנו לבדוק את המבנה. נסו שוב.'));
      });

    return () => {
      isCancelled = true;
    };
  }, [building.id, attempt]);

  function checkAgain() {
    setProblems(null);
    setError(null);
    setAttempt((current) => current + 1);
  }

  const errors = problems ? problems.filter((problem) => problem.level === 'error') : [];
  const warnings = problems ? problems.filter((problem) => problem.level === 'warning') : [];

  function renderList(title: string, hint: string, list: CheckProblem[], badgeClass: string, badgeText: string) {
    if (list.length === 0) return null;

    return (
      <section className="admin-card">
        <h2 className="admin-card-title">
          {title} ({list.length})
        </h2>
        <p className="admin-card-text">{hint}</p>

        {list.map((problem, index) => (
          <div key={`${problem.code}-${problem.id}-${index}`} className="admin-row">
            <span className={`badge ${badgeClass}`}>{badgeText}</span>
            <div className="admin-row-main">
              <div className="check-message">{getCheckMessage(problem)}</div>
              {problem.floor !== null && (
                <div className="admin-row-meta">{getFloorName(building.floors, problem.floor)}</div>
              )}
            </div>
            <Link to={getCheckLink(problem)} className="text-btn">
              הצגה
            </Link>
          </div>
        ))}
      </section>
    );
  }

  return (
    <div className="check-page">
      <section className="admin-card">
        <div className="sheet-header">
          <div>
            <h2 className="admin-card-title">בדיקת המבנה</h2>
            <p className="admin-card-text">בודקים שכל מקום מחובר, שהקומות מחוברות זו לזו, ושאין נתונים שבורים.</p>
          </div>
          <button type="button" className="btn btn-small" onClick={checkAgain} disabled={problems === null && !error}>
            בדיקה מחדש
          </button>
        </div>

        {problems === null && !error && <p className="message-info is-loading" role="status">בודק...</p>}
        {error && <p className="message-error" role="alert">{error}</p>}

        {problems !== null && problems.length === 0 && (
          <p className="message-success" role="status">לא נמצאו בעיות. מבקרים יכולים להגיע לכל מקום במבנה.</p>
        )}
        {problems !== null && problems.length > 0 && (
          <p className={errors.length > 0 ? 'message-error' : 'message-info'}>
            נמצאו {errors.length} שגיאות ו-{warnings.length} אזהרות.
          </p>
        )}
      </section>

      {renderList('שגיאות', 'בגלל אלה מבקרים יקבלו מסלול שגוי, או לא יקבלו מסלול בכלל.', errors, 'badge-red', 'שגיאה')}
      {renderList('אזהרות', 'כדאי לבדוק, אבל הניווט ממשיך לעבוד.', warnings, 'badge-yellow', 'אזהרה')}
    </div>
  );
}

export default CheckPage;
