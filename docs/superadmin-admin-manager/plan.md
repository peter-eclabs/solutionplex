# Superadmin Seeding & Admin Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also invoke `test-driven-development` before writing production code in each backend task.

**Goal:** Idempotently seed a hardcoded superadmin on startup, expose superadmin-only list/update-user APIs, and add an Admin Manager UI so superadmins can grant `admin` to existing users.

**Architecture:** Extend the existing RBAC stack. Seed runs in FastAPI `lifespan` after `ensure_indexes()`. Admin routes live under `/api/admin` with `require_role(Role.SUPERADMIN)`. Frontend reuses hashless pathname routing (`navigate` / `navigateGuarded`), `useRole().canManage`, and the shared `request()` bearer helper.

**Tech Stack:** FastAPI, Motor/MongoDB, Pydantic v2, Argon2id (`pwdlib`), React + TypeScript, existing JWT RBAC.

**Spec source:** `docs/superadmin-admin-manager/goal.md`

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `server/schemas/models.py` | Modify | Add `UserRoleUpdate` schema |
| `server/services/users.py` | Modify | Add `seed_superadmin`, `list_users`, `update_user_role`, `count_users_by_role` |
| `server/routers/admin.py` | Create | `GET /users`, `PATCH /users/{user_id}` superadmin-only |
| `server/main.py` | Modify | Call seed in lifespan; register admin router |
| `server/tests/conftest.py` | Modify | Mock `seed_superadmin` in lifespan like `ensure_indexes` |
| `server/tests/test_seed_superadmin.py` | Create | Seed idempotency unit tests |
| `server/tests/test_admin_api.py` | Create | Admin API auth + last-superadmin guard tests |
| `client/src/api/client.ts` | Modify | Add `adminApi.listUsers` / `adminApi.setRole` |
| `client/src/components/AdminManagerView.tsx` | Create | User list + Grant admin UI |
| `client/src/components/AdminManagerView.css` | Create | Styles matching blueprint theme |
| `client/src/App.tsx` | Modify | Admin manager button, `/admin` route guard + render |
| `client/src/App.css` | Modify | Header button styles for Admin manager |

No frontend test runner exists under `client/` — verify with `npm run lint` and `npm run build` only.

---

## Phase 0: Preconditions (read-only)

**Objective:** Confirm RBAC foundation is present before coding.

**Deliverable:** Worker has verified the files below exist and match the patterns cited in later phases.

**Files to read (do not modify):**
- `server/schemas/models.py` — `Role`, `UserResponse`, `UserInDB`
- `server/security/deps.py` — `require_role`, `get_current_user`
- `server/security/passwords.py` — `hash_password`
- `server/services/users.py` — `create_user`, `get_user_by_email`
- `server/main.py` — `lifespan`, router includes
- `server/tests/conftest.py` — `users_col` monkeypatch + `ensure_indexes` mock
- `client/src/App.tsx`, `client/src/auth/AuthContext.tsx`, `client/src/api/client.ts`

**Verification:**
```bash
# From repo root — these files must exist
Test-Path server/services/users.py, server/security/deps.py, client/src/auth/AuthContext.tsx
```
Expected: all `True`.

---

## Phase 1: Schema + seed + user service (backend)

**Objective:** Add `UserRoleUpdate`, seed the static superadmin idempotently, and provide list/update helpers used by the admin router.

**Deliverable:** Service functions + schema ready; seed callable from lifespan; tests green.

### Task 1.1: Failing tests for seed + service helpers

**Files:**
- Create: `server/tests/test_seed_superadmin.py`
- (Later) Modify: `server/services/users.py`, `server/schemas/models.py`, `server/main.py`, `server/tests/conftest.py`

- [ ] **Step 1: Write failing tests**

```python
"""Tests for superadmin seed and user admin service helpers."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from bson import ObjectId


SUPERADMIN_EMAIL = "peter.j@ecgroup-intl.com"
SUPERADMIN_PASSWORD = "Peter@123"


class TestSeedSuperadmin:
    """Idempotent seed_superadmin behaviour."""

    @pytest.mark.asyncio
    async def test_creates_superadmin_when_missing(self, monkeypatch):
        from server.services import users as users_service

        inserted_id = ObjectId()
        mock_col = AsyncMock()
        mock_col.find_one = AsyncMock(return_value=None)
        mock_col.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )
        monkeypatch.setattr(
            "server.database.client.users_col", mock_col
        )
        # users_service imports client module — patch the binding it uses
        monkeypatch.setattr(
            "server.services.users.client.users_col", mock_col
        )

        created = await users_service.seed_superadmin()

        assert created is True
        mock_col.find_one.assert_awaited_once_with(
            {"email": SUPERADMIN_EMAIL}
        )
        mock_col.insert_one.assert_awaited_once()
        doc = mock_col.insert_one.await_args.args[0]
        assert doc["email"] == SUPERADMIN_EMAIL
        assert doc["role"] == "superadmin"
        assert doc["hashed_password"] != SUPERADMIN_PASSWORD
        assert doc["hashed_password"].startswith("$argon2id$")

    @pytest.mark.asyncio
    async def test_skips_when_email_exists(self, monkeypatch):
        from server.services import users as users_service

        mock_col = AsyncMock()
        mock_col.find_one = AsyncMock(
            return_value={
                "_id": ObjectId(),
                "email": SUPERADMIN_EMAIL,
                "role": "superadmin",
                "hashed_password": "already-hashed",
            }
        )
        mock_col.insert_one = AsyncMock()
        monkeypatch.setattr(
            "server.services.users.client.users_col", mock_col
        )

        created = await users_service.seed_superadmin()

        assert created is False
        mock_col.insert_one.assert_not_awaited()


class TestListUsers:
    @pytest.mark.asyncio
    async def test_list_users_returns_docs(self, monkeypatch):
        from server.services import users as users_service

        docs = [
            {
                "_id": ObjectId(),
                "email": "a@b.com",
                "role": "reader",
                "hashed_password": "x",
            }
        ]
        cursor = MagicMock()
        cursor.to_list = AsyncMock(return_value=docs)
        mock_col = MagicMock()
        mock_col.find = MagicMock(return_value=cursor)
        monkeypatch.setattr(
            "server.services.users.client.users_col", mock_col
        )

        result = await users_service.list_users()
        assert result == docs
        mock_col.find.assert_called_once_with({})


class TestUpdateUserRole:
    @pytest.mark.asyncio
    async def test_update_role_success(self, monkeypatch):
        from server.schemas.models import Role
        from server.services import users as users_service

        uid = ObjectId()
        updated = {
            "_id": uid,
            "email": "u@b.com",
            "role": "admin",
            "hashed_password": "x",
        }
        mock_col = AsyncMock()
        mock_col.find_one = AsyncMock(
            return_value={
                "_id": uid,
                "email": "u@b.com",
                "role": "reader",
                "hashed_password": "x",
            }
        )
        mock_col.find_one_and_update = AsyncMock(return_value=updated)
        mock_col.count_documents = AsyncMock(return_value=2)
        monkeypatch.setattr(
            "server.services.users.client.users_col", mock_col
        )

        result = await users_service.update_user_role(str(uid), Role.ADMIN)
        assert result["role"] == "admin"

    @pytest.mark.asyncio
    async def test_update_role_rejects_last_superadmin_demotion(
        self, monkeypatch
    ):
        from fastapi import HTTPException

        from server.schemas.models import Role
        from server.services import users as users_service

        uid = ObjectId()
        mock_col = AsyncMock()
        mock_col.find_one = AsyncMock(
            return_value={
                "_id": uid,
                "email": SUPERADMIN_EMAIL,
                "role": "superadmin",
                "hashed_password": "x",
            }
        )
        mock_col.count_documents = AsyncMock(return_value=1)
        mock_col.find_one_and_update = AsyncMock()
        monkeypatch.setattr(
            "server.services.users.client.users_col", mock_col
        )

        with pytest.raises(HTTPException) as exc_info:
            await users_service.update_user_role(str(uid), Role.ADMIN)
        assert exc_info.value.status_code == 400
        mock_col.find_one_and_update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_update_role_not_found(self, monkeypatch):
        from fastapi import HTTPException

        from server.schemas.models import Role
        from server.services import users as users_service

        mock_col = AsyncMock()
        mock_col.find_one = AsyncMock(return_value=None)
        monkeypatch.setattr(
            "server.services.users.client.users_col", mock_col
        )

        with pytest.raises(HTTPException) as exc_info:
            await users_service.update_user_role(
                "000000000000000000000001", Role.ADMIN
            )
        assert exc_info.value.status_code == 404
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd server
uv run pytest tests/test_seed_superadmin.py -v
```
Expected: FAIL (`seed_superadmin` / `list_users` / `update_user_role` not defined).

- [ ] **Step 3: Add `UserRoleUpdate` to schemas**

Modify `server/schemas/models.py` — insert after `UserResponse` (around line 89):

```python
class UserRoleUpdate(BaseModel):
    """Payload for changing a user's role (admin manager)."""

    role: Role
```

- [ ] **Step 4: Implement service functions in `server/services/users.py`**

Replace/extend the file so it contains (full target content):

```python
"""User service layer for auth operations."""

import logging
from typing import Any, Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo import ReturnDocument

from server.database import client
from server.schemas.models import Role, UserCreate
from server.security.passwords import hash_password

logger = logging.getLogger(__name__)

SUPERADMIN_EMAIL = "peter.j@ecgroup-intl.com"
SUPERADMIN_PASSWORD = "Peter@123"


async def create_user(data: UserCreate) -> dict[str, Any]:
    """Create a new user with a hashed password.

    Defaults to the ``reader`` role when not overridden on ``UserCreate``.

    Args:
        data: Registration payload (email, password, optional role).

    Returns:
        The inserted user document including ``_id`` (no plaintext password).
    """
    role = data.role if data.role is not None else Role.READER
    doc: dict[str, Any] = {
        "email": data.email,
        "hashed_password": hash_password(data.password),
        "role": role.value if isinstance(role, Role) else role,
    }
    result = await client.users_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    """Look up a raw user document by email.

    Args:
        email: The email to search for.

    Returns:
        The user document dict, or None if not found.
    """
    return await client.users_col.find_one({"email": email})


async def seed_superadmin() -> bool:
    """Idempotently ensure the static superadmin account exists.

    Creates ``peter.j@ecgroup-intl.com`` with role ``superadmin`` only when
    no user with that email exists. Does not overwrite existing accounts.

    Returns:
        True if a new superadmin document was inserted; False if already present.
    """
    existing = await client.users_col.find_one({"email": SUPERADMIN_EMAIL})
    if existing is not None:
        logger.info("Superadmin already present; skip seed")
        return False

    doc: dict[str, Any] = {
        "email": SUPERADMIN_EMAIL,
        "hashed_password": hash_password(SUPERADMIN_PASSWORD),
        "role": Role.SUPERADMIN.value,
    }
    await client.users_col.insert_one(doc)
    logger.info("Seeded superadmin account for %s", SUPERADMIN_EMAIL)
    return True


async def list_users() -> list[dict[str, Any]]:
    """Return all user documents (including hashed_password field).

    Callers must map to ``UserResponse`` so hashes never leave the API.

    Returns:
        List of raw user documents from MongoDB.
    """
    cursor = client.users_col.find({})
    return await cursor.to_list(length=None)


async def update_user_role(user_id: str, role: Role) -> dict[str, Any]:
    """Update a user's role with last-superadmin protection.

    Args:
        user_id: Hex string MongoDB ObjectId of the target user.
        role: New role to assign.

    Returns:
        The updated user document.

    Raises:
        HTTPException 400: Invalid ObjectId, or demoting the last superadmin.
        HTTPException 404: User not found.
    """
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id",
        )
    oid = ObjectId(user_id)
    current = await client.users_col.find_one({"_id": oid})
    if current is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    current_role = current.get("role")
    if (
        current_role == Role.SUPERADMIN.value
        and role != Role.SUPERADMIN
    ):
        superadmin_count = await client.users_col.count_documents(
            {"role": Role.SUPERADMIN.value}
        )
        if superadmin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last superadmin",
            )

    updated = await client.users_col.find_one_and_update(
        {"_id": oid},
        {"$set": {"role": role.value}},
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return updated
```

- [ ] **Step 5: Wire seed into lifespan + mock in conftest**

Modify `server/main.py`:

```python
from server.database.client import ensure_indexes
from server.services.users import seed_superadmin
# ... existing router imports ...
from server.routers import (
    admin,  # will exist after Phase 2; if implementing phase-by-phase,
            # import admin only in Phase 2 — for Phase 1 only call seed
    apps,
    architectures,
    auth,
    infrastructures,
    problems,
    search,
    solutions,
)
```

**Phase 1 only** (if admin router not yet created, skip admin import/register until Phase 2):

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: indexes + superadmin seed on startup.

    Args:
        app: The FastAPI application instance.

    Yields:
        Control to the running application.
    """
    await ensure_indexes()
    await seed_superadmin()
    yield
```

Modify `server/tests/conftest.py` fixtures so lifespan never hits real seed logic:

In `mock_db` fixture, after mocking `ensure_indexes`:
```python
mock_seed = AsyncMock(return_value=False)
monkeypatch.setattr("server.services.users.seed_superadmin", mock_seed)
# Also re-bind on main after import in client fixture:
```

In `client` fixture:
```python
monkeypatch.setattr(main_mod, "ensure_indexes", AsyncMock(return_value=None))
monkeypatch.setattr(main_mod, "seed_superadmin", AsyncMock(return_value=False))
```

Same for any other TestClient fixtures (`lenient_client` in `test_rbac_guards.py`) — patch `main_mod.seed_superadmin` there too when you touch that file, or patch at import path before app creation:

```python
monkeypatch.setattr(
    "server.main.seed_superadmin", AsyncMock(return_value=False)
)
```

**Important:** After adding `from server.services.users import seed_superadmin` in `main.py`, the name `seed_superadmin` is bound on `server.main` — mock that binding in fixtures that construct `TestClient(app)`.

- [ ] **Step 6: Run tests — expect pass**

```bash
cd server
uv run pytest tests/test_seed_superadmin.py -v
uv run pyright
```
Expected: all green; pyright clean.

- [ ] **Step 7: Commit**

```bash
git add server/schemas/models.py server/services/users.py server/main.py server/tests/conftest.py server/tests/test_seed_superadmin.py server/tests/test_rbac_guards.py
git commit -m "feat(admin): seed superadmin and user role service helpers"
```

---

## Phase 2: Admin Manager API (backend)

**Objective:** Superadmin-only endpoints to list users and change roles.

**Deliverable:** `GET /api/admin/users` and `PATCH /api/admin/users/{user_id}` registered and tested.

### Task 2.1: Failing API tests

**Files:**
- Create: `server/tests/test_admin_api.py`
- Create: `server/routers/admin.py`
- Modify: `server/main.py`

- [ ] **Step 1: Write failing HTTP tests**

```python
"""HTTP tests for /api/admin/* superadmin-only endpoints."""

from typing import Any
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from server.security.jwt import create_access_token


def _headers(role: str, subject: str = "test-user-id") -> dict[str, str]:
    token = create_access_token(
        subject=subject,
        email="test@example.com",
        role=role,
    )
    return {"Authorization": f"Bearer {token}"}


SAMPLE_USERS: list[dict[str, Any]] = [
    {
        "_id": ObjectId("0000000000000000000000aa"),
        "email": "peter.j@ecgroup-intl.com",
        "role": "superadmin",
        "hashed_password": "h1",
    },
    {
        "_id": ObjectId("0000000000000000000000bb"),
        "email": "reader@example.com",
        "role": "reader",
        "hashed_password": "h2",
    },
]


class TestAdminListUsers:
    def test_unauthenticated_401(self, client: TestClient):
        resp = client.get("/api/admin/users")
        assert resp.status_code == 401

    def test_admin_forbidden_403(self, client: TestClient):
        resp = client.get("/api/admin/users", headers=_headers("admin"))
        assert resp.status_code == 403

    def test_reader_forbidden_403(self, client: TestClient):
        resp = client.get("/api/admin/users", headers=_headers("reader"))
        assert resp.status_code == 403

    def test_superadmin_lists_users(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(
            "server.routers.admin.users_service.list_users",
            AsyncMock(return_value=SAMPLE_USERS),
        )
        resp = client.get(
            "/api/admin/users", headers=_headers("superadmin")
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["email"] == "peter.j@ecgroup-intl.com"
        assert data[0]["role"] == "superadmin"
        assert "hashed_password" not in data[0]
        assert "id" in data[0]


class TestAdminPatchUserRole:
    def test_unauthenticated_401(self, client: TestClient):
        resp = client.patch(
            "/api/admin/users/0000000000000000000000bb",
            json={"role": "admin"},
        )
        assert resp.status_code == 401

    def test_admin_forbidden_403(self, client: TestClient):
        resp = client.patch(
            "/api/admin/users/0000000000000000000000bb",
            json={"role": "admin"},
            headers=_headers("admin"),
        )
        assert resp.status_code == 403

    def test_superadmin_grants_admin(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        updated = {
            "_id": ObjectId("0000000000000000000000bb"),
            "email": "reader@example.com",
            "role": "admin",
            "hashed_password": "h2",
        }
        monkeypatch.setattr(
            "server.routers.admin.users_service.update_user_role",
            AsyncMock(return_value=updated),
        )
        resp = client.patch(
            "/api/admin/users/0000000000000000000000bb",
            json={"role": "admin"},
            headers=_headers("superadmin"),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["role"] == "admin"
        assert body["email"] == "reader@example.com"
        assert "hashed_password" not in body

    def test_last_superadmin_guard_returns_400(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        from fastapi import HTTPException, status

        async def _raise(*_a, **_k):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last superadmin",
            )

        monkeypatch.setattr(
            "server.routers.admin.users_service.update_user_role",
            _raise,
        )
        resp = client.patch(
            "/api/admin/users/0000000000000000000000aa",
            json={"role": "admin"},
            headers=_headers("superadmin"),
        )
        assert resp.status_code == 400
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd server
uv run pytest tests/test_admin_api.py -v
```
Expected: FAIL (404 on routes / import error for admin router).

- [ ] **Step 3: Create `server/routers/admin.py`**

```python
"""Superadmin-only user administration endpoints."""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from server.schemas.models import Role, UserResponse, UserRoleUpdate
from server.security.deps import require_role
from server.services import users as users_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get(
    "/users",
    response_model=List[UserResponse],
    dependencies=[Depends(require_role(Role.SUPERADMIN))],
    summary="List all users",
    description="Returns every user account (id, email, role). Superadmin only.",
)
async def list_users():
    """List all registered users.

    Returns:
        List of ``UserResponse`` (never includes hashed passwords).

    Raises:
        HTTPException 500: On unexpected server errors.
    """
    try:
        docs = await users_service.list_users()
        return docs
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list users")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_role(Role.SUPERADMIN))],
    summary="Update a user's role",
    description=(
        "Sets the role for the given user id. Superadmin only. "
        "Rejects demoting the last superadmin."
    ),
)
async def update_user_role(user_id: str, body: UserRoleUpdate):
    """Update the role of a single user.

    Args:
        user_id: Target user ObjectId hex string.
        body: Desired role payload.

    Returns:
        Updated ``UserResponse``.

    Raises:
        HTTPException 400/404: Propagated from the service layer.
        HTTPException 500: On unexpected server errors.
    """
    try:
        doc = await users_service.update_user_role(user_id, body.role)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update user role")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e
```

- [ ] **Step 4: Register router in `server/main.py`**

```python
from server.routers import (
    admin,
    apps,
    architectures,
    auth,
    infrastructures,
    problems,
    search,
    solutions,
)

# Include modular routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(problems.router)
# ... rest unchanged
```

Ensure lifespan still has:
```python
await ensure_indexes()
await seed_superadmin()
```

- [ ] **Step 5: Run tests + typecheck**

```bash
cd server
uv run pytest tests/test_admin_api.py tests/test_seed_superadmin.py tests/test_auth.py tests/test_rbac_guards.py -v
uv run pyright
```
Expected: all green; pyright clean.

- [ ] **Step 6: Commit**

```bash
git add server/routers/admin.py server/main.py server/tests/test_admin_api.py
git commit -m "feat(admin): superadmin-only list and role-update API"
```

---

## Phase 3: Frontend API client + Admin Manager UI

**Objective:** Superadmin can open Admin Manager, see logins, grant admin.

**Deliverable:** Button (superadmin only), `/admin` route, list + grant UI, lint/build clean.

### Task 3.1: `adminApi` client helpers

**Files:**
- Modify: `client/src/api/client.ts`

- [ ] **Step 1: Append `adminApi` after `authApi`**

```typescript
/**
 * Superadmin-only user administration endpoints.
 */
export const adminApi = {
  /** List all users (id, email, role). */
  listUsers: () => request<UserResponse[]>('/api/admin/users'),

  /** Set a user's role (e.g. grant admin). */
  setRole: (userId: string, role: UserRole) =>
    request<UserResponse>(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
};
```

`UserResponse` and `UserRole` already exist in this file / `auth/jwt`.

- [ ] **Step 2: Typecheck via build later in Task 3.3** (no isolated step required).

### Task 3.2: `AdminManagerView` component + CSS

**Files:**
- Create: `client/src/components/AdminManagerView.tsx`
- Create: `client/src/components/AdminManagerView.css`

- [ ] **Step 1: Create component**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import type { UserResponse } from '../api/client';
import './AdminManagerView.css';

interface AdminManagerViewProps {
  onNavigate: (path: string) => void;
}

export function AdminManagerView({ onNavigate }: AdminManagerViewProps) {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await adminApi.listUsers();
      setUsers(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleGrantAdmin = async (userId: string) => {
    setBusyId(userId);
    setError('');
    try {
      await adminApi.setRole(userId, 'admin');
      await loadUsers();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update role');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-manager">
      <div className="admin-manager-header">
        <h2>Admin Manager</h2>
        <button
          type="button"
          className="admin-back-btn"
          onClick={() => onNavigate('/')}
        >
          ← Back
        </button>
      </div>

      <p className="admin-manager-subtitle">
        Existing logins. Grant admin privilege to a selected user.
      </p>

      {error && <div className="admin-manager-error">{error}</div>}

      {loading ? (
        <p className="status-text">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="status-text">No users found.</p>
      ) : (
        <table className="admin-user-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const canGrant = u.role !== 'admin' && u.role !== 'superadmin';
              return (
                <tr key={u.id}>
                  <td className="admin-user-email">{u.email}</td>
                  <td>
                    <span className={`admin-role-badge role-${u.role}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {canGrant ? (
                      <button
                        type="button"
                        className="admin-grant-btn"
                        disabled={busyId === u.id}
                        onClick={() => void handleGrantAdmin(u.id)}
                      >
                        {busyId === u.id ? 'Updating…' : 'Grant admin'}
                      </button>
                    ) : (
                      <span className="admin-no-action">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

Note: goal says “for each non-admin user” grant admin — hide Grant for `admin` and `superadmin` (already admins or higher).

- [ ] **Step 2: Create CSS matching blueprint theme**

```css
.admin-manager {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-grid);
}

.admin-manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.admin-manager-header h2 {
  margin: 0;
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-primary);
}

.admin-manager-subtitle {
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-family: var(--font-mono);
  margin-bottom: 1.25rem;
}

.admin-manager-error {
  border: 1px solid var(--accent-problem);
  color: var(--accent-problem);
  background: transparent;
  padding: 0.6rem 0.8rem;
  margin-bottom: 1rem;
  font-size: 0.8rem;
  font-family: var(--font-mono);
}

.admin-back-btn,
.admin-grant-btn {
  background: transparent;
  border: 1px solid var(--border-grid);
  color: var(--text-secondary);
  padding: 0.35rem 0.7rem;
  font-size: 0.7rem;
  font-family: var(--font-mono);
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 3px;
  transition: border-color 0.2s, color 0.2s;
}

.admin-back-btn:hover {
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
}

.admin-grant-btn {
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
}

.admin-grant-btn:hover:not(:disabled) {
  background-color: var(--accent-cyan-dim);
}

.admin-grant-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin-user-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.admin-user-table th,
.admin-user-table td {
  text-align: left;
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--border-grid);
}

.admin-user-table th {
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.7rem;
  font-weight: 600;
}

.admin-user-email {
  color: var(--text-primary);
}

.admin-role-badge {
  display: inline-block;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--border-grid);
  border-radius: 3px;
  color: var(--text-secondary);
}

.admin-role-badge.role-superadmin {
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
  background-color: var(--accent-cyan-dim);
}

.admin-role-badge.role-admin {
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
}

.admin-no-action {
  color: var(--text-secondary);
  opacity: 0.5;
}
```

### Task 3.3: Wire route + header button in `App.tsx` / `App.css`

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/App.css`

- [ ] **Step 1: Import + role flag**

At top of `App.tsx`:
```tsx
import { AdminManagerView } from './components/AdminManagerView';
```

In `AppContent`:
```tsx
const { role, canManage } = useRole();
```
(currently only destructures `role` — add `canManage`).

- [ ] **Step 2: Admin route detection + guard**

After path state helpers, add:
```tsx
const isAdminRoute = currentPath === '/admin';
const isUnauthorized = currentPath === '/unauthorized';

// Superadmin-only route: force-nav by non-superadmin → unauthorized
useEffect(() => {
  if (isAdminRoute && !hasMinRole(role, 'superadmin')) {
    navigate('/unauthorized');
  }
}, [isAdminRoute, role, navigate]);
```

Keep existing `isUnauthorized` — merge carefully so you do not declare it twice. Final logic:

```tsx
const isUnauthorized = currentPath === '/unauthorized';
const isAdminRoute = currentPath === '/admin';
const routeInfo =
  isUnauthorized || isAdminRoute ? null : parseRoute(currentPath);
```

- [ ] **Step 3: Header button (top-right, before Logout)**

Inside `.auth-group`, before the logout button:
```tsx
{canManage && (
  <button
    type="button"
    className="auth-admin-btn"
    onClick={() => navigateGuarded('/admin', 'superadmin')}
  >
    Admin manager
  </button>
)}
```

- [ ] **Step 4: Render AdminManagerView in main**

```tsx
<main className="main-content">
  {isUnauthorized ? (
    <UnauthorizedView onNavigate={navigate} />
  ) : isAdminRoute && hasMinRole(role, 'superadmin') ? (
    <AdminManagerView onNavigate={navigate} />
  ) : routeInfo ? (
    <DetailView
      component={routeInfo.component}
      id={routeInfo.id}
      onNavigate={navigate}
    />
  ) : (
    // existing tab views unchanged
    ...
  )}
</main>
```

Also hide tab nav + search when on admin route (mirror unauthorized):
```tsx
{!routeInfo && !isUnauthorized && !isAdminRoute && (
  // search-group and tab-navigation blocks
)}
```

- [ ] **Step 5: CSS for header button in `App.css`**

After `.auth-logout-btn:hover`:
```css
.auth-admin-btn {
  background: transparent;
  border: 1px solid var(--accent-cyan);
  color: var(--accent-cyan);
  padding: 0.3rem 0.6rem;
  font-size: 0.7rem;
  font-family: var(--font-mono);
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 3px;
  transition: background-color 0.2s, color 0.2s;
}

.auth-admin-btn:hover {
  background-color: var(--accent-cyan-dim);
}
```

- [ ] **Step 6: Frontend verification**

```bash
cd client
npm run lint
npm run build
```
Expected: both succeed with no errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/api/client.ts client/src/components/AdminManagerView.tsx client/src/components/AdminManagerView.css client/src/App.tsx client/src/App.css
git commit -m "feat(admin): Admin manager UI for superadmin role grants"
```

---

## Phase 4: Full verification + success criteria checklist

**Objective:** Prove all goal success criteria against mocked tests and local run commands.

**Deliverable:** Green backend suite + clean frontend build; manual smoke checklist documented.

### Task 4.1: Automated verification

- [ ] **Step 1: Backend full suite**

```bash
cd server
uv run pytest -v
uv run pyright
```
Expected: all tests pass; pyright exit 0.

- [ ] **Step 2: Frontend**

```bash
cd client
npm run lint
npm run build
```
Expected: exit 0.

### Task 4.2: Manual smoke (against real MongoDB)

Only when a local MongoDB is available (`server/.env` with `MONGODB_URL` / `MONGODB_DB`):

```bash
cd server
uv run uvicorn main:app --reload --port 8000
```

Checklist:
1. Startup logs show either “Seeded superadmin…” or “Superadmin already present…”.
2. Second restart does **not** create a duplicate (unique email index).
3. `POST /api/auth/token` with `username=peter.j@ecgroup-intl.com` & `password=Peter@123` → JWT with `role=superadmin`.
4. Login in UI → “Admin manager” button visible top-right.
5. Click → user table loads; Grant admin on a reader → role badge becomes `admin`.
6. Login as `admin` → button hidden; navigating to `/admin` → Access Denied.
7. `GET /api/admin/users` with admin JWT → 403; with superadmin JWT → 200.

### Task 4.3: Success criteria map

| Criterion (goal.md §3) | Covered by |
|------------------------|------------|
| Startup creates superadmin if missing | Phase 1 `seed_superadmin` + lifespan |
| Login as seed credentials → superadmin JWT | Phase 1 seed + existing `/api/auth/token` |
| Admin API 403 for admin | Phase 2 `test_admin_api.py` |
| Superadmin button + grant flow | Phase 3 UI |
| Admin force-nav → unauthorized | Phase 3 route guard effect |
| pyright + pytest green | Phase 4.1 |
| client lint + build clean | Phase 4.1 |

---

## Implementation Notes (for workers)

### Import / mock path pitfalls
- Services use `from server.database import client` then `client.users_col`. Monkeypatch `server.services.users.client.users_col` (same pattern as existing tests that patch `server.database.client.users_col` via conftest — both may need patching depending on import timing).
- Prefer testing admin routes by monkeypatching `server.routers.admin.users_service.*` so handlers do not need full DB fixtures.
- After `from server.services.users import seed_superadmin` in `main.py`, patch `server.main.seed_superadmin` in every TestClient fixture.

### Security / product decisions locked by this plan
- Seed credentials are **hardcoded** per user requirement (email + password constants in `users.py`).
- Grant action only promotes to `admin` (no demote UI in MVP). Backend still accepts any valid `Role` via `UserRoleUpdate` for completeness; last-superadmin demotion is blocked.
- Frontend hides Grant for users already `admin` or `superadmin`.

### Style rules (AGENTS.md)
- Python: 4-space indent, stdlib → third-party → `server.*`, docstrings with Args/Returns/Raises, `uv run`.
- TypeScript: single quotes, explicit semicolons, no `any`/`as`, named exports, `import type` for types, UpperCamelCase components.
- No empty catch blocks.

### Out of scope (do not implement)
- Password reset, account lock, audit logs, revoking admin via UI, refresh tokens, httpOnly cookies.

---

## Self-Review (planner)

1. **Spec coverage:** Seed, GET users, PATCH role, last-superadmin guard, superadmin button, `/admin` guard, grant+refetch, tests, pyright/pytest/lint/build — all mapped to tasks.
2. **Placeholders:** None — full code snippets included.
3. **Type consistency:** `UserRoleUpdate.role: Role`, `adminApi.setRole(id, UserRole)`, `UserResponse` shapes aligned with existing models.

(End of plan)
