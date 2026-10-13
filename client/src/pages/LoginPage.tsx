import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useCountdown } from '../hooks/useCountdown';
import { Logo } from '../components/ui/Icons';
import './AuthPages.css';

// After login we go back to where the user came from (?redirect=/b/123), only inside our site
function getRedirect(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return '/';
}

// The same as the server (middleware/loginRateLimiter.js): 5 wrong passwords lock the login for up to 15 seconds
const LOCK_SECONDS = 15;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS') return 'האימייל או הסיסמה שגויים.';
    if (error.code === 'VALIDATION_ERROR') return 'יש להזין אימייל וסיסמה תקינים.';
  }
  return 'ההתחברות נכשלה. נסו שוב.';
}

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = getRedirect(searchParams.get('redirect'));
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // After too many wrong passwords: when the lock started. The button waits until it is over.
  const [lockedAt, setLockedAt] = useState<number | null>(null);
  const lockSecondsLeft = useCountdown(lockedAt, LOCK_SECONDS);
  const isLocked = lockedAt !== null && lockSecondsLeft > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      setAuth(result.token, result.user);
      navigate(redirect, { replace: true });
    } catch (loginError) {
      if (loginError instanceof ApiError && loginError.code === 'ACCOUNT_LOCKED') {
        setLockedAt(Date.now());
      } else {
        setError(getErrorMessage(loginError));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="screen auth-screen">
      <Link to="/" className="auth-logo">
        <Logo />
        <span>InRoute</span>
      </Link>

      <h1 className="auth-title">התחברות</h1>
      <p className="auth-subtitle">התחברו כדי לכתוב בצ׳אט של המבנה.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-label" htmlFor="login-email">
          אימייל
        </label>
        <input
          id="login-email"
          className="auth-input ltr-text"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className="auth-label" htmlFor="login-password">
          סיסמה
        </label>
        <input
          id="login-password"
          className="auth-input ltr-text"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && !isLocked && <p className="message-error" role="alert">{error}</p>}
        {isLocked && (
          <p className="message-error" role="alert">
            יותר מדי ניסיונות. נסו שוב בעוד {lockSecondsLeft} שניות.
          </p>
        )}

        <button type="submit" className="btn btn-primary auth-submit" disabled={isSubmitting || isLocked}>
          {isSubmitting ? 'מתחבר...' : 'התחברות'}
        </button>
      </form>

      <p className="auth-switch">
        אין לכם חשבון? <Link to={`/register?redirect=${encodeURIComponent(redirect)}`}>הרשמה</Link>
      </p>
    </div>
  );
}

export default LoginPage;
