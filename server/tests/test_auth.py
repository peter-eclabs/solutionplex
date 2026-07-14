"""Unit tests for auth foundation: passwords, JWT, role dependencies, /me."""

from datetime import timedelta

import jwt as pyjwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


# ── Password hashing ────────────────────────────────────────────


class TestPasswordHashing:
    """Tests for server.security.passwords module."""

    def test_hash_verify_roundtrip(self):
        """hash_password + verify_password must succeed for the original plaintext."""
        from server.security.passwords import hash_password, verify_password

        plain = "test-password-123"
        hashed = hash_password(plain)
        assert hashed.startswith("$argon2id$")
        assert verify_password(plain, hashed) is True

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

    def test_create_decode_roundtrip_claims(self):
        """Encoding then decoding must recover sub, email, role, exp, iat."""
        from server.security.jwt import create_access_token, decode_token

        token = create_access_token(
            subject="user-1",
            email="a@b.com",
            role="admin",
        )
        decoded = decode_token(token)
        assert decoded["sub"] == "user-1"
        assert decoded["email"] == "a@b.com"
        assert decoded["role"] == "admin"
        assert "exp" in decoded
        assert "iat" in decoded

    def test_expired_token_raises_invalid_token_error(self):
        """A token created with a negative TTL must raise InvalidTokenError."""
        from server.security.jwt import create_access_token, decode_token

        token = create_access_token(
            subject="user-1",
            email="a@b.com",
            role="reader",
            expires_delta=timedelta(seconds=-10),
        )
        with pytest.raises(pyjwt.InvalidTokenError):
            decode_token(token)

    def test_invalid_token_raises(self):
        """A garbage string must raise InvalidTokenError."""
        from server.security.jwt import decode_token

        with pytest.raises(pyjwt.InvalidTokenError):
            decode_token("not.a.token")


# ── require_role rank logic ──────────────────────────────────────


class TestRequireRole:
    """Tests for the require_role factory dependency."""

    @pytest.mark.asyncio
    async def test_admin_passes_admin_check(self):
        """Admin user must pass require_role('admin')."""
        from server.schemas.models import CurrentUser, Role
        from server.security.deps import require_role

        guard = require_role(Role.ADMIN)
        user = CurrentUser(id="u1", email="a@b.com", role=Role.ADMIN)
        result = await guard(user=user)
        assert result.role == Role.ADMIN

    @pytest.mark.asyncio
    async def test_superadmin_passes_admin_check(self):
        """SuperAdmin must pass an admin-level check (higher clearance)."""
        from server.schemas.models import CurrentUser, Role
        from server.security.deps import require_role

        guard = require_role(Role.ADMIN)
        user = CurrentUser(id="u1", email="a@b.com", role=Role.SUPERADMIN)
        result = await guard(user=user)
        assert result.role == Role.SUPERADMIN

    @pytest.mark.asyncio
    async def test_reader_fails_admin_check(self):
        """Reader must be rejected by require_role('admin') with 403."""
        from server.schemas.models import CurrentUser, Role
        from server.security.deps import require_role

        guard = require_role(Role.ADMIN)
        user = CurrentUser(id="u1", email="a@b.com", role=Role.READER)
        with pytest.raises(HTTPException) as exc_info:
            await guard(user=user)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_reader_passes_reader_check(self):
        """Reader must pass require_role('reader')."""
        from server.schemas.models import CurrentUser, Role
        from server.security.deps import require_role

        guard = require_role(Role.READER)
        user = CurrentUser(id="u1", email="a@b.com", role=Role.READER)
        result = await guard(user=user)
        assert result.role == Role.READER

    def test_rank_ordering(self):
        """reader < admin < superadmin in numeric rank."""
        from server.schemas.models import ROLE_RANK, Role

        assert ROLE_RANK[Role.READER] < ROLE_RANK[Role.ADMIN]
        assert ROLE_RANK[Role.ADMIN] < ROLE_RANK[Role.SUPERADMIN]


# ── /api/auth/me endpoint ────────────────────────────────────────


class TestAuthMe:
    """HTTP-level tests for the /api/auth/me endpoint."""

    def test_me_returns_401_without_token(self, client: TestClient):
        """GET /api/auth/me without Authorization must return 401."""
        response = client.get("/api/auth/me")
        assert response.status_code == 401
