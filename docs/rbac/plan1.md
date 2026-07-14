# Phase 1 — Backend Auth Foundation

**Objective:** Stand up the entire JWT-based authentication layer: user model, password hashing, token creation/verification, auth dependencies (`get_current_user`, `RequireRole`), registration & login endpoints, and a `users` MongoDB collection with a unique email index.

---

## Dependencies to Add

```bash
cd server
uv add pyjwt "pwdlib[argon2]" python-multipart
```

Adds to `server/pyproject.toml`:
- `pyjwt>=2.10` — JWT encode/decode (HS256)
- `pwdlib[argon2]>=0.2` — Argon2id password hashing
- `python-multipart>=0.0.20` — Required by `OAuth2PasswordRequestForm`

---

## Files to Create / Modify

### New Files

| File | Purpose |
|------|---------|
| `server/security/__init__.py` | Package init (empty) |
| `server/security/passwords.py` | Argon2id hash + verify helpers |
| `server/security/jwt.py` | `create_access_token` / `decode_access_token` |
| `server/security/deps.py` | `get_current_user`, `RequireRole` dependencies |
| `server/schemas/auth.py` | `Role` enum, `ROLE_RANK`, pydantic models |
| `server/routers/auth.py` | `/api/auth/register`, `/api/auth/login` |
| `server/services/users.py` | User lookup service (by email) |
| `server/tests/test_auth.py` | Unit tests for hashing, JWT, role logic |

### Modified Files

| File | Change |
|------|--------|
| `server/config.py` | Add `jwt_secret_key`, `jwt_algorithm`, `jwt_expire_minutes` |
| `server/database/client.py` | Add `users_col`, `ensure_indexes()` |
| `server/main.py` | Import auth router, add lifespan for `ensure_indexes` |
| `server/.env` | Add `JWT_SECRET_KEY` placeholder |
| `server/pyproject.toml` | New deps (via `uv add`) |

---

## Tests to Write BEFORE Implementation

### `server/tests/test_auth.py`

```python
"""Unit tests for auth foundation: passwords, JWT, role dependencies."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


# ── Password hashing ────────────────────────────────────────────

class TestPasswordHashing:
    """Tests for server.security.passwords module."""

    def test_hash_returns_argon2_string(self):
        """hash_password must return an Argon2id hash string."""
        from server.security.passwords import hash_password

        hashed = hash_password("test-password-123")
        assert hashed.startswith("$argon2id$")

    def test_verify_correct_password(self):
        """verify_password returns True for the original plaintext."""
        from server.security.passwords import hash_password, verify_password

        hashed = hash_password("correct-horse")
        assert verify_password("correct-horse", hashed) is True

    def test_verify_wrong_password(self):
        """verify_password returns False for a wrong plaintext."""
        from server.security.passwords import hash_password, verify_password

        hashed = hash_password("correct-horse")
        assert verify_password("wrong-horse", hashed) is False

    def test_hash_is_not_plaintext(self):
        """The hash must never equal the plaintext."""
        from server.security.passwords import hash_password

        plain = "my-secret"
        assert hash_password(plain) != plain


# ── JWT round-trip ───────────────────────────────────────────────

class TestJwt:
    """Tests for server.security.jwt module."""

    def test_encode_decode_roundtrip(self):
        """Encoding then decoding must recover the original claims."""
        from server.security.jwt import create_access_token, decode_access_token

        claims = {"sub": "user-1", "email": "a@b.com", "role": "admin"}
        token = create_access_token(claims)
        decoded = decode_access_token(token)
        assert decoded["sub"] == "user-1"
        assert decoded["email"] == "a@b.com"
        assert decoded["role"] == "admin"
        assert "exp" in decoded

    def test_expired_token_raises(self):
        """A token created with negative TTL must raise on decode."""
        import jwt as pyjwt
        from datetime import datetime, timedelta, timezone

        from server.config import settings
        import jwt

        payload = {
            "sub": "user-1",
            "email": "a@b.com",
            "role": "reader",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=10),
        }
        token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

        from server.security.jwt import decode_access_token

        with pytest.raises(pyjwt.ExpiredSignatureError):
            decode_access_token(token)

    def test_invalid_token_raises(self):
        """A garbage string must raise InvalidTokenError."""
        import jwt as pyjwt
        from server.security.jwt import decode_access_token

        with pytest.raises(pyjwt.InvalidTokenError):
            decode_access_token("not.a.token")


# ── RequireRole logic ────────────────────────────────────────────

class TestRequireRole:
    """Tests for the RequireRole callable dependency."""

    @pytest.mark.asyncio
    async def test_admin_passes_admin_check(self):
        """Admin user must pass a require_role('admin') check."""
        from server.security.deps import RequireRole
        from server.schemas.auth import TokenPayload

        guard = RequireRole("admin")
        user = TokenPayload(sub="u1", email="a@b.com", role="admin")
        result = await guard(user=user)
        assert result.role == "admin"

    @pytest.mark.asyncio
    async def test_superadmin_passes_admin_check(self):
        """SuperAdmin must pass an admin-level check (higher clearance)."""
        from server.security.deps import RequireRole
        from server.schemas.auth import TokenPayload

        guard = RequireRole("admin")
        user = TokenPayload(sub="u1", email="a@b.com", role="superadmin")
        result = await guard(user=user)
        assert result.role == "superadmin"

    @pytest.mark.asyncio
    async def test_reader_fails_admin_check(self):
        """Reader must be rejected by a require_role('admin') guard."""
        from server.security.deps import RequireRole
        from server.schemas.auth import TokenPayload

        guard = RequireRole("admin")
        user = TokenPayload(sub="u1", email="a@b.com", role="reader")
        with pytest.raises(HTTPException) as exc_info:
            await guard(user=user)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_reader_passes_reader_check(self):
        """Reader must pass a require_role('reader') check."""
        from server.security.deps import RequireRole
        from server.schemas.auth import TokenPayload

        guard = RequireRole("reader")
        user = TokenPayload(sub="u1", email="a@b.com", role="reader")
        result = await guard(user=user)
        assert result.role == "reader"


# ── ROLE_RANK ordering ───────────────────────────────────────────

class TestRoleRank:
    """Tests for the ROLE_RANK ordering."""

    def test_rank_ordering(self):
        """reader < admin < superadmin in numeric rank."""
        from server.schemas.auth import ROLE_RANK

        assert ROLE_RANK["reader"] < ROLE_RANK["admin"]
        assert ROLE_RANK["admin"] < ROLE_RANK["superadmin"]

    def test_all_roles_present(self):
        """All three roles must be in ROLE_RANK."""
        from server.schemas.auth import ROLE_RANK

        assert set(ROLE_RANK.keys()) == {"reader", "admin", "superadmin"}
```

---

## Step-by-Step Implementation

### Step 1 — `server/schemas/auth.py`

Create the auth-specific Pydantic models and Role enum. Place `ROLE_RANK` here as the single source of truth for role ordering.

```python
"""Auth-related Pydantic v2 models and role definitions."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from server.schemas.models import PyObjectId


class Role(str, Enum):
    """User roles, ordered by clearance level.

    Admin and SuperAdmin share permissions today but are modelled
    as distinct values for future divergence (goal doc §2).
    """

    READER = "reader"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


ROLE_RANK: dict[str, int] = {
    "reader": 0,
    "admin": 1,
    "superadmin": 2,
}


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

### Step 2 — `server/config.py` (MODIFY)

Add JWT settings to the existing `Settings` class:

```diff
 class Settings(BaseSettings):
     mongodb_url: str = "mongodb://localhost:27017"
     mongodb_db: str = "solutionplex"
+
+    # Auth / JWT
+    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION"
+    jwt_algorithm: str = "HS256"
+    jwt_expire_minutes: int = 60

     model_config = {
```

### Step 3 — `server/.env` (MODIFY)

Append placeholder JWT config:

```diff
 MONGODB_URL=...
 MONGODB_DB=...
+JWT_SECRET_KEY=CHANGE-ME-generate-a-random-64-char-secret
+JWT_ALGORITHM=HS256
+JWT_EXPIRE_MINUTES=60
```

### Step 4 — `server/security/__init__.py`

Empty file to make `server.security` a package.

### Step 5 — `server/security/passwords.py`

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

### Step 6 — `server/security/jwt.py`

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

### Step 7 — `server/security/deps.py`

```python
"""Reusable FastAPI auth dependencies for RBAC."""

import logging

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from server.schemas.auth import ROLE_RANK, TokenPayload
from server.security.jwt import decode_access_token

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


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
        """Check if user's role meets the minimum clearance.

        Args:
            user: The current authenticated user from JWT.

        Returns:
            The TokenPayload if authorized.

        Raises:
            HTTPException 403: If the user's role lacks clearance.
        """
        user_rank = ROLE_RANK.get(user.role, -1)
        required_rank = ROLE_RANK.get(self.min_role, 999)
        if user_rank < required_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' lacks clearance (requires '{self.min_role}')",
            )
        return user
```

### Step 8 — `server/database/client.py` (MODIFY)

Add `users_col` and `ensure_indexes()`:

```diff
 # Collections
 problems_col = db["problems"]
 solutions_col = db["solutions"]
 architectures_col = db["architectures"]
 infrastructures_col = db["infrastructures"]
 apps_col = db["apps"]
 counters_col = db["counters"]
+users_col = db["users"]
+
+
+async def ensure_indexes() -> None:
+    """Create required MongoDB indexes at application startup."""
+    await users_col.create_index("email", unique=True)
+    logger.info("MongoDB indexes ensured")
```

### Step 9 — `server/services/users.py`

```python
"""User service layer for auth operations."""

import logging
from typing import Any, Optional

from server.database.client import users_col

logger = logging.getLogger(__name__)


async def find_user_by_email(email: str) -> Optional[dict[str, Any]]:
    """Look up a user document by email.

    Args:
        email: The email to search for.

    Returns:
        The user document dict, or None if not found.
    """
    return await users_col.find_one({"email": email})
```

### Step 10 — `server/routers/auth.py`

```python
"""Authentication endpoints: register + login."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from server.database.client import users_col
from server.schemas.auth import RegisterRequest, TokenPayload, TokenResponse, UserResponse
from server.security.deps import get_current_user
from server.security.jwt import create_access_token
from server.security.passwords import hash_password, verify_password
from server.services.users import find_user_by_email

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
        existing = await find_user_by_email(data.email)
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
        user = await find_user_by_email(form.username)
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


@router.get(
    "/me",
    response_model=TokenPayload,
    summary="Get current user info",
    description="Returns the decoded JWT payload for the authenticated user.",
)
async def get_me(user: TokenPayload = Depends(get_current_user)):
    """Return the current authenticated user's token payload."""
    return user
```

### Step 11 — `server/main.py` (MODIFY)

Wire the auth router and add a lifespan for `ensure_indexes`:

```diff
+from contextlib import asynccontextmanager
+from collections.abc import AsyncIterator
+
 from fastapi import FastAPI
 from fastapi.middleware.cors import CORSMiddleware

 from server.routers import (
     apps,
     architectures,
+    auth,
     infrastructures,
     problems,
     search,
     solutions,
 )
+from server.database.client import ensure_indexes

 # Logging config
 logging.basicConfig(level=logging.INFO)
 logger = logging.getLogger(__name__)

+
+@asynccontextmanager
+async def lifespan(app: FastAPI) -> AsyncIterator[None]:
+    """Application lifespan: run startup tasks."""
+    await ensure_indexes()
+    yield
+

-app = FastAPI(
+app = FastAPI(
+    lifespan=lifespan,
     title="Solutionplex API",
     ...
 )

 # Include modular routers
+app.include_router(auth.router)
 app.include_router(problems.router)
```

### Step 12 — Update `server/tests/conftest.py`

Add `users_col` mock to the existing `mock_db` fixture:

```diff
     mock_db.apps = AsyncMock()
     mock_db.counters = AsyncMock()
+    mock_db.users = AsyncMock()

     # ... (existing cursor setup) ...

     monkeypatch.setattr("server.database.client.apps_col", mock_db.apps)
     monkeypatch.setattr("server.database.client.counters_col", mock_db.counters)
+    monkeypatch.setattr("server.database.client.users_col", mock_db.users)
```

---

## Verification

```bash
cd server
uv add pyjwt "pwdlib[argon2]" python-multipart
uv run pyright                 # Must pass with zero errors
uv run pytest tests/test_auth.py -v   # All auth tests green
uv run pytest                  # Full suite still passes
```

---

## Notes

- `OAuth2PasswordRequestForm` expects `username` + `password` form fields. We use the user's email as the `username` value. This keeps Swagger `/docs` working out-of-the-box.
- `hashed_password` is **never** returned via any API response — `UserResponse` deliberately omits it.
- The `ensure_indexes` lifespan creates a unique index on `users.email` at startup.
- Module layout uses `server/security/` (not `server/auth/`) to avoid a naming collision with `server/routers/auth.py`.
