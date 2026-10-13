import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login, register } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Logo } from '../components/ui/Icons';
import './AuthPages.css';

function getRedirect(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return '/';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'EMAIL_TAKEN') return 'האימייל הזה כבר רשום.';
    if (error.code === 'USERNAME_TAKEN') return 'שם המשתמש הזה תפוס.';
    if (error.code === 'VALIDATION_ERROR') {
      return 'שם משתמש: 3 עד 30 אותיות באנגלית, ספרות או קו תחתון. סיסמה: 8 עד 72 תווים.';
    }
  }
  return 'ההרשמה נכשלה. נסו שוב.';
}

function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = getRedirect(searchParams.get('redirect'));
  const setAuth = useAuthStore((state) => state.setAuth);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register(username, email, password);
      // Registered - now log in, so the user does not have to type it again
      const result = await login(email, password);
      setAuth(result.token, result.user);

      // A new account is always a visitor. Someone who came here on the way to the admin
      // screens wants to manage a building, so he continues to the request form, not to a closed door.
      navigate(redirect.startsWith('/admin') ? '/join' : redirect, { replace: true });
    } catch (registerError) {
      setError(getErrorMessage(registerError));
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

      <h1 className="auth-title">הרשמה</h1>
      <p className="auth-subtitle">צרו חשבון כדי לשוחח עם אחרים במבנה.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-label" htmlFor="register-username">
          שם משתמש
        </label>
        <input
          id="register-username"
          className="auth-input ltr-text"
          autoComplete="username"
          required
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_]+"
          title="אותיות באנגלית, ספרות וקו תחתון בלבד"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />

        <label className="auth-label" htmlFor="register-email">
          אימייל
        </label>
        <input
          id="register-email"
          className="auth-input ltr-text"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className="auth-label" htmlFor="register-password">
          סיסמה
        </label>
        <input
          id="register-password"
          className="auth-input ltr-text"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && <p className="message-error">{error}</p>}

        <button type="submit" className="btn btn-primary auth-submit" disabled={isSubmitting}>
          {isSubmitting ? 'יוצר חשבון...' : 'הרשמה'}
        </button>
      </form>

      <p className="auth-switch">
        כבר יש לכם חשבון? <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>התחברות</Link>
      </p>
      <p className="auth-hint auth-join">
        מנהלים מבנה? אחרי ההרשמה אפשר <Link to="/join">לבקש גישת ניהול</Link>.
      </p>
    </div>
  );
}

export default RegisterPage;
