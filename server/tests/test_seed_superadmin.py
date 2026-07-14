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
