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
