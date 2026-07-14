# Phase 3 — Frontend Auth

**Objective:** Create the client-side authentication layer: JWT decode utility, `AuthContext` with `useAuth` hook, `useRole` hook, login + register views, wire `Authorization` header into the API client, invalidate react-query cache on logout, and add login/logout UI to the header.

**Depends on:** Phase 1 (Backend Auth Foundation) must be complete so `/api/auth/login` and `/api/auth/register` endpoints exist.

---

## Dependencies

**No new npm packages required.** JWT decoding uses the native `atob` API. Auth state uses React Context. The existing `@tanstack/react-query` handles cache invalidation.

---

## Files to Create / Modify

### New Files

| File | Purpose |
|------|---------|
| `client/src/auth/jwtDecode.ts` | `decodeJwtPayload()`, `isTokenExpired()` — zero-dep JWT payload decode |
| `client/src/auth/AuthContext.tsx` | `AuthProvider`, `useAuth` — token storage, login/logout, user state |
| `client/src/auth/useRole.ts` | `useRole` hook — `canWrite`, `isSuperAdmin`, `hasRole()` |
| `client/src/components/LoginPage.tsx` | Login form + register toggle |
| `client/src/components/LoginPage.css` | Styling for the login/register page |

### Modified Files

| File | Change |
|------|--------|
| `client/src/api/client.ts` | Inject `Authorization: Bearer` header in `request()`, add `authApi` object, handle 401 |
| `client/src/App.tsx` | Wrap content in `<AuthProvider>`, show `<LoginPage>` when not authed, add logout button to header |
| `client/src/main.tsx` | No change needed — `AuthProvider` goes inside `App.tsx` above `ToastProvider` |

---

## Step-by-Step Implementation

### Step 1 — `client/src/auth/jwtDecode.ts` (NEW)

```typescript
// client/src/auth/jwtDecode.ts

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'reader' | 'admin' | 'superadmin';
  exp: number;
}

/**
 * Decode a JWT payload without signature verification.
 * Safe for UI display / gating; the server validates on every request.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    );

    const json = decodeURIComponent(
      window
        .atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Check whether a decoded token's `exp` claim is in the past.
 */
export function isTokenExpired(payload: JwtPayload): boolean {
  return Date.now() >= payload.exp * 1000;
}
```

### Step 2 — `client/src/auth/AuthContext.tsx` (NEW)

```tsx
// client/src/auth/AuthContext.tsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { decodeJwtPayload, isTokenExpired } from './jwtDecode';

const TOKEN_KEY = 'sp_access_token';

type UserRole = 'reader' | 'admin' | 'superadmin';

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  /** The current user, or null if not logged in. */
  user: AuthUser | null;
  /** The raw JWT string, or null. */
  token: string | null;
  /** True while hydrating from localStorage on mount. */
  isLoading: boolean;
  /** Persist a new token (after login). */
  login: (token: string) => void;
  /** Clear token and user state. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      const payload = decodeJwtPayload(stored);
      if (payload && !isTokenExpired(payload)) {
        setToken(stored);
        setUser({ id: payload.sub, email: payload.email, role: payload.role });
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string) => {
    const payload = decodeJwtPayload(newToken);
    if (!payload) throw new Error('Invalid token');
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser({ id: payload.sub, email: payload.email, role: payload.role });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout }),
    [user, token, isLoading, login, logout]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

/**
 * Access the auth context. Must be used within <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
```

### Step 3 — `client/src/auth/useRole.ts` (NEW)

```typescript
// client/src/auth/useRole.ts

import { useMemo } from 'react';
import { useAuth } from './AuthContext';

type UserRole = 'reader' | 'admin' | 'superadmin';

const ROLE_RANK: Record<UserRole, number> = {
  reader: 0,
  admin: 1,
  superadmin: 2,
};

interface RoleInfo {
  /** The user's current role, or null if unauthenticated. */
  role: UserRole | null;
  /** True if the user can perform write operations (Admin+). */
  canWrite: boolean;
  /** True if the user has SuperAdmin clearance. */
  isSuperAdmin: boolean;
  /** Check if the user meets a minimum role requirement. */
  hasRole: (minRole: UserRole) => boolean;
}

/**
 * Provides role-aware helpers derived from the current auth state.
 */
export function useRole(): RoleInfo {
  const { user } = useAuth();

  return useMemo(() => {
    const role = user?.role ?? null;
    const rank = role ? ROLE_RANK[role] : -1;

    return {
      role,
      canWrite: rank >= ROLE_RANK.admin,
      isSuperAdmin: rank >= ROLE_RANK.superadmin,
      hasRole: (minRole: UserRole) => rank >= ROLE_RANK[minRole],
    };
  }, [user]);
}
```

### Step 4 — `client/src/api/client.ts` (MODIFY)

Modify the `request()` function to inject the `Authorization` header and handle 401 responses. Add an `authApi` object for login/register.

```diff
 const API_URL = import.meta.env.VITE_API_BASE_URL || '';

+const TOKEN_KEY = 'sp_access_token';
+
 async function request<T>(path: string, options?: RequestInit): Promise<T> {
+  const token = localStorage.getItem(TOKEN_KEY);
+  const headers: Record<string, string> = {
+    'Content-Type': 'application/json',
+    ...(options?.headers as Record<string, string> || {}),
+  };
+
+  if (token) {
+    headers['Authorization'] = `Bearer ${token}`;
+  }
+
   const response = await fetch(`${API_URL}${path}`, {
     ...options,
-    headers: {
-      'Content-Type': 'application/json',
-      ...(options?.headers || {}),
-    },
+    headers,
   });
+
+  if (response.status === 401) {
+    // Token expired or invalid — clear and reload to show login
+    localStorage.removeItem(TOKEN_KEY);
+    window.location.reload();
+    throw new Error('Session expired');
+  }
+
   if (!response.ok) {
     const errorMsg = await response.text();
     throw new Error(errorMsg || `API request failed with status ${response.status}`);
```

Add at the bottom of the file:

```typescript
export const authApi = {
  login: (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);   // OAuth2 form expects 'username'
    formData.append('password', password);

    return fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Login failed');
      }
      return res.json() as Promise<{ access_token: string; token_type: string }>;
    });
  },

  register: (email: string, username: string, password: string) =>
    request<{ id: string; email: string; username: string; role: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      }
    ),
};
```

### Step 5 — `client/src/components/LoginPage.tsx` (NEW)

A login page with a toggle to switch to registration mode. Follows the existing dark-themed design.

```tsx
// client/src/components/LoginPage.tsx

import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../api/client';
import './LoginPage.css';

export function LoginPage() {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        // Register, then auto-login
        await authApi.register(email.trim(), username.trim(), password);
        const { access_token } = await authApi.login(email.trim(), password);
        login(access_token);
      } else {
        const { access_token } = await authApi.login(email.trim(), password);
        login(access_token);
      }
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

          {isRegister && (
            <div className="login-field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Display name"
                minLength={2}
                maxLength={50}
                autoComplete="username"
              />
            </div>
          )}

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
```

### Step 6 — `client/src/components/LoginPage.css` (NEW)

Style the login page to match the existing dark-themed aesthetic:

```css
/* client/src/components/LoginPage.css */

.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-primary);
  padding: 2rem;
}

.login-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-grid);
  border-radius: 8px;
  padding: 2.5rem;
  width: 100%;
  max-width: 400px;
}

.login-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.login-header h1 {
  font-size: 1.3rem;
  margin: 0;
  color: var(--text-primary);
}

.login-logo {
  font-size: 1.5rem;
  color: var(--accent-cyan);
}

.login-subtitle {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-bottom: 1.5rem;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.login-error {
  background: rgba(255, 70, 70, 0.1);
  border: 1px solid var(--accent-problem);
  color: var(--accent-problem);
  padding: 0.6rem 0.8rem;
  border-radius: 4px;
  font-size: 0.8rem;
  margin-bottom: 1rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.login-field label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.login-field input {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-grid);
  border-radius: 4px;
  padding: 0.65rem 0.8rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.login-field input:focus {
  border-color: var(--accent-cyan);
}

.login-submit {
  margin-top: 0.5rem;
  padding: 0.7rem;
  background: var(--accent-cyan);
  color: var(--bg-primary);
  border: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: opacity 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.login-submit:hover:not(:disabled) {
  opacity: 0.9;
}

.login-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-toggle {
  display: block;
  width: 100%;
  margin-top: 1rem;
  background: none;
  border: none;
  color: var(--accent-cyan);
  font-size: 0.8rem;
  cursor: pointer;
  text-align: center;
  padding: 0.5rem;
}

.login-toggle:hover {
  text-decoration: underline;
}
```

### Step 7 — `client/src/App.tsx` (MODIFY)

Wrap the entire app in `<AuthProvider>`, gate behind login, and add a logout button to the header.

```diff
 import { useState, useEffect } from 'react';
 import './App.css';
+import { AuthProvider, useAuth } from './auth/AuthContext';
+import { LoginPage } from './components/LoginPage';
+import { useQueryClient } from '@tanstack/react-query';

 // ... existing imports ...

 export function App() {
+  return (
+    <AuthProvider>
+      <AppContent />
+    </AuthProvider>
+  );
+}
+
+function AppContent() {
+  const { user, isLoading, logout } = useAuth();
+  const queryClient = useQueryClient();
   const [activeTab, setActiveTab] = useState<Tab>('problems');
   const [searchQuery, setSearchQuery] = useState('');
   const [currentPath, setCurrentPath] = useState(window.location.pathname);

+  if (isLoading) {
+    return <div className="loading-screen">Loading…</div>;
+  }
+
+  if (!user) {
+    return <LoginPage />;
+  }
+
+  const handleLogout = () => {
+    logout();
+    queryClient.clear();  // Wipe all cached queries on logout
+  };

   // ... existing useEffect, navigate, tabs, etc. ...

   return (
     <ToastProvider>
       <div className="app-container">
         <header className="app-header">
           <div className="logo-group" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
             <span className="logo-icon">⎔</span>
             <h1>Solutionplex</h1>
             <span className="badge">MVP</span>
           </div>

           {!routeInfo && (
             <div className="search-group">
               {/* existing search input */}
             </div>
           )}
+
+          <div className="auth-group">
+            <span className="auth-user">{user.email}</span>
+            <span className="auth-role">{user.role}</span>
+            <button className="auth-logout-btn" onClick={handleLogout}>
+              Logout
+            </button>
+          </div>
         </header>
         {/* ... rest unchanged ... */}
```

Add corresponding CSS for the auth group to `client/src/App.css`:

```css
.auth-group {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-left: auto;
}

.auth-user {
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-family: var(--font-mono);
}

.auth-role {
  font-size: 0.65rem;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--accent-cyan);
  color: var(--accent-cyan);
  border-radius: 3px;
}

.auth-logout-btn {
  background: transparent;
  border: 1px solid var(--border-grid);
  color: var(--text-secondary);
  padding: 0.3rem 0.6rem;
  font-size: 0.7rem;
  font-family: var(--font-mono);
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 3px;
  transition: border-color 0.2s, color 0.2s;
}

.auth-logout-btn:hover {
  border-color: var(--accent-problem);
  color: var(--accent-problem);
}

.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

---

## Key Design Decisions

1. **Token in `localStorage`** — Acceptable for internal MVP per research.md §5.1. The `TOKEN_KEY` constant (`sp_access_token`) is shared between `AuthContext.tsx` and `client.ts`.

2. **`request()` auto-injects Bearer header** — Every API call automatically gets the token. No per-call changes needed.

3. **401 handling in `request()`** — On 401 response, the token is cleared and the page reloads, which triggers `AuthProvider` to show the login page.

4. **`queryClient.clear()` on logout** — Per research.md §8.2, `clear()` is preferred over `invalidateQueries()` because the latter would refetch with no token and fail.

5. **`authApi.login` uses `fetch` directly** (not `request()`) — The login endpoint expects `application/x-www-form-urlencoded`, not JSON. The register endpoint uses `request()` since it's JSON.

6. **No new npm packages** — JWT decode uses native `atob`. Auth state uses React Context.

---

## Verification

```bash
cd client
npm run build   # TypeScript strict check + Vite build
npm run lint    # oxlint
```

### Manual Testing
1. Start backend: `cd server && uv run uvicorn main:app --reload --port 8000`
2. Start frontend: `cd client && npm run dev`
3. Open browser → should see login page
4. Register a new user → auto-login → see dashboard
5. Refresh page → should stay logged in (localStorage)
6. Click Logout → back to login page
7. Check header shows email + role badge
