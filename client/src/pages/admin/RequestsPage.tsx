import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { approveOwnerRequest, getOwnerRequests, setOwnerRequestStatus } from '../../api/ownerRequests';
import { useAuthStore } from '../../store/authStore';
import { BUILDING_TYPE_LABELS } from '../../types/building';
import type { OwnerRequestStatus, OwnerRequestWithUser } from '../../types/ownerRequest';
import { getErrorMessage } from '../../utils/errorMessage';
import UserMenu from '../../components/home/UserMenu';
import { BackIcon } from '../../components/ui/Icons';
import './Admin.css';

const TABS: { value: OwnerRequestStatus; label: string }[] = [
  { value: 'new', label: 'חדשות' },
  { value: 'handled', label: 'טופלו' },
];

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('he-IL');
}

// /admin/requests - the requests of visitors who want to manage a building.
// Only for the owners of the system (super). Approving a request makes its user a manager (admin);
// a request can also be marked as handled without approving it.
function RequestsPage() {
  const user = useAuthStore((state) => state.user);
  const isSuper = user !== null && user.role === 'super';

  const [requests, setRequests] = useState<OwnerRequestWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<OwnerRequestStatus>('new');

  const [savingId, setSavingId] = useState<number | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [approvedName, setApprovedName] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuper) return;

    let isCancelled = false;

    getOwnerRequests()
      .then((data) => {
        if (isCancelled) return;
        setRequests(data);
      })
      .catch((error) => {
        if (isCancelled) return;
        setLoadError(getErrorMessage(error, 'לא הצלחנו לטעון את הפניות.'));
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isSuper]);

  async function changeStatus(request: OwnerRequestWithUser, status: OwnerRequestStatus) {
    if (savingId !== null) return; // one change at a time
    setSavingId(request.id);
    setSaveError(null);
    setApprovedName(null);

    try {
      await setOwnerRequestStatus(request.id, status);
      setRequests((current) => current.map((item) => (item.id === request.id ? { ...item, status } : item)));
    } catch (error) {
      setSaveError(getErrorMessage(error, 'לא הצלחנו לעדכן את הפנייה. נסו שוב.'));
    } finally {
      setSavingId(null);
    }
  }

  async function approve(request: OwnerRequestWithUser) {
    if (savingId !== null || !request.user) return;
    const username = request.user.username;
    const isSure = window.confirm(
      `לאשר את הפנייה ולהפוך את ${username} למנהל מבנים? הוא יוכל ליצור מבנים ולנהל אותם.`,
    );
    if (!isSure) return;

    setSavingId(request.id);
    setIsApproving(true);
    setSaveError(null);
    setApprovedName(null);

    try {
      const approved = await approveOwnerRequest(request.id);
      setRequests((current) => current.map((item) => (item.id === request.id ? approved : item)));
      setApprovedName(username);
    } catch (error) {
      setSaveError(getErrorMessage(error, 'לא הצלחנו לאשר את הפנייה. נסו שוב.'));
    } finally {
      setSavingId(null);
      setIsApproving(false);
    }
  }

  const shown = requests.filter((request) => request.status === tab);
  const newCount = requests.filter((request) => request.status === 'new').length;

  return (
    <div className="admin-screen">
      <header className="admin-topbar">
        <Link to="/admin" className="icon-btn" aria-label="חזרה למבנים">
          <BackIcon />
        </Link>
        <div className="admin-topbar-titles">
          <h1 className="admin-title">פניות של בעלי מבנים</h1>
          <p className="admin-subtitle">מי שביקש לנהל מבנה במערכת.</p>
        </div>
        <UserMenu />
      </header>

      <div className="admin-content">
        {!isSuper ? (
          <div className="admin-empty">
            <p>המסך הזה מיועד לבעלי המערכת בלבד.</p>
            <Link to="/admin" className="btn btn-outline">
              חזרה למבנים
            </Link>
          </div>
        ) : (
          <>
            <section className="admin-card">
              <h2 className="admin-card-title">איך מאשרים פנייה</h2>
              <p className="admin-card-text">
                לוחצים על "אישור והפיכה למנהל" בכרטיס של הפנייה. המשתמש הופך למנהל מבנים, והפנייה עוברת ל"טופלו".
                מבנה שהוא ייצור יתווסף אליו אוטומטית. הוא יראה את מסכי הניהול אחרי שיתחבר מחדש. פנייה שלא מאשרים
                אפשר פשוט לסמן כ"טופלה".
              </p>
            </section>

            <div className="segmented requests-tabs" role="group" aria-label="סינון הפניות">
              {TABS.map((item) => (
                <button key={item.value} type="button" aria-pressed={tab === item.value} onClick={() => setTab(item.value)}>
                  {item.label}
                  {item.value === 'new' && newCount > 0 ? ` (${newCount})` : ''}
                </button>
              ))}
            </div>

            {isLoading && <p className="message-info is-loading" role="status">טוען פניות...</p>}
            {loadError && <p className="message-error" role="alert">{loadError}</p>}
            {saveError && <p className="message-error" role="alert">{saveError}</p>}
            {approvedName && (
              <p className="message-success" role="status">
                {approvedName} הוא עכשיו מנהל מבנים. הוא יראה את מסכי הניהול אחרי שיתחבר מחדש.
              </p>
            )}

            {!isLoading && !loadError && shown.length === 0 && (
              <div className="admin-empty requests-empty">
                <p>{tab === 'new' ? 'אין פניות חדשות.' : 'עדיין לא סומנו פניות כטופלו.'}</p>
              </div>
            )}

            <div className="requests-list">
              {shown.map((request) => (
                <article key={request.id} className="admin-card request-card">
                  <div className="request-head">
                    <div>
                      <h2 className="admin-card-title">{request.building_name}</h2>
                      <p className="admin-card-text">
                        {BUILDING_TYPE_LABELS[request.building_type] ?? request.building_type} · {request.city} ·{' '}
                        {formatDate(request.created_at)}
                      </p>
                    </div>
                    {request.user && request.user.role !== 'visitor' && <span className="badge badge-green">כבר מנהל</span>}
                  </div>

                  <dl className="request-details">
                    <div>
                      <dt>שם</dt>
                      <dd>{request.full_name}</dd>
                    </div>
                    {request.phone && (
                      <div>
                        <dt>טלפון</dt>
                        <dd>
                          <a href={`tel:${request.phone}`} dir="ltr">
                            {request.phone}
                          </a>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>משתמש</dt>
                      <dd>{request.user ? request.user.username : 'המשתמש נמחק'}</dd>
                    </div>
                    {request.user && (
                      <div>
                        <dt>אימייל</dt>
                        <dd>
                          <a href={`mailto:${request.user.email}`} dir="ltr">
                            {request.user.email}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>

                  {request.message && (
                    <p className="request-message" dir="auto">
                      {request.message}
                    </p>
                  )}

                  <div className="form-actions">
                    {request.status === 'new' ? (
                      <>
                        {/* Only a visitor can be made a manager: the others already are */}
                        {request.user && request.user.role === 'visitor' && (
                          <button
                            type="button"
                            className="btn btn-primary request-action"
                            disabled={savingId !== null}
                            onClick={() => approve(request)}
                          >
                            {savingId === request.id && isApproving ? 'מאשר...' : 'אישור והפיכה למנהל'}
                          </button>
                        )}
                        <button
                          type="button"
                          className={`btn request-action ${request.user?.role === 'visitor' ? 'btn-outline' : 'btn-primary'}`}
                          disabled={savingId !== null}
                          onClick={() => changeStatus(request, 'handled')}
                        >
                          {savingId === request.id && !isApproving ? 'שומר...' : 'סימון כטופלה'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={savingId !== null}
                        onClick={() => changeStatus(request, 'new')}
                      >
                        {savingId === request.id ? 'שומר...' : 'החזרה לחדשות'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RequestsPage;
