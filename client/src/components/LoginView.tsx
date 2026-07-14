import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../api/client';
import './LoginView.css';

export function LoginView() {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await authApi.register(email.trim(), password);
      }
      const { access_token } = await authApi.login(email.trim(), password);
      login(access_token);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="login-logo">⎔</span>
          <h1>Solutionplex</h1>
          <span className="badge">MVP</span>
        </div>
        <p className="login-subtitle">
          {isRegister ? 'Create your account' : 'Sign in to continue'}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </div>

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          className="login-toggle"
          onClick={() => {
            setIsRegister(!isRegister);
            setError('');
          }}
        >
          {isRegister
            ? 'Already have an account? Sign in'
            : 'Need an account? Register'}
        </button>
      </div>
    </div>
  );
}
