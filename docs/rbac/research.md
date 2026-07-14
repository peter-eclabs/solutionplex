# RBAC Research — Solutionplex (FastAPI + React)

**Date:** July 2026
**Author:** Researcher Agent (MAW)
**Audience:** Planner / Backend / Frontend implementation agents

This document consolidates current (2026) best practices for Role-Based Access
Control and provides copy-pasteable snippets adapted to the existing Solutionplex
codebase. It covers backend auth libraries, the FastAPI JWT flow, reusable
role dependencies, the MongoDB user model, the React auth store, protected
routing on the custom `history.pushState` router, conditional UI, react-query
header wiring, and a pytest testing strategy.

> **Reading order for implementers:** read §10 (Recommended Stack) for the final
> library picks, then the per-task sections for the snippets.

---

## 1. Backend auth libraries (JWT + password hashing)

### Recommendation
Use **PyJWT** for JWT and **pwdlib (Argon2)** for password hashing. Both are the
current choices recommended by the **FastAPI official documentation as of 2026**
(the docs migrated away from `python-jose` and `passlib`).

- **JWT — `PyJWT` (`pyjwt`) ≥ 2.13.0.** The de-facto standard (100M+ monthly
  downloads). In 2.13.0 (May 2026) empty/missing HMAC keys now raise
  (`InvalidKeyError`), and `algorithms` pinning is enforced — exactly the
  hardening we want. Always pass `algorithms=["HS256"]` (or `RS256`) at decode
  time to defeat `alg:none` / algorithm-confusion attacks.
- **Password hashing — `pwdlib[argon2]` (Argon2id).** Argon2 won the Password
  Hashing Competition and is the modern default. `pwdlib` is the drop-in
  replacement for the dead `passlib` that FastAPI now recommends.

### ⚠️ `passlib` / `bcrypt` pitfalls in 2026 (do NOT use)
- `passlib` has been **unmaintained since Oct 2020**. The `passlib[bcrypt]`
  backend **breaks with `bcrypt>=5.0.0`** (released 2025-09-25): even a 10-byte
  password raises `ValueError: password cannot be longer than 72 bytes`. The root
  cause is `bcrypt 5.0.0` removing the `__about__` attribute that `passlib` used
  for backend detection. Pinning `bcrypt==4.3.0` is a band-aid only.
- If you must stay on bcrypt (not recommended), call `bcrypt.hashpw` /
  `bcrypt.checkpw` **directly** — do not go through `CryptContext`. But Argon2
  via `pwdlib` is the cleaner, future-proof choice and avoids the whole bcrypt
  maintenance mess.

```toml
# server/pyproject.toml — new dependencies (add to [project].dependencies)
"pyjwt>=2.13.0",
"pwdlib[argon2]>=1.1.0",
"python-multipart>=0.0.20",   # required for OAuth2PasswordRequestForm (login)
```

```python
# server/security/passwords.py
"""Password hashing helpers using pwdlib (Argon2id)."""
import logging

from pwdlib import PasswordHash

logger = logging.getLogger(__name__)

# Argon2id is the OWASP-recommended default; pwdlib picks sane parameters.
_pwd = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Hash a plaintext password; never store the plaintext."""
    return _pwd.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored Argon2 hash."""
    try:
        return _pwd.verify(plain_password, hashed_password)
    except Exception:
        logger.exception("Password verification failed")
        return False
```

---

## 2. FastAPI JWT flow

### Recommendation
- Use the **OAuth2 password flow** with `OAuth2PasswordBearer` for the login
  endpoint. This gives you a free "Authorize" button in `/docs` and automatic
  `401` when the `Authorization: Bearer` header is missing.
- Return a plain JSON `{access_token, token_type:"bearer"}` body (the standard
  shape). For an MVP, a **single short-lived access token** (15–30 min) is
  acceptable; design the token factory so a refresh token can be added later
  (rotating, server-side tracked) without rework.
- Embed `sub` (user id), `email`, and `role` in the payload. Treat all claims as
  **readable by the client** — never put secrets in the payload.
- Sign with **HS256** (symmetric) for an MVP single-service app. If multiple
  services verify tokens later, switch to **RS256** + `aud`/`iss` validation.
- Always `algorithms=[...]` at decode; PyJWT auto-validates `exp`.

### Settings additions
```python
# server/config.py
from datetime import timedelta

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "solutionplex"

    # --- Auth (MUST come from environment / .env, never hard-coded) ---
    jwt_secret: str = "CHANGE_ME_IN_PROD"          # set JWT_SECRET in .env
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
```

> Add `JWT_SECRET`, `JWT_ALGORITHM` (optional), `ACCESS_TOKEN_EXPIRE_MINUTES`
> (optional) to `server/.env`. The existing `server/.env` already holds
> `MONGODB_URL` / `MONGODB_DB`; follow the same pattern. **Never commit `.env`.**

### Token factory + decoder
```python
# server/security/jwt.py
"""JWT creation and verification helpers (PyJWT)."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import jwt

from server.config import settings

logger = logging.getLogger(__name__)


def create_access_token(
    *,
    subject: str,
    email: str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT embedding sub, email, and role claims."""
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload: Dict[str, Any] = {
        "sub": subject,
        "email": email,
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and verify a JWT. Raises jwt.InvalidTokenError on any failure."""
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],   # pin! prevents alg:none attacks
    )
```

### Login endpoint (OAuth2 password bearer style)
```python
# server/routers/auth.py
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from server.security.jwt import create_access_token
from server.security.passwords import verify_password
from server.services import users as user_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/token", summary="Login and obtain an access token")
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    user = await user_service.get_user_by_email(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(
        subject=str(user["_id"]),
        email=user["email"],
        role=user["role"],
    )
    return {"access_token": token, "token_type": "bearer"}
```

> **Public endpoints** (no guard): `GET /`, `POST /api/auth/register`,
> `POST /api/auth/token`. Everything else that mutates requires a role.

---

## 3. Role-based dependencies (`get_current_user`, `require_role`)

### Recommendation
Follow the **layered dependency** pattern (2026 best practice):
1. `oauth2_scheme` extracts the bearer token (auto-`401` if absent).
2. `get_current_user` decodes the JWT and returns a `CurrentUser` (raises `401`
   on invalid/expired/missing claims).
3. `require_role(min_role)` composes `get_current_user` and raises **`403`** when
   the user's clearance is below `min_role`, **`401`** when unauthenticated.

Use a `Role` `str`-`Enum` with an explicit rank so `Admin` and `SuperAdmin`
remain distinct values (per `goal.md` §2) while sharing clearance today.

```python
# server/schemas/models.py — add to the existing models module
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Role(str, Enum):
    READER = "reader"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


ROLE_RANK: dict[Role, int] = {
    Role.READER: 1,
    Role.ADMIN: 2,
    Role.SUPERADMIN: 3,
}


class CurrentUser(BaseModel):
    """Lightweight principal injected by auth dependencies."""
    id: str
    email: str
    role: Role


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
```

```python
# server/security/deps.py
"""Reusable FastAPI auth dependencies."""
import logging
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from server.schemas.models import CurrentUser, Role, ROLE_RANK
from server.security.jwt import decode_token

logger = logging.getLogger(__name__)

# tokenUrl matches the login route declared in server/routers/auth.py
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> CurrentUser:
    """Decode the JWT and return the authenticated principal.

    Raises 401 on missing/invalid/expired tokens or missing claims.
    """
    try:
        payload = decode_token(token)
        subject = payload.get("sub")
        email = payload.get("email")
        role_raw = payload.get("role")
        if subject is None or email is None or role_raw is None:
            raise _credentials_exc
        role = Role(role_raw)
    except (jwt.InvalidTokenError, ValueError):
        raise _credentials_exc
    return CurrentUser(id=subject, email=email, role=role)


def require_role(min_role: Role):
    """Dependency factory: enforce a minimum clearance level.

    Returns the CurrentUser when cleared; raises 403 when under-cleared
    and 401 (via get_current_user) when unauthenticated.
    """
    def checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if ROLE_RANK[current_user.role] < ROLE_RANK[min_role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role clearance for this action",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return current_user
    return checker
```

> Re-raise `HTTPException` untouched (per AGENTS.md). The `Depends` result cache
> means `get_current_user` runs once per request even when composed — no extra
> DB hit.

### Applying the guard to a mutation route
```python
# server/routers/architectures.py (excerpt) — gate POST/PUT/DELETE
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from server.schemas.models import (
    ArchitectureCreate,
    ArchitectureResponse,
    ArchitectureUpdate,
    CurrentUser,
    Role,
)
from server.security.deps import require_role
from server.services import architectures as service

router = APIRouter(prefix="/api/architectures", tags=["Architecture"])

# Reads stay open to Reader (no dependency). e.g. list_architectures() unchanged.

@router.post(
    "/",
    response_model=ArchitectureResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(Role.ADMIN))],
    summary="Create a new Architecture design",
)
async def create_architecture(data: ArchitectureCreate):
    ...  # body unchanged


@router.put(
    "/{id}",
    response_model=ArchitectureResponse,
    dependencies=[Depends(require_role(Role.ADMIN))],
    summary="Update an Architecture card",
)
async def update_architecture(id: str, data: ArchitectureUpdate):
    ...


@router.delete(
    "/{id}",
    dependencies=[Depends(require_role(Role.ADMIN))],
    summary="Delete an Architecture card",
)
async def delete_architecture(id: str):
    ...
```

> `dependencies=[...]` on the decorator is the cleanest way to enforce a role
> without changing the handler signature — exactly the pattern in `goal.md` §3.3.
> Apply the same `require_role(Role.ADMIN)` decorator dependency to all
> `POST/PUT/DELETE` routes in `problems`, `solutions`, `architectures`,
> `infrastructures`, `apps`. Reads (`GET`) remain unguarded (Reader-clearable).

---

## 4. User model in MongoDB (pydantic v2 + Motor)

### Recommendation
- Add a `users` collection (Motor via `server/database/client.py`).
- Store `hashed_password` **never plaintext**. Mandatory `role` field defaulting
  to `reader`. Unique index on `email`.
- Use pydantic v2 models; reuse the `PyObjectId` pattern already in
  `server/schemas/models.py`.

```python
# server/schemas/models.py — additions
from datetime import datetime

from server.schemas.models import PyObjectId  # existing alias (defined above)


class UserCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: Role = Role.READER   # default per goal.md §3.1


class UserInDB(BaseModel):
    id: PyObjectId = Field(alias="_id", serialization_alias="id")
    email: str
    hashed_password: str
    role: Role = Role.READER
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        from_attributes=True,
    )


class UserResponse(BaseModel):
    id: str
    email: str
    role: Role
    created_at: datetime
```

```python
# server/database/client.py — add the collection
users_col = db["users"]


async def ensure_indexes() -> None:
    """Create unique index on email once at startup."""
    await users_col.create_index("email", unique=True)
```

```python
# server/services/users.py
import logging

from motor.motor_asyncio import AsyncIOMotorClient

from server.config import settings
from server.database.client import users_col
from server.schemas.models import Role, UserCreate, UserInDB
from server.security.passwords import hash_password

logger = logging.getLogger(__name__)


async def create_user(data: UserCreate) -> UserInDB:
    """Insert a new user with a hashed password; role defaults to reader."""
    doc = {
        "email": data.email,
        "hashed_password": hash_password(data.password),
        "role": data.role.value,   # Role.READER unless overridden
    }
    result = await users_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return UserInDB.model_validate(doc)


async def get_user_by_email(email: str) -> dict | None:
    """Return the raw document (with hashed_password) or None."""
    return await users_col.find_one({"email": email})
```

```python
# server/routers/auth.py — registration (public)
from server.schemas.models import UserCreate, UserResponse
from server.services import users as user_service


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user (defaults to Reader)",
)
async def register(data: UserCreate):
    try:
        user = await user_service.create_user(data)
        return UserResponse(
            id=str(user.id),
            email=user.email,
            role=user.role,
            created_at=user.created_at,
        )
    except Exception as e:
        # E11000 duplicate key -> email already exists
        logger.exception("Registration failed")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from e
```

---

## 5. Frontend auth (React 19 + TypeScript strict)

### Recommendation
- **Decode the JWT client-side** with `atob` + `JSON.parse` on the `payload`
  segment. No secret is needed for decoding (it's just base64). Treat the decoded
  role as **UI-gating only** — the backend is the source of truth (it re-checks
  every request).
- **Token storage trade-off:**
  - **`localStorage`** (recommended for this MVP): simplest, enables client-side
    decode + instant role gating, survives refresh. Caveat: vulnerable to XSS.
    Mitigate by keeping the token short-lived and avoiding `dangerouslySetInnerHTML`
    / untrusted `marked` rendering of user content.
  - **`httpOnly` cookie** (more secure, production-grade): immune to XSS token
    theft, but requires `SameSite=Lax`/`Secure` + CORS `allow_credentials` (already
    enabled on the backend) and makes client-side decode impossible (cookie is
    not readable by JS). Use this only if you accept losing in-browser role decode
    and instead fetch `/api/auth/me`.
- For an MVP that satisfies `goal.md` §3.2 ("frontend decodes JWT client-side"),
  **use `localStorage`** and decode the payload. Document the XSS caveat.

### JWT decode helper
```typescript
// client/src/auth/jwt.ts
export interface JwtPayload {
  sub: string;
  email: string;
  role: 'reader' | 'admin' | 'superadmin';
  exp: number;
  iat: number;
}

/** Decode (NOT verify) a JWT payload. Safe for UI gating only. */
export function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload) as JwtPayload;
  } catch {
    return null;
  }
}

export function isExpired(payload: JwtPayload): boolean {
  return payload.exp * 1000 < Date.now();
}
```

### Auth context + hooks (`useAuth`, `useRole`)
```typescript
// client/src/auth/AuthContext.tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { decodeJwt, isExpired, type JwtPayload } from './jwt';

const TOKEN_KEY = 'solutionplex_token';

interface AuthState {
  token: string | null;
  user: JwtPayload | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const user = useMemo<JwtPayload | null>(() => {
    if (!token) return null;
    const decoded = decodeJwt(token);
    if (!decoded || isExpired(decoded)) return null;
    return decoded;
  }, [token]);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  const login = (newToken: string) => setToken(newToken);
  const logout = () => setToken(null);

  const value = useMemo<AuthState>(
    () => ({ token, user, login, logout, isAuthenticated: user !== null }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

const ROLE_RANK: Record<string, number> = { reader: 1, admin: 2, superadmin: 3 };

export function useRole() {
  const { user } = useAuth();
  const role = user?.role ?? 'reader';
  return {
    role,
    canWrite: (ROLE_RANK[role] ?? 0) >= ROLE_RANK['admin'],
    canManage: (ROLE_RANK[role] ?? 0) >= ROLE_RANK['superadmin'],
    isReader: role === 'reader',
  };
}

// Add this near the top of App.tsx (inside <ToastProvider>):
//   <AuthProvider> ... </AuthProvider>
```

---

## 6. Protected routes without react-router

### Recommendation
The app uses a custom `history.pushState` router in `App.tsx` (`navigate`,
`parseRoute`, `currentPath` state). There is no route guard library, so we add a
small guard helper that **checks the decoded role before navigating** and
**redirects to `/unauthorized`** when clearance is insufficient. This composes
with the existing `navigate()` function.

```typescript
// client/src/auth/guards.tsx
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useRole } from './AuthContext';

type RoleName = 'reader' | 'admin' | 'superadmin';

const ROLE_RANK: Record<RoleName, number> = { reader: 1, admin: 2, superadmin: 3 };

/** Guard a click/navigation: only proceed if the current role clears minRole. */
export function canNavigate(minRole: RoleName): boolean {
  const { user } = useAuth();
  const role = (user?.role ?? 'reader') as RoleName;
  return (ROLE_RANK[role] ?? 0) >= ROLE_RANK[minRole];
}

/**
 * Wraps mutation UI. Renders nothing (or a fallback) when the user lacks
 * clearance — instead of navigating to a forbidden create/edit view.
 */
export function RequireRole({
  minRole,
  onDenied,
  children,
}: {
  minRole: RoleName;
  onDenied?: () => void;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const role = (user?.role ?? 'reader') as RoleName;
  if ((ROLE_RANK[role] ?? 0) >= ROLE_RANK[minRole]) return <>{children}</>;
  return (
    <button type="button" onClick={() => onDenied?.()}>
      Access denied
    </button>
  );
}
```

### Wire into `App.tsx`
```tsx
// Inside App(): add an /unauthorized route to parseRoute-aware navigation.
const navigateGuarded = (to: string, minRole: RoleName = 'admin') => {
  if (canNavigate(minRole)) navigate(to);
  else navigate('/unauthorized');
};

// In the main-content switch, add an unauthorized view:
//   {currentPath === '/unauthorized' ? (
//     <UnauthorizedView onNavigate={navigate} />
//   ) : routeInfo ? ( ... ) : ( ... )}

// tab components receive navigateGuarded so "Create" buttons call it:
//   <ProblemsTab
//     searchQuery={searchQuery}
//     onCardClick={(id) => navigate(`/problems/${id}`)}
//     onNavigate={navigateGuarded}
//   />
```

> This preserves the existing `parseRoute`/tab structure — we only add an
> `/unauthorized` destination and a guarded navigation helper. No router library
> is introduced, keeping the frontend consistent with `AGENTS.md` / `goal.md` §4.4.

---

## 7. Conditional UI (hide/disable Create/Edit/Delete)

### Recommendation
Expose a tiny `<Can action="write">` helper (or rely on `useRole().canWrite`)
and gate the existing mutation controls in tab components, `DetailView.tsx`,
`CreateAppModal.tsx`, and `DeleteButton.tsx`. This satisfies `goal.md` §4.2.

```typescript
// client/src/auth/Can.tsx
import type { ReactNode } from 'react';
import { useRole } from './AuthContext';

/** Renders children only if the current role can perform `action`. */
export function Can({
  action,
  children,
}: {
  action: 'read' | 'write' | 'manage';
  children: ReactNode;
}) {
  const { canWrite, canManage } = useRole();
  const allowed = action === 'read' ? true : action === 'write' ? canWrite : canManage;
  return allowed ? <>{children}</> : null;
}
```

Usage in any tab component (e.g. `ProblemsTab`):
```tsx
<Can action="write">
  <button type="button" onClick={() => onNavigate('/problems/new', 'admin')}>
    + New Problem
  </button>
</Can>
```
Or disable instead of hide (keyboard/AT friendly):
```tsx
const { canWrite } = useRole();
<button type="button" disabled={!canWrite} onClick={openCreate}>
  + New Problem
</button>
```

---

## 8. @tanstack/react-query — attach `Authorization` header

### Recommendation
Centralize the bearer header in the API client's `request` helper. Read the token
from the auth store (`localStorage`) so every query/mutation is authenticated.
On logout, clear the token and **invalidate all queries** so cached data is
refetched (or dropped) for the next user.

```typescript
// client/src/api/client.ts — patch the `request` helper
const TOKEN_KEY = 'solutionplex_token';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!response.ok) {
    const errorMsg = await response.text();
    throw new Error(errorMsg || `API request failed with status ${response.status}`);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error('Server returned a non-JSON response. Is the API server running?');
  }
}
```

```typescript
// On logout (e.g. in a LogoutButton or after 401):
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

function useLogout() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  return () => {
    logout();                       // clears token from localStorage + state
    queryClient.invalidateQueries(); // drop cached entity data
  };
}
```

> The `api` object's existing method signatures don't change — the header is
> added transparently. Reads by `Reader` simply include a valid token; the
> backend allows them.

---

## 9. Testing (pytest + pytest-asyncio)

### Recommendation
- Use `fastapi.testclient.TestClient` (or `httpx.ASGITransport` + `AsyncClient`)
  with `app` from `server.main`.
- Mock the MongoDB layer by monkeypatching `server.database.client.users_col`
  (and the entity collections) with an in-memory fake, or use `monkeypatch` on the
  `user_service` functions. Keep tests deterministic and offline.
- Test the **guard matrix** per endpoint: anonymous → `401`, `Reader` → `403`,
  `Admin` → `200`.
- Use `freezegun` (or `monkeypatch` on `datetime`) to assert expired-token →
  `401`.

```python
# server/tests/test_rbac_guards.py
import logging
from typing import AsyncGenerator

import pytest
from fastapi.testclient import TestClient

from server.main import app
from server.security.jwt import create_access_token

logger = logging.getLogger(__name__)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _token(role: str, subject: str = "64f3b8c2e4b0c5a1d2e3f400") -> str:
    return create_access_token(subject=subject, email="u@example.com", role=role)


def test_create_architecture_requires_auth(client: TestClient) -> None:
    resp = client.post("/api/architectures/", json={"title": "x", "description": "y"})
    assert resp.status_code == 401


def test_create_architecture_reader_forbidden(client: TestClient) -> None:
    headers = {"Authorization": f"Bearer {_token('reader')}"}
    resp = client.post(
        "/api/architectures/", json={"title": "x", "description": "y"}, headers=headers
    )
    assert resp.status_code == 403


def test_create_architecture_admin_ok(client: TestClient) -> None:
    headers = {"Authorization": f"Bearer {_token('admin')}"}
    resp = client.post(
        "/api/architectures/", json={"title": "x", "description": "y"}, headers=headers
    )
    # 201 if DB layer mocked; here we only assert the guard passed (not 401/403)
    assert resp.status_code in (201, 500)


def test_expired_token_rejected(client: TestClient) -> None:
    from datetime import timedelta

    expired = create_access_token(
        subject="s", email="e@x.com", role="admin", expires_delta=timedelta(minutes=-5)
    )
    resp = client.post(
        "/api/architectures/",
        json={"title": "x", "description": "y"},
        headers={"Authorization": f"Bearer {expired}"},
    )
    assert resp.status_code == 401
```

> `pytest-asyncio` is already in `server/pyproject.toml` dev deps. Mark async
> tests with `@pytest.mark.asyncio`. For DB mocking, patch
> `server.services.architectures.create_architecture` etc. via `monkeypatch`.

---

## 10. Recommended Stack (libraries to add)

| Layer | Concern | Library (2026) | Version | Notes |
|-------|---------|----------------|---------|-------|
| Backend | JWT encode/decode | `PyJWT` | ≥ 2.13.0 | FastAPI-official choice; pin `algorithms` |
| Backend | Password hashing | `pwdlib[argon2]` | ≥ 1.1.0 | Argon2id; replaces dead `passlib` |
| Backend | OAuth2 form login | `python-multipart` | ≥ 0.0.20 | Required by `OAuth2PasswordRequestForm` |
| Backend | Token tests | `freezegun` | ≥ 1.5 | Expiry tests (dev) |
| Frontend | JWT decode | native `atob`/`JSON.parse` | — | No extra dep; or optional `jwt-decode` ≥ 4 |
| Frontend | State | React context (built-in) | — | `AuthProvider` + `useAuth`/`useRole` |
| Frontend | Data | `@tanstack/react-query` | (existing) | Header via `request` wrapper |

**Do NOT add:** `python-jose`, `passlib`, `PyJWT<2.13`.

---

## 11. Risks & Deviations from AGENTS.md / conventions

1. **`python-multipart`** is a new runtime dependency (needed for
   `OAuth2PasswordRequestForm`). Acceptable; documented in §10.
2. **`pwdlib`** is not in `AGENTS.md`'s dependency list (which predates the
   `passlib`→`pwdlib` migration). This is a justified deviation: `passlib` is
   unmaintained and broken with current `bcrypt`. Recorded here intentionally.
3. **`localStorage` for tokens** deviates from the strictest 2026 guidance
   (httpOnly cookies preferred). We choose `localStorage` to satisfy the
   client-side role-decode requirement in `goal.md` §3.2 for the MVP, and note
   the XSS caveat in §5. Switch to httpOnly + `/api/auth/me` if threat model
   tightens.
4. **JWT `role` is client-trusted for UI only.** All enforcement happens backend-
   side via `require_role`; the decoded frontend role never grants access — it
   only hides buttons. This matches `goal.md` §3.2 intent.
5. **No refresh tokens in MVP.** Access token TTL = 30 min (configurable).
   Refresh rotation is designed-for but out of MVP scope (see §2).
6. **HS256 symmetric signing** for single-service MVP. If a second verifying
   service appears, migrate to RS256 + `aud`/`iss` validation (per 2026 guidance).
7. **Secrets:** `JWT_SECRET` added to `server/.env` (not committed). `config.py`
   keeps a `"CHANGE_ME_IN_PROD"` placeholder default so dev works without a
   secret but prod fails loudly if unset. Never log the secret.
8. **Index creation** (`ensure_indexes`) should be called once at startup
   (e.g. in `main.py` lifespan) — not per request. Add a startup hook when
   implementing Phase 1.

---

## 12. Implementation phases (mirrors `goal.md` §7)

- **Phase 1 — Backend Auth Foundation:** `config.py` secrets, `security/passwords.py`,
  `security/jwt.py`, `security/deps.py`, `Role` enum + user models, `users_col`,
  `routers/auth.py` (register/login), `ensure_indexes` startup hook.
- **Phase 2 — Backend Route Guards:** add `dependencies=[Depends(require_role(Role.ADMIN))]`
  to all mutation routes; tests from §9.
- **Phase 3 — Frontend Auth:** `AuthProvider`, `useAuth`/`useRole`, `jwt.ts`, login +
  register views, `request` header wiring.
- **Phase 4 — Frontend Protection & Conditional UI:** `RequireRole`/`Can`, hide/disable
  Create/Edit/Delete, `/unauthorized` redirect, guarded navigation.
