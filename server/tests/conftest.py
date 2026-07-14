from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def mock_db(monkeypatch):
    mock_db = MagicMock()

    # Set up mocked collections
    mock_db.problems = AsyncMock()
    mock_db.solutions = AsyncMock()
    mock_db.architectures = AsyncMock()
    mock_db.infrastructures = AsyncMock()
    mock_db.apps = AsyncMock()
    mock_db.counters = AsyncMock()
    mock_db.users = AsyncMock()

    # Configure find method to return a synchronous mock cursor (which has async to_list)
    for col in [
        mock_db.problems,
        mock_db.solutions,
        mock_db.architectures,
        mock_db.infrastructures,
        mock_db.apps,
        mock_db.users,
    ]:
        cursor = MagicMock()
        cursor.to_list = AsyncMock(return_value=[])
        col.find = MagicMock(return_value=cursor)

    # Counters collection: simulate an incrementing sequence per prefix.
    # find_one_and_update is called with (filter, update, upsert=, return_document=)
    # so the prefix lives in filter["_id"].
    seq = {"PBM": 0, "ARC": 0, "INF": 0, "APP": 0}

    def fake_next(filter_doc, *args, **kwargs):
        prefix = filter_doc["_id"]
        seq[prefix] = seq.get(prefix, 0) + 1
        return {"_id": prefix, "seq": seq[prefix]}

    mock_db.counters.find_one_and_update = AsyncMock(side_effect=fake_next)

    # Mock the client module-level db reference
    monkeypatch.setattr("server.database.client.problems_col", mock_db.problems)
    monkeypatch.setattr("server.database.client.solutions_col", mock_db.solutions)
    monkeypatch.setattr(
        "server.database.client.architectures_col", mock_db.architectures
    )
    monkeypatch.setattr(
        "server.database.client.infrastructures_col", mock_db.infrastructures
    )
    monkeypatch.setattr("server.database.client.apps_col", mock_db.apps)
    monkeypatch.setattr("server.database.client.counters_col", mock_db.counters)
    monkeypatch.setattr("server.database.client.users_col", mock_db.users)

    # Lifespan calls ensure_indexes on startup — avoid real MongoDB.
    mock_ensure = AsyncMock(return_value=None)
    monkeypatch.setattr("server.database.client.ensure_indexes", mock_ensure)

    return mock_db


@pytest.fixture
def client(mock_db, monkeypatch):
    from server.main import app
    import server.main as main_mod

    # Re-bind after import so lifespan never hits real MongoDB.
    monkeypatch.setattr(main_mod, "ensure_indexes", AsyncMock(return_value=None))

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def admin_headers():
    """Authorization headers for an Admin JWT (mutation-route tests)."""
    from server.security.jwt import create_access_token

    token = create_access_token(
        subject="test-admin-id",
        email="admin@example.com",
        role="admin",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def reader_headers():
    """Authorization headers for a Reader JWT (read-route tests)."""
    from server.security.jwt import create_access_token

    token = create_access_token(
        subject="test-reader-id",
        email="reader@example.com",
        role="reader",
    )
    return {"Authorization": f"Bearer {token}"}
