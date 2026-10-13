import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getMyOwnerRequest, sendOwnerRequest } from '../api/ownerRequests';
import { useAuthStore } from '../store/authStore';
import { BUILDING_TYPE_LABELS } from '../types/building';
import type { BuildingType } from '../types/building';
import type { OwnerRequest } from '../types/ownerRequest';
import { getErrorMessage } from '../utils/errorMessage';
import { Logo } from '../components/ui/Icons';
import './AuthPages.css';

const BUILDING_TYPES: BuildingType[] = ['mall', 'hospital', 'campus', 'office', 'other'];

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('he-IL');
}

// /join - a visitor asks to manage a building.
// The request waits for the owners of the system. They approve it by hand, so nothing changes here right away.
function JoinPage() {
  const user = useAuthStore((state) => state.user);
  const isManager = user !== null && (user.role === 'admin' || user.role === 'super');
  const canAsk = user !== null && !isManager;

  // undefined = still loading. null = this user never sent a request.
  const [myRequest, setMyRequest] = useState<OwnerRequest | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [buildingType, setBuildingType] = useState<BuildingType>('mall');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Did this user already send a request?
  useEffect(() => {
    if (!canAsk) return;

    let isCancelled = false;

    getMyOwnerRequest()
      .then((request) => {
        if (isCancelled) return;
        setMyRequest(request);
      })
      .catch(() => {
        if (isCancelled) return;
        // We could not check. The form is shown, and the server refuses a second open request.
        setLoadFailed(true);
        setMyRequest(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [canAsk]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSending(true);

    try {
      const saved = await sendOwnerRequest({
        full_name: fullName.trim(),
        phone: phone.trim(),
        building_name: buildingName.trim(),
        building_type: buildingType,
        city: city.trim(),
        message: message.trim(),
      });
      setMyRequest(saved);
    } catch (sendError) {
      setError(getErrorMessage(sendError, 'לא הצלחנו לשלוח את הפנייה. נסו שוב.'));
    } finally {
      setIsSending(false);
    }
  }

  function renderContent() {
    if (!user) {
      return (
        <div className="auth-form">
          <p className="auth-text">כדי לשלוח פנייה צריך חשבון. כך נדע למי לתת את גישת הניהול.</p>
          <Link to="/login?redirect=%2Fjoin" className="btn btn-primary auth-submit">
            התחברות
          </Link>
          <Link to="/register?redirect=%2Fjoin" className="btn btn-outline auth-second">
            הרשמה
          </Link>
        </div>
      );
    }

    if (isManager) {
      return (
        <div className="auth-form">
          <p className="auth-text">כבר יש לכם גישת ניהול.</p>
          <Link to="/admin" className="btn btn-primary auth-submit">
            מעבר לניהול המבנים
          </Link>
        </div>
      );
    }

    if (myRequest === undefined) {
      return <p className="message-info">טוען...</p>;
    }

    // An open request: nothing more to do but wait
    if (myRequest && myRequest.status === 'new') {
      return (
        <div className="auth-form">
          <h2 className="auth-card-title">הפנייה התקבלה</h2>
          <p className="auth-text">
            {myRequest.building_name} · {BUILDING_TYPE_LABELS[myRequest.building_type]} · {myRequest.city}
          </p>
          <p className="auth-text">נשלחה בתאריך {formatDate(myRequest.created_at)}. נחזור אליכם בהקדם.</p>
          <p className="auth-hint">אחרי שנאשר את הפנייה, התנתקו והתחברו מחדש כדי לראות את מסכי הניהול.</p>
          <Link to="/" className="btn btn-outline auth-second">
            חזרה למפה
          </Link>
        </div>
      );
    }

    return (
      <form className="auth-form" onSubmit={handleSubmit}>
        {myRequest && myRequest.status === 'handled' && (
          <p className="message-info auth-note">
            הפנייה הקודמת שלכם טופלה. אם היא אושרה, התנתקו והתחברו מחדש. אפשר גם לשלוח פנייה חדשה.
          </p>
        )}
        {loadFailed && <p className="message-info auth-note">לא הצלחנו לבדוק אם כבר שלחתם פנייה.</p>}

        <label className="auth-label" htmlFor="join-name">
          שם מלא
        </label>
        <input
          id="join-name"
          className="auth-input"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />

        <label className="auth-label" htmlFor="join-phone">
          טלפון (לא חובה)
        </label>
        <input
          id="join-phone"
          className="auth-input ltr-text"
          type="tel"
          autoComplete="tel"
          pattern="[0-9+\-\(\) ]{7,20}"
          title="ספרות, רווחים, מקף או +"
          maxLength={20}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />

        <label className="auth-label" htmlFor="join-building">
          שם המבנה
        </label>
        <input
          id="join-building"
          className="auth-input"
          required
          minLength={2}
          maxLength={80}
          placeholder="קניון הים"
          value={buildingName}
          onChange={(event) => setBuildingName(event.target.value)}
        />

        <label className="auth-label" htmlFor="join-type">
          סוג המבנה
        </label>
        <select
          id="join-type"
          className="auth-input"
          value={buildingType}
          onChange={(event) => setBuildingType(event.target.value as BuildingType)}
        >
          {BUILDING_TYPES.map((value) => (
            <option key={value} value={value}>
              {BUILDING_TYPE_LABELS[value]}
            </option>
          ))}
        </select>

        <label className="auth-label" htmlFor="join-city">
          עיר
        </label>
        <input
          id="join-city"
          className="auth-input"
          required
          minLength={2}
          maxLength={60}
          placeholder="תל אביב"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />

        <label className="auth-label" htmlFor="join-message">
          משהו שכדאי שנדע (לא חובה)
        </label>
        <textarea
          id="join-message"
          className="auth-input auth-textarea"
          maxLength={500}
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />

        {error && <p className="message-error">{error}</p>}

        <button type="submit" className="btn btn-primary auth-submit" disabled={isSending}>
          {isSending ? 'שולח...' : 'שליחת הפנייה'}
        </button>
      </form>
    );
  }

  return (
    <div className="screen auth-screen">
      <Link to="/" className="auth-logo">
        <Logo />
        <span>InRoute</span>
      </Link>

      <h1 className="auth-title">ניהול מבנה ב-InRoute</h1>
      <p className="auth-subtitle">
        מנהלים קניון, בית חולים או קמפוס? שלחו לנו פנייה, ואחרי שנאשר תוכלו להוסיף את המבנה, את הקומות ואת המקומות
        שלו.
      </p>

      {renderContent()}
    </div>
  );
}

export default JoinPage;
