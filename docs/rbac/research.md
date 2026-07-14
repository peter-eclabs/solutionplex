# RBAC Implementation — Research Document

**Date:** July 2026
**Scope:** FastAPI backend + React 19 frontend for Solutionplex
**Status:** Complete — ready for implementation planning

---

## Recommended Stack (Summary)

| Layer | Library | Version | Purpose |
|-------|---------|---------|---------|
| Backend — JWT | `PyJWT` | `>=2.10` | Token encode/decode (HS256) |
| Backend — Hashing | `pwdlib[argon2]` | `>=0.2` | Argon2id password hashing |
| Backend — Auth scheme | `fastapi.security.OAuth2PasswordBearer` | (built-in) | Bearer token extraction |
| Frontend — JWT decode | *None (native `atob`)* | — | Decode payload client-side |
| Frontend — Auth state | React Context + `useAuth` hook | — | Token storage, role exposure |

> **No new frontend npm packages required for auth.** The existing `fetch`-based
> `client.ts` is extended with an `Authorization` header; JWT decoding uses the
> browser-native `atob` API.

---

## 1. Backend Auth Libraries

### 1.1 JWT: PyJWT ✅ (recommended)

| Criterion | `PyJWT` | `python-jose` |
|-----------|---------|---------------|
| Maintenance | **Active** (regular releases through 2026) | Abandoned since ~2021 |
| Python 3.13 | Fully compatible | Untested / broken transitive deps |
| FastAPI docs | **Officially recommended** (tiangolo updated docs mid-2025) | Deprecated from docs |
| API surface | Simple `jwt.encode()` / `jwt.decode()` | Similar, but dependency on `ecdsa`/`rsa` forks |

**Install** (via `uv`):
```bash
uv add pyjwt
```

> For RSA/EC algorithms: `uv add "pyjwt[crypto]"`. For Solutionplex MVP, HS256
> with a shared secret is sufficient.

### 1.2 Password Hashing: pwdlib + Argon2 ✅ (recommended)

| Criterion | `pwdlib[argon2]` | `passlib[bcrypt]` | `argon2-cffi` (direct) |
|-----------|------------------|-------------------|------------------------|
| Maintenance | **Active** — modern replacement | **Dead** since 2020 | Active |
| Python 3.13 | ✅ | ❌ `DeprecationWarning` → breakage | ✅ |
| FastAPI docs | **Recommended** (official tutorial) | Removed from docs | Supported but lower-level |
| Algorithm | Argon2id (OWASP gold standard) | bcrypt (72-byte limit) | Argon2id |
| Ease of use | High (`PasswordHash` wrapper) | Medium (`CryptContext`) | Lower (raw API) |

**Install**:
```bash
uv add "pwdlib[argon2]"
```

**⚠️ Known 2026 Pitfalls:**
- `passlib` is incompatible with `bcrypt>=4.0` and triggers `DeprecationWarning`
  under Python 3.13 that will become hard errors in 3.14.
- `passlib` has no maintainer; do **not** add it to new projects.
- `pwdlib` intentionally excludes legacy algorithms (MD5, SHA-1) — this is a
  feature, not a limitation.

#### Code Snippet — `server/auth/password.py`

```python
"""Password hashing utilities using Argon2id via pwdlib."""

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

# Single shared instance — thread-safe, reusable.
_hasher = PasswordHash((Argon2Hasher(),))


def hash_password(plain: str) -> str:
    """Hash a plaintext password with Argon2id.

    Args:
        plain: The plaintext password to hash.

    Returns:
        The Argon2id hash string.
    """
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a stored Argon2id hash.

    Args:
        plain: The plaintext password to verify.
        hashed: The stored hash to verify against.

    Returns:
        True if the password matches, False otherwise.
    """
    return _hasher.verify(plain, hashed)
```

---

## 2. FastAPI JWT Flow

### 2.1 Token Strategy (MVP)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Token style | `OAuth2PasswordBearer` (access token only) | Standard OAuth2 "password" grant; integrates with Swagger `/docs` |
| Algorithm | HS256 | Simple shared-secret; suitable for single-service MVP |
| Payload claims | `sub` (user id), `email`, `role`, `exp` | Goal doc §3.2: "JWT MUST embed role" |
| Expiry | 60 minutes (configurable via `Settings`) | Sufficient for internal tool; no refresh token for MVP |
| Login response | JSON `{ "access_token": "...", "token_type": "bearer" }` | Standard OAuth2 response shape |

### 2.2 Settings Extension — `server/config.py`

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "solutionplex"

    # Auth / JWT
    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
```

`.env` additions:
```
JWT_SECRET_KEY=your-very-long-random-secret-here
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
```

### 2.3 Token Creation — `server/auth/jwt.py`

```python
"""JWT token creation and decoding."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from server.config import settings

logger = logging.getLogger(__name__)


def create_access_token(data: dict[str, Any]) -> str:
    """Create a signed JWT access token.

    Args:
        data: Claims to embed (must include 'sub', 'email', 'role').

    Returns:
        Encoded JWT string.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT access token.

    Args:
        token: The raw JWT string.

    Returns:
        Decoded payload dict.

    Raises:
        jwt.ExpiredSignatureError: If the token has expired.
        jwt.InvalidTokenError: If the token is malformed or the signature is invalid.
    """
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
```

### 2.4 Login Endpoint — `server/routers/auth.py`

```python
"""Authentication endpoints: register + login."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from server.auth.jwt import create_access_token
from server.auth.password import hash_password, verify_password
from server.database.client import users_col
from server.schemas.auth import RegisterRequest, TokenResponse, UserResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Creates a new user with the default 'reader' role.",
)
async def register(data: RegisterRequest):
    """Register a new user account."""
    try:
        existing = await users_col.find_one({"email": data.email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        doc = {
            "email": data.email,
            "username": data.username,
            "hashed_password": hash_password(data.password),
            "role": "reader",  # Default role per goal doc §3.1
        }
        result = await users_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to register user")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and obtain JWT",
    description="Validates credentials and returns a Bearer access token with embedded role.",
)
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    """Authenticate user and return JWT access token."""
    try:
        user = await users_col.find_one({"email": form.username})
        if not user or not verify_password(form.password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token({
            "sub": str(user["_id"]),
            "email": user["email"],
            "role": user["role"],
        })
        return {"access_token": token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Login failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e
```

> **Note**: `OAuth2PasswordRequestForm` expects `username` + `password` form
> fields. We use `email` as the username value. This keeps Swagger `/docs` auth
> working out-of-the-box.

---

## 3. Role-Based Dependencies

### 3.1 Architecture

```
request → OAuth2PasswordBearer (extracts token)
        → get_current_user (decodes JWT, returns TokenPayload)
        → require_role(min_role) (checks clearance, returns TokenPayload or 403)
```

### 3.2 Role Ordering

```python
# Roles ordered by clearance level (goal doc §2)
ROLE_RANK: dict[str, int] = {
    "reader": 0,
    "admin": 1,
    "superadmin": 2,
}
```

### 3.3 Code — `server/auth/dependencies.py`

```python
"""Reusable FastAPI auth dependencies for RBAC."""

import logging

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from server.auth.jwt import decode_access_token
from server.schemas.auth import TokenPayload

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ROLE_RANK: dict[str, int] = {
    "reader": 0,
    "admin": 1,
    "superadmin": 2,
}


async def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> TokenPayload:
    """Decode JWT and return the authenticated user's token payload.

    Raises:
        HTTPException 401: If the token is missing, expired, or invalid.
    """
    try:
        payload = decode_access_token(token)
        return TokenPayload(**payload)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


class RequireRole:
    """Callable dependency that enforces a minimum role clearance.

    Usage in a router:
        @router.post("/", dependencies=[Depends(RequireRole("admin"))])
        async def create_thing(...): ...

    Or to also receive the user payload:
        async def create_thing(user: TokenPayload = Depends(RequireRole("admin"))): ...
    """

    def __init__(self, min_role: str) -> None:
        self.min_role = min_role

    async def __call__(
        self, user: TokenPayload = Depends(get_current_user),
    ) -> TokenPayload:
        user_rank = ROLE_RANK.get(user.role, -1)
        required_rank = ROLE_RANK.get(self.min_role, 999)
        if user_rank < required_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' lacks clearance (requires '{self.min_role}')",
            )
        return user
```

### 3.4 Applying to Existing Routers

The existing routers (e.g. `server/routers/problems.py`) apply guards per-route
via `dependencies` or `Depends` in the function signature:

```python
from server.auth.dependencies import RequireRole

# Mutation routes — require Admin or above
@router.post(
    "/",
    response_model=ProblemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RequireRole("admin"))],
    summary="Create a new Problem card",
)
async def create_problem(data: ProblemCreate):
    ...

# Read routes — no guard needed (public / reader-accessible)
@router.get("/", response_model=List[ProblemResponse], summary="List all Problems")
async def list_problems(q: Optional[str] = None):
    ...
```

> **Pattern**: Add `dependencies=[Depends(RequireRole("admin"))]` to every
> `POST`, `PUT`, and `DELETE` across `problems`, `solutions`, `architectures`,
> `infrastructures`, and `apps` routers. `GET` routes remain unguarded.

---

## 4. User Model in MongoDB

### 4.1 Pydantic v2 Schemas — `server/schemas/auth.py`

```python
"""Auth-related pydantic v2 models."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from server.schemas.models import PyObjectId


class Role(str, Enum):
    """User roles, ordered by clearance level.

    Admin and SuperAdmin share permissions today but are modelled
    as distinct values for future divergence (goal doc §2).
    """

    READER = "reader"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


class RegisterRequest(BaseModel):
    """Payload for user registration."""

    email: str = Field(..., min_length=3, max_length=255)
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)


class TokenResponse(BaseModel):
    """OAuth2-style token response."""

    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Decoded JWT payload used as the 'current user' in dependencies."""

    sub: str
    email: str
    role: str
    exp: Optional[int] = None


class UserResponse(BaseModel):
    """Public-facing user representation (never includes hashed_password)."""

    id: PyObjectId = Field(alias="_id", serialization_alias="id")
    email: str
    username: str
    role: str

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        from_attributes=True,
    )
```

> **Note**: `EmailStr` requires `email-validator` (`uv add email-validator`).
> For MVP simplicity, a plain `str` with `min_length` validation is acceptable
> and avoids the extra dependency. The snippet above uses `str` for that reason.

### 4.2 MongoDB Collection + Index

In `server/database/client.py`, add:

```python
users_col = db["users"]
```

At startup (or via a migration script), create a unique index on `email`:

```python
await users_col.create_index("email", unique=True)
```

### 4.3 Document Shape in MongoDB

```json
{
  "_id": ObjectId("..."),
  "email": "admin@solutionplex.io",
  "username": "Admin",
  "hashed_password": "$argon2id$v=19$m=65536,t=3,p=1$...",
  "role": "admin",
  "created_at": ISODate("2026-07-14T00:00:00Z")
}
```

> **Security**: `hashed_password` is **never** returned via any API response.
> The `UserResponse` model deliberately omits it.

---

## 5. Frontend Auth

### 5.1 Token Storage Decision

| Approach | Security | Complexity | Suitability for Solutionplex |
|----------|----------|------------|------------------------------|
| `localStorage` | Vulnerable to XSS; tokens readable by any JS | Low | ✅ **Acceptable for internal MVP** |
| `HttpOnly cookie` | Immune to XSS; requires CSRF protection + backend cookie handling | High | Overkill for internal tool |
| In-memory + refresh token | Most secure; cleared on tab close | High | Future upgrade path |

**Recommendation for MVP**: Use `localStorage`. Solutionplex is an **internal**
knowledge base (not a public SaaS). The simplicity of `localStorage` keeps the
MVP lean. Document a future migration to `HttpOnly` cookies post-MVP.

### 5.2 JWT Decode (Zero Dependencies)

Decode the JWT payload client-side using the native `atob` API. No npm package
needed. This is for **UI gating only** — the server always re-validates.

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

### 5.3 Auth Context + Hooks — `client/src/auth/AuthContext.tsx`

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
import type { JwtPayload } from './jwtDecode';

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

### 5.4 `useRole` Hook — `client/src/auth/useRole.ts`

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

---

## 6. Protected Routes Without react-router

Solutionplex uses a custom `history.pushState` router in `App.tsx` with
`parseRoute()` and a `navigate()` helper. There is **no** `react-router`.

### 6.1 `RequireAuth` Wrapper

A component that wraps the entire authenticated app shell. If the user is not
logged in, it renders the Login page instead.

```tsx
// client/src/auth/RequireAuth.tsx

import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { LoginPage } from '../components/LoginPage';

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Wraps the app shell. Shows <LoginPage /> when unauthenticated.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading-screen">Loading…</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
```

### 6.2 `RequireRole` Guard

For route-level protection (e.g., future admin-only pages), a guard component
that redirects to an Unauthorized page when the role is insufficient:

```tsx
// client/src/auth/RequireRole.tsx

import type { ReactNode } from 'react';
import { useRole } from './useRole';

type UserRole = 'reader' | 'admin' | 'superadmin';

interface RequireRoleProps {
  minRole: UserRole;
  children: ReactNode;
  /** What to render when role is insufficient. Defaults to Unauthorized message. */
  fallback?: ReactNode;
}

/**
 * Guard that only renders children if the current user meets the minimum role.
 * Compatible with the custom pushState router — no react-router dependency.
 */
export function RequireRole({ minRole, children, fallback }: RequireRoleProps) {
  const { hasRole } = useRole();

  if (!hasRole(minRole)) {
    return fallback ?? (
      <div className="unauthorized-page">
        <h2>Unauthorized</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
```

### 6.3 Integration with `App.tsx`

```tsx
// In App.tsx — wrap the app body
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';

export function App() {
  // ... existing state ...

  return (
    <AuthProvider>
      <RequireAuth>
        <ToastProvider>
          <div className="app-container">
            {/* existing header, tabs, main content */}
          </div>
        </ToastProvider>
      </RequireAuth>
    </AuthProvider>
  );
}
```

> Since all tabs require at least `Reader` access, `RequireAuth` acts as the
> top-level gate. Individual `RequireRole` guards are used for future admin-only
> pages (e.g. user management). Mutation UI is handled via conditional rendering
> (§7 below).

---

## 7. Conditional UI (Hide/Disable by Role)

### 7.1 Recommendation

For Solutionplex MVP, **hide** mutation controls entirely for `Reader` rather
than disabling them. Rationale:
- Readers should not be distracted by actions they cannot perform.
- The app is internal — discoverability of hidden features is not a UX concern.
- Disabled buttons with no tooltip explanation cause frustration.

### 7.2 `<Can>` Helper Component

```tsx
// client/src/auth/Can.tsx

import type { ReactNode } from 'react';
import { useRole } from './useRole';

type UserRole = 'reader' | 'admin' | 'superadmin';

interface CanProps {
  /** Minimum role required to see children. Defaults to 'admin'. */
  minRole?: UserRole;
  children: ReactNode;
}

/**
 * Declarative role gate. Renders children only if the current user
 * meets the minimum role clearance.
 *
 * @example
 * <Can>
 *   <button onClick={handleDelete}>Delete</button>
 * </Can>
 *
 * <Can minRole="superadmin">
 *   <AdminPanel />
 * </Can>
 */
export function Can({ minRole = 'admin', children }: CanProps) {
  const { hasRole } = useRole();
  if (!hasRole(minRole)) return null;
  return <>{children}</>;
}
```

### 7.3 Usage in Existing Components

```tsx
// In ProblemsTab.tsx or DetailView.tsx
import { Can } from '../auth/Can';

// Hide the Create button for Readers
<Can>
  <button className="create-btn" onClick={openCreateModal}>
    + New Problem
  </button>
</Can>

// Hide Delete button for Readers
<Can>
  <DeleteButton onDelete={() => handleDelete(id)} />
</Can>

// Future: SuperAdmin-only controls
<Can minRole="superadmin">
  <UserManagementPanel />
</Can>
```

### 7.4 Imperative Alternative

For inline conditional logic (e.g. inside `map` callbacks), use the hook
directly:

```tsx
const { canWrite } = useRole();

return (
  <div className="card-actions">
    {canWrite && <button onClick={handleEdit}>Edit</button>}
    {canWrite && <button onClick={handleDelete}>Delete</button>}
  </div>
);
```

---

## 8. @tanstack/react-query — Auth Header Integration

### 8.1 Modify the API Client

The existing `client/src/api/client.ts` uses a `request<T>()` wrapper around
`fetch`. The cleanest approach is to inject the `Authorization` header there:

```typescript
// client/src/api/client.ts — modified request() function

const TOKEN_KEY = 'sp_access_token';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or invalid — clear and redirect to login
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const errorMsg = await response.text();
    throw new Error(errorMsg || `API request failed with status ${response.status}`);
  }

  try {
    const data: T = await response.json();
    return data;
  } catch {
    throw new Error('Server returned a non-JSON response. Is the API server running?');
  }
}
```

### 8.2 Cache Invalidation on Logout

When the user logs out, wipe the entire react-query cache to prevent stale
data from leaking to the next session:

```typescript
// In your logout handler (AuthContext or a top-level component)
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

const handleLogout = () => {
  logout();                 // AuthContext.logout() — clears localStorage + state
  queryClient.clear();      // Wipes ALL cached queries
};
```

> **Why `clear()` not `invalidateQueries()`?**
> `invalidateQueries()` marks data as stale and triggers a refetch — which would
> fail with 401 since the token is gone. `clear()` removes all data immediately.

### 8.3 Add Auth API Methods

```typescript
// Append to client/src/api/client.ts

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

---

## 9. Testing

### 9.1 Tooling

| Tool | Purpose |
|------|---------|
| `pytest` + `pytest-asyncio` | Async test execution |
| `httpx.AsyncClient` + `ASGITransport` | Test FastAPI app without real server |
| `app.dependency_overrides` | Mock `get_current_user` / MongoDB |
| `unittest.mock.patch` | Mock `datetime` for token expiry tests |

### 9.2 Fixtures — `server/tests/conftest.py`

```python
"""Shared test fixtures for auth testing."""

import pytest
from httpx import ASGITransport, AsyncClient

from server.auth.dependencies import get_current_user
from server.auth.jwt import create_access_token
from server.main import app
from server.schemas.auth import TokenPayload


def make_token(role: str = "reader", sub: str = "test-user-id") -> str:
    """Create a test JWT with the given role."""
    return create_access_token({"sub": sub, "email": "test@example.com", "role": role})


def make_user_override(role: str = "reader"):
    """Return an async dependency override for get_current_user."""
    async def _override():
        return TokenPayload(sub="test-user-id", email="test@example.com", role=role)
    return _override


@pytest.fixture
async def client():
    """Async HTTP client for testing FastAPI routes."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def override_reader():
    """Override auth to simulate a Reader user."""
    app.dependency_overrides[get_current_user] = make_user_override("reader")
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def override_admin():
    """Override auth to simulate an Admin user."""
    app.dependency_overrides[get_current_user] = make_user_override("admin")
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def no_auth():
    """Clear any auth overrides (unauthenticated requests)."""
    app.dependency_overrides.pop(get_current_user, None)
    yield
    app.dependency_overrides.clear()
```

### 9.3 Route Guard Tests — `server/tests/test_auth_guards.py`

```python
"""Tests for RBAC route guards (401 / 403 behavior)."""

import pytest

pytestmark = pytest.mark.asyncio


async def test_create_problem_unauthenticated_returns_401(client, no_auth):
    """Unauthenticated POST to a protected route must return 401."""
    response = await client.post(
        "/api/problems/",
        json={"title": "Test", "description": "Test desc"},
    )
    assert response.status_code == 401


async def test_create_problem_reader_returns_403(client, override_reader):
    """Reader attempting a mutation must receive 403."""
    response = await client.post(
        "/api/problems/",
        json={"title": "Test", "description": "Test desc"},
    )
    assert response.status_code == 403


async def test_create_problem_admin_succeeds(client, override_admin):
    """Admin should be allowed to create resources."""
    # Note: This test also needs a MongoDB mock/override for the service layer.
    # Shown here to demonstrate the auth guard passes; full integration
    # tests would mock the database.
    response = await client.post(
        "/api/problems/",
        json={"title": "Test", "description": "Test desc"},
    )
    # 201 (success) or 500 (DB not mocked) — but NOT 401/403
    assert response.status_code != 401
    assert response.status_code != 403


async def test_list_problems_reader_succeeds(client, override_reader):
    """Readers must be able to access GET (list) routes."""
    response = await client.get("/api/problems/")
    assert response.status_code != 401
    assert response.status_code != 403
```

### 9.4 Token Expiry Testing

Use `unittest.mock.patch` to freeze time and test expired tokens:

```python
"""Tests for JWT expiry handling."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from server.auth.jwt import create_access_token, decode_access_token

pytestmark = pytest.mark.asyncio


def test_expired_token_raises():
    """Tokens with exp in the past must raise ExpiredSignatureError."""
    import jwt as pyjwt

    token = create_access_token({
        "sub": "user-1",
        "email": "test@example.com",
        "role": "reader",
    })

    # Fast-forward time past expiry
    future = datetime.now(timezone.utc) + timedelta(hours=2)
    with patch("jwt.api_jwt.datetime") as mock_dt:
        mock_dt.now.return_value = future
        mock_dt.side_effect = lambda *args, **kwargs: datetime(*args, **kwargs)
        with pytest.raises(pyjwt.ExpiredSignatureError):
            decode_access_token(token)
```

> **Alternative**: Create a token with a negative TTL directly
> (e.g. `jwt_expire_minutes=-1` in a test settings override) for a simpler
> approach that avoids datetime mocking entirely.

---

## Risks & Deviations from AGENTS.md

| Item | Risk / Deviation | Mitigation |
|------|-------------------|------------|
| `pydantic EmailStr` | Requires `email-validator` dep | Use plain `str` with `min_length` for MVP |
| `localStorage` for tokens | Vulnerable to XSS | Acceptable for internal app; document upgrade path to `HttpOnly` cookies |
| No refresh token (MVP) | 60-min session, then re-login | Sufficient for internal tool; add refresh endpoint post-MVP |
| `passlib` excluded | Breaks from older FastAPI tutorials | Aligned with 2026 FastAPI docs; `pwdlib` is the official replacement |
| `python-jose` excluded | Breaks from older FastAPI tutorials | `PyJWT` is now officially recommended |
| `OAuth2PasswordRequestForm` uses `username` field for email | Minor semantic mismatch | Document in API docs; standard OAuth2 convention |
| No new frontend npm packages | Atypical (many tutorials add `jwt-decode`) | Native `atob` is zero-dependency and sufficient |

---

## References

- [FastAPI Security Tutorial (2026)](https://fastapi.tiangolo.com/tutorial/security/)
- [PyJWT Documentation](https://pyjwt.readthedocs.io/)
- [pwdlib on PyPI](https://pypi.org/project/pwdlib/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [TanStack React Query — Auth Patterns](https://tanstack.com/query/latest)
- Solutionplex PRD: `docs/foundation/goal.md`
- Solutionplex RBAC Goal: `docs/rbac/goal.md`
