"""Tests for RBAC route guards across all entity routers.

Validates:
- Unauthenticated mutation requests → 401
- Reader role → 403 on mutations
- Admin / SuperAdmin → passes guard (status not 401/403)
- GET list routes remain open without auth
"""

from typing import Any, Optional

import pytest
from fastapi.testclient import TestClient

from server.security.jwt import create_access_token

# ── Helpers ──────────────────────────────────────────────────────


def _auth_headers(role: str) -> dict[str, str]:
    """Build Authorization header with a signed JWT for the given role."""
    token = create_access_token(
        subject="test-user-id",
        email="test@example.com",
        role=role,
    )
    return {"Authorization": f"Bearer {token}"}


def _request(
    client: TestClient,
    method: str,
    path: str,
    body: Optional[dict[str, Any]],
    headers: Optional[dict[str, str]] = None,
):
    """Dispatch a mutation request by HTTP method."""
    if method == "POST":
        return client.post(path, json=body, headers=headers)
    if method == "PUT":
        return client.put(path, json=body, headers=headers)
    return client.delete(path, headers=headers)


# ── Mutation routes to test ──────────────────────────────────────

MUTATION_ROUTES = [
    ("POST", "/api/problems/", {"title": "T", "description": "D"}),
    ("PUT", "/api/problems/000000000000000000000001", {"title": "T"}),
    ("DELETE", "/api/problems/000000000000000000000001", None),
    (
        "POST",
        "/api/solutions/",
        {
            "title": "T",
            "description": "D",
            "problem_id": "000000000000000000000001",
            "architecture_ids": [],
            "infrastructure_ids": [],
        },
    ),
    ("PUT", "/api/solutions/000000000000000000000001", {"title": "T"}),
    ("DELETE", "/api/solutions/000000000000000000000001", None),
    ("POST", "/api/architectures/", {"title": "T", "description": "D"}),
    ("PUT", "/api/architectures/000000000000000000000001", {"title": "T"}),
    ("DELETE", "/api/architectures/000000000000000000000001", None),
    ("POST", "/api/infrastructures/", {"title": "T", "description": "D"}),
    ("PUT", "/api/infrastructures/000000000000000000000001", {"title": "T"}),
    ("DELETE", "/api/infrastructures/000000000000000000000001", None),
    (
        "POST",
        "/api/apps/",
        {
            "title": "T",
            "description": "D",
            "github_url": "https://github.com/x/y",
        },
    ),
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


@pytest.fixture
def lenient_client(mock_db, monkeypatch):
    """TestClient that returns 5xx instead of raising on server errors.

    Guard-pass tests only care that auth is not 401/403; underlying
    handlers may still 404/500 without a full DB fixture.
    """
    from unittest.mock import AsyncMock

    from server.main import app
    import server.main as main_mod

    monkeypatch.setattr(main_mod, "ensure_indexes", AsyncMock(return_value=None))
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


# ── Unauthenticated → 401 ───────────────────────────────────────


class TestUnauthenticated:
    """Unauthenticated requests to protected mutation routes must get 401."""

    @pytest.mark.parametrize("method,path,body", MUTATION_ROUTES)
    def test_mutation_returns_401(
        self, client: TestClient, method: str, path: str, body: Optional[dict]
    ):
        resp = _request(client, method, path, body)
        assert resp.status_code == 401, (
            f"{method} {path} expected 401, got {resp.status_code}: {resp.text}"
        )


# ── Reader → 403 on mutations ───────────────────────────────────


class TestReaderForbidden:
    """Reader role must be rejected (403) on all mutation routes."""

    @pytest.mark.parametrize("method,path,body", MUTATION_ROUTES)
    def test_mutation_returns_403(
        self, client: TestClient, method: str, path: str, body: Optional[dict]
    ):
        resp = _request(client, method, path, body, headers=_auth_headers("reader"))
        assert resp.status_code == 403, (
            f"{method} {path} expected 403, got {resp.status_code}: {resp.text}"
        )


# ── Admin → passes guard ────────────────────────────────────────


class TestAdminPassesGuard:
    """Admin role must NOT receive 401 or 403 (guard passes)."""

    @pytest.mark.parametrize("method,path,body", MUTATION_ROUTES)
    def test_mutation_not_auth_error(
        self,
        lenient_client: TestClient,
        method: str,
        path: str,
        body: Optional[dict],
    ):
        resp = _request(
            lenient_client, method, path, body, headers=_auth_headers("admin")
        )
        assert resp.status_code not in (401, 403), (
            f"{method} {path} got auth error {resp.status_code} for admin: {resp.text}"
        )


# ── SuperAdmin → passes guard ───────────────────────────────────


class TestSuperAdminPassesGuard:
    """SuperAdmin must also pass admin-level guards."""

    @pytest.mark.parametrize("method,path,body", MUTATION_ROUTES)
    def test_mutation_not_auth_error(
        self,
        lenient_client: TestClient,
        method: str,
        path: str,
        body: Optional[dict],
    ):
        resp = _request(
            lenient_client, method, path, body, headers=_auth_headers("superadmin")
        )
        assert resp.status_code not in (401, 403), (
            f"{method} {path} got auth error {resp.status_code} for superadmin: "
            f"{resp.text}"
        )


# ── Admin POST happy-path with service stubs (200/201) ───────────


class TestAdminPostWithServiceStub:
    """Admin POST to each entity type passes the guard and returns success.

    Service layer is monkeypatched so the handler does not need a live DB.
    """

    @pytest.mark.parametrize(
        "path,service_attr,json_body",
        [
            (
                "/api/problems/",
                "server.routers.problems.service.create_problem",
                {"title": "T", "description": "D"},
            ),
            (
                "/api/architectures/",
                "server.routers.architectures.service.create_architecture",
                {"title": "T", "description": "D"},
            ),
            (
                "/api/infrastructures/",
                "server.routers.infrastructures.service.create_infrastructure",
                {"title": "T", "description": "D"},
            ),
        ],
    )
    def test_admin_create_returns_success(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
        path: str,
        service_attr: str,
        json_body: dict,
    ):
        from datetime import datetime, timezone
        from unittest.mock import AsyncMock

        from bson import ObjectId

        now = datetime.now(timezone.utc)
        dummy = {
            "_id": ObjectId("000000000000000000000001"),
            "code": "X-001",
            "title": "T",
            "description": "D",
            "created_at": now,
            "updated_at": now,
            "solutions": [],
        }
        monkeypatch.setattr(service_attr, AsyncMock(return_value=dummy))
        resp = client.post(path, json=json_body, headers=_auth_headers("admin"))
        assert resp.status_code not in (401, 403), (
            f"POST {path} auth failed: {resp.status_code} {resp.text}"
        )
        assert resp.status_code in (200, 201), (
            f"POST {path} expected 200/201, got {resp.status_code}: {resp.text}"
        )

    def test_admin_create_solution_passes_guard(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        from datetime import datetime, timezone
        from unittest.mock import AsyncMock

        from bson import ObjectId

        now = datetime.now(timezone.utc)
        oid = ObjectId("000000000000000000000002")
        created = {
            "_id": oid,
            "title": "T",
            "description": "D",
            "problem_id": ObjectId("000000000000000000000001"),
            "architecture_ids": [],
            "infrastructure_ids": [],
            "created_at": now,
            "updated_at": now,
        }
        populated = {
            **created,
            "problem": {
                "id": "000000000000000000000001",
                "title": "P",
            },
            "architectures": [],
            "infrastructures": [],
            "effective_architectures": [],
            "effective_infrastructures": [],
            "apps": [],
        }
        monkeypatch.setattr(
            "server.routers.solutions.service.create_solution",
            AsyncMock(return_value=created),
        )
        monkeypatch.setattr(
            "server.routers.solutions.service.get_solution",
            AsyncMock(return_value=populated),
        )
        resp = client.post(
            "/api/solutions/",
            json={
                "title": "T",
                "description": "D",
                "problem_id": "000000000000000000000001",
            },
            headers=_auth_headers("admin"),
        )
        assert resp.status_code not in (401, 403)
        assert resp.status_code in (200, 201), resp.text

    def test_admin_create_app_passes_guard(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        from datetime import datetime, timezone
        from unittest.mock import AsyncMock

        from bson import ObjectId

        now = datetime.now(timezone.utc)
        oid = ObjectId("000000000000000000000003")
        created = {
            "_id": oid,
            "code": "APP-001",
            "title": "T",
            "description": "D",
            "github_url": "https://github.com/x/y",
            "live_url": None,
            "solution_id": None,
            "architecture_ids": [],
            "infrastructure_ids": [],
            "created_at": now,
            "updated_at": now,
        }
        populated = {
            **created,
            "solution": None,
            "problem": None,
            "solutions": [],
            "architectures": [],
            "infrastructures": [],
        }
        monkeypatch.setattr(
            "server.routers.apps.service.create_app",
            AsyncMock(return_value=created),
        )
        monkeypatch.setattr(
            "server.routers.apps.service.get_app",
            AsyncMock(return_value=populated),
        )
        resp = client.post(
            "/api/apps/",
            json={
                "title": "T",
                "description": "D",
                "github_url": "https://github.com/x/y",
            },
            headers=_auth_headers("admin"),
        )
        assert resp.status_code not in (401, 403)
        assert resp.status_code in (200, 201), resp.text


# ── GET routes remain open ───────────────────────────────────────


class TestReadRoutesOpen:
    """GET (list) routes must not return 401 or 403, even without auth."""

    @pytest.mark.parametrize("method,path", READ_ROUTES)
    def test_get_not_auth_error(self, client: TestClient, method: str, path: str):
        resp = client.get(path)
        assert resp.status_code not in (401, 403), (
            f"GET {path} should be open but got {resp.status_code}"
        )


# ── GET /api/auth/me ─────────────────────────────────────────────


class TestAuthMe:
    """GET /api/auth/me returns the current user's token payload."""

    def test_me_returns_user(self, client: TestClient):
        resp = client.get("/api/auth/me", headers=_auth_headers("admin"))
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "admin"
        assert data["email"] == "test@example.com"

    def test_me_unauthenticated_returns_401(self, client: TestClient):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401
