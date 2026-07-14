# Phase 2 — Backend Route Guards

**Objective:** Apply `RequireRole("admin")` guards to all mutation routes (`POST`, `PUT`, `DELETE`) across the five existing routers. Keep all `GET` routes open to any authenticated or unauthenticated user. Add comprehensive RBAC guard tests.

**Depends on:** Phase 1 (Backend Auth Foundation) must be complete.

---

## Files to Modify

| File | Change |
|------|--------|
| `server/routers/problems.py` | Add `Depends`, `RequireRole` import; add `dependencies=[Depends(RequireRole("admin"))]` to `POST /`, `PUT /{id}`, `DELETE /{id}` |
| `server/routers/solutions.py` | Same pattern for `POST /`, `PUT /{id}`, `DELETE /{id}` |
| `server/routers/architectures.py` | Same pattern for `POST /`, `PUT /{id}`, `DELETE /{id}` |
| `server/routers/infrastructures.py` | Same pattern for `POST /`, `PUT /{id}`, `DELETE /{id}` |
| `server/routers/apps.py` | Same pattern for `POST /`, `PUT /{id}`, `DELETE /{id}` |

### New Files

| File | Purpose |
|------|---------|
| `server/tests/test_rbac_guards.py` | RBAC guard integration tests |

---

## Constraint Reminder

> Do NOT change handler function signatures. Use the decorator-level `dependencies=[...]` parameter on each route decorator. This keeps the guard decoupled from handler logic.

---

## Tests to Write BEFORE Implementation

### `server/tests/test_rbac_guards.py`

```python
"""Tests for RBAC route guards across all entity routers.

Validates:
- Unauthenticated requests → 401
- Reader role → 403 on mutations
- Admin role → passes guard (not 401/403)
- GET routes → accessible without auth restrictions
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from server.main import app
from server.security.deps import get_current_user
from server.schemas.auth import TokenPayload


# ── Fixtures ─────────────────────────────────────────────────────

def _make_user(role: str = "reader"):
    """Create a dependency override returning a TokenPayload."""
    async def _override():
        return TokenPayload(sub="test-user-id", email="test@example.com", role=role)
    return _override


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def as_reader():
    """Override auth to simulate a Reader user."""
    app.dependency_overrides[get_current_user] = _make_user("reader")
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_admin():
    """Override auth to simulate an Admin user."""
    app.dependency_overrides[get_current_user] = _make_user("admin")
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_superadmin():
    """Override auth to simulate a SuperAdmin user."""
    app.dependency_overrides[get_current_user] = _make_user("superadmin")
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def no_auth():
    """Ensure no auth override (unauthenticated)."""
    app.dependency_overrides.pop(get_current_user, None)
    yield
    app.dependency_overrides.pop(get_current_user, None)


# ── Mutation routes to test ──────────────────────────────────────

MUTATION_ROUTES = [
    ("POST", "/api/problems/", {"title": "T", "description": "D"}),
    ("PUT", "/api/problems/000000000000000000000001", {"title": "T"}),
    ("DELETE", "/api/problems/000000000000000000000001", None),
    ("POST", "/api/solutions/", {"title": "T", "description": "D", "problem_id": "p1", "architecture_ids": [], "infrastructure_ids": []}),
    ("PUT", "/api/solutions/000000000000000000000001", {"title": "T"}),
    ("DELETE", "/api/solutions/000000000000000000000001", None),
    ("POST", "/api/architectures/", {"title": "T", "description": "D"}),
    ("PUT", "/api/architectures/000000000000000000000001", {"title": "T"}),
    ("DELETE", "/api/architectures/000000000000000000000001", None),
    ("POST", "/api/infrastructures/", {"title": "T", "description": "D"}),
    ("PUT", "/api/infrastructures/000000000000000000000001", {"title": "T"}),
    ("DELETE", "/api/infrastructures/000000000000000000000001", None),
    ("POST", "/api/apps/", {"title": "T", "description": "D", "github_url": "https://github.com/x/y"}),
    ("PUT", "/api/apps/000000000000000000000001", {"title": "T"}),
    ("DELETE", "/api/apps/000000000000000000000001", None),
]

READ_ROUTES = [
    ("GET", "/api/problems/"),
    ("GET", "/api/solutions/"),
    ("GET", "/api/architectures/"),
    ("GET", "/api/infrastructures/"),
    ("GET", "/api/apps/"),
]


# ── Unauthenticated → 401 ───────────────────────────────────────

class TestUnauthenticated:
    """Unauthenticated requests to protected mutation routes must get 401."""

    @pytest.mark.parametrize("method,path,body", MUTATION_ROUTES)
    def test_mutation_returns_401(self, client, no_auth, method, path, body):
        if method == "POST":
            resp = client.post(path, json=body)
        elif method == "PUT":
            resp = client.put(path, json=body)
        else:
            resp = client.delete(path)
        assert resp.status_code == 401, f"{method} {path} expected 401, got {resp.status_code}"


# ── Reader → 403 on mutations ───────────────────────────────────

class TestReaderForbidden:
    """Reader role must be rejected (403) on all mutation routes."""

    @pytest.mark.parametrize("method,path,body", MUTATION_ROUTES)
    def test_mutation_returns_403(self, client, as_reader, method, path, body):
        if method == "POST":
            resp = client.post(path, json=body)
        elif method == "PUT":
            resp = client.put(path, json=body)
        else:
            resp = client.delete(path)
        assert resp.status_code == 403, f"{method} {path} expected 403, got {resp.status_code}"


# ── Admin → passes guard ────────────────────────────────────────

class TestAdminPassesGuard:
    """Admin role must NOT receive 401 or 403 (guard passes)."""

    @pytest.mark.parametrize("method,path,body", MUTATION_ROUTES)
    def test_mutation_not_auth_error(self, client, as_admin, method, path, body):
        if method == "POST":
            resp = client.post(path, json=body)
        elif method == "PUT":
            resp = client.put(path, json=body)
        else:
            resp = client.delete(path)
        # The request may fail for DB reasons (404/500) but NOT for auth
        assert resp.status_code not in (401, 403), \
            f"{method} {path} got auth error {resp.status_code} for admin"


# ── SuperAdmin → passes guard ───────────────────────────────────

class TestSuperAdminPassesGuard:
    """SuperAdmin must also pass admin-level guards."""

    @pytest.mark.parametrize("method,path,body", MUTATION_ROUTES)
    def test_mutation_not_auth_error(self, client, as_superadmin, method, path, body):
        if method == "POST":
            resp = client.post(path, json=body)
        elif method == "PUT":
            resp = client.put(path, json=body)
        else:
            resp = client.delete(path)
        assert resp.status_code not in (401, 403)


# ── GET routes remain open ───────────────────────────────────────

class TestReadRoutesOpen:
    """GET (list) routes must not return 401 or 403, even without auth."""

    @pytest.mark.parametrize("method,path", READ_ROUTES)
    def test_get_not_auth_error(self, client, no_auth, method, path):
        resp = client.get(path)
        assert resp.status_code not in (401, 403), \
            f"GET {path} should be open but got {resp.status_code}"


# ── GET /api/auth/me ─────────────────────────────────────────────

class TestAuthMe:
    """GET /api/auth/me returns the current user's token payload."""

    def test_me_returns_user(self, client, as_admin):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "admin"
        assert data["email"] == "test@example.com"

    def test_me_unauthenticated_returns_401(self, client, no_auth):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401
```

---

## Step-by-Step Implementation

### Step 1 — `server/routers/problems.py` (MODIFY)

Add the import and `dependencies` parameter to the three mutation decorators. **Do NOT modify handler signatures.**

```diff
 import logging
 from typing import List, Optional

-from fastapi import APIRouter, HTTPException, status
+from fastapi import APIRouter, Depends, HTTPException, status

 from server.schemas.models import ProblemCreate, ProblemResponse, ProblemUpdate
+from server.security.deps import RequireRole
 from server.services import problems as service

 logger = logging.getLogger(__name__)
 router = APIRouter(prefix="/api/problems", tags=["Problems"])


 @router.post(
     "/",
     response_model=ProblemResponse,
     status_code=status.HTTP_201_CREATED,
+    dependencies=[Depends(RequireRole("admin"))],
     summary="Create a new Problem card",
     description="Creates a new Problem card in the database.",
 )
 async def create_problem(data: ProblemCreate):
```

```diff
 @router.put(
     "/{id}",
     response_model=ProblemResponse,
+    dependencies=[Depends(RequireRole("admin"))],
     summary="Update a Problem card",
```

```diff
 @router.delete(
     "/{id}",
+    dependencies=[Depends(RequireRole("admin"))],
     summary="Delete a Problem card",
```

### Step 2 — `server/routers/solutions.py` (MODIFY)

Identical pattern:

```diff
-from fastapi import APIRouter, HTTPException, status
+from fastapi import APIRouter, Depends, HTTPException, status

+from server.security.deps import RequireRole

 @router.post(
     "/",
     response_model=SolutionResponse,
     status_code=status.HTTP_201_CREATED,
+    dependencies=[Depends(RequireRole("admin"))],
     summary="Create a new Solution ...",

 @router.put(
     "/{id}",
     response_model=SolutionResponse,
+    dependencies=[Depends(RequireRole("admin"))],
     summary="Update a Solution card",

 @router.delete(
     "/{id}",
+    dependencies=[Depends(RequireRole("admin"))],
     summary="Delete a Solution card",
```

### Step 3 — `server/routers/architectures.py` (MODIFY)

Same pattern — add `Depends` import, `RequireRole` import, `dependencies=[Depends(RequireRole("admin"))]` to `POST /`, `PUT /{id}`, `DELETE /{id}`.

### Step 4 — `server/routers/infrastructures.py` (MODIFY)

Same pattern.

### Step 5 — `server/routers/apps.py` (MODIFY)

Same pattern for `POST /`, `PUT /{id}`, `DELETE /{id}`. The `GET /readme` and `GET /{id}` routes remain unguarded.

---

## Summary of Changes per Router

| Router | `POST /` | `GET /` | `GET /{id}` | `PUT /{id}` | `DELETE /{id}` |
|--------|----------|---------|-------------|-------------|----------------|
| problems | `Admin` | Open | Open | `Admin` | `Admin` |
| solutions | `Admin` | Open | Open | `Admin` | `Admin` |
| architectures | `Admin` | Open | Open | `Admin` | `Admin` |
| infrastructures | `Admin` | Open | Open | `Admin` | `Admin` |
| apps | `Admin` | Open | Open | `Admin` | `Admin` |

---

## Verification

```bash
cd server
uv run pyright                            # Type check — zero errors
uv run pytest tests/test_rbac_guards.py -v  # All guard tests green
uv run pytest                             # Full suite still passes
```

### Expected Results

- **15 mutation routes × 4 test classes** = 60 parametrized auth tests
- **5 GET routes** × 1 test = 5 read-open tests
- **2 `/api/auth/me` tests**
- Total: ~67 new tests, all green
