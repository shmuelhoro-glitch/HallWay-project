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
    if (error.code === 'EMAIL_TAKEN') return 'This email is already registered.';
    if (error.code === 'USERNAME_TAKEN') return 'This username is taken.';
    if (error.code === 'VALIDATION_ERROR') {
      return 'Username: 3-30 letters, numbers or _. Password: 8-72 characters.';
    }
  }
  return 'Could not sign up. Please try again.';
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
      navigate(redirect, { replace: true });
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

      <h1 className="auth-title">Sign up</h1>
      <p className="auth-subtitle">Create an account to chat with others in the building.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-label" htmlFor="register-username">
          Username
        </label>
        <input
          id="register-username"
          className="auth-input"
          autoComplete="username"
          required
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_]+"
          title="Letters, numbers and _ only"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />

        <label className="auth-label" htmlFor="register-email">
          Email
        </label>
        <input
          id="register-email"
          className="auth-input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className="auth-label" htmlFor="register-password">
          Password
        </label>
        <input
          id="register-password"
          className="auth-input"
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
          {isSubmitting ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>Log in</Link>
      </p>
    </div>
  );
}

export default RegisterPage;
