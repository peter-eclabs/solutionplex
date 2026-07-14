from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

from bson import ObjectId
from fastapi.testclient import TestClient

from server.main import app

NOW = "2026-07-08T11:00:00"


def _cursor(docs):
    cur = MagicMock()
    cur.to_list = AsyncMock(return_value=docs)
    return cur


def test_get_hidden_problem_reader_403(client, mock_db, reader_headers):
    mock_db.problems.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4502"),
            "title": "Hidden",
            "description": "d",
            "hidden": True,
            "created_at": NOW,
            "updated_at": NOW,
        }
    )
    res = client.get("/api/problems/60b8d5a1b55a8b0c848b4502", headers=reader_headers)
    assert res.status_code == 403


def test_get_hidden_problem_admin_200(client, mock_db, admin_headers):
    mock_db.problems.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4502"),
            "title": "Hidden",
            "description": "d",
            "hidden": True,
            "created_at": NOW,
            "updated_at": NOW,
        }
    )
    res = client.get("/api/problems/60b8d5a1b55a8b0c848b4502", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["hidden"] is True


def test_list_problems_reader_excludes_hidden(client, mock_db, reader_headers):
    dataset = [
        {
            "_id": ObjectId("60b8d5a1b55a8b0c848b4501"),
            "title": "Visible",
            "description": "d",
            "hidden": False,
            "created_at": NOW,
            "updated_at": NOW,
        },
        {
            "_id": ObjectId("60b8d5a1b55a8b0c848b4502"),
            "title": "Hidden",
            "description": "d",
            "hidden": True,
            "created_at": NOW,
            "updated_at": NOW,
        },
    ]

    def _find(filter_query=None, *a, **k):
        docs = dataset
        if filter_query and filter_query.get("hidden") == {"$ne": True}:
            docs = [d for d in dataset if not d.get("hidden")]
        return _cursor(docs)

    mock_db.problems.find = MagicMock(side_effect=_find)
    mock_db.solutions.find = MagicMock(return_value=_cursor([]))
    res = client.get("/api/problems/", headers=reader_headers)
    assert res.status_code == 200
    out = res.json()
    assert len(out) == 1
    assert out[0]["title"] == "Visible"


def test_create_problem_persists_hidden(client, mock_db, admin_headers):
    mock_db.problems.insert_one = AsyncMock(
        return_value=type("R", (object,), {"inserted_id": ObjectId("60b8d5a1b55a8b0c848b4502")})()
    )
    res = client.post(
        "/api/problems/",
        json={"title": "H", "description": "d", "hidden": True},
        headers=admin_headers,
    )
    assert res.status_code == 201
    assert res.json()["hidden"] is True
    inserted = mock_db.problems.insert_one.call_args[0][0]
    assert inserted["hidden"] is True


def test_get_solution_linked_hidden_problem_reader_403(client, mock_db, reader_headers):
    mock_db.solutions.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4601"),
            "title": "S",
            "description": "d",
            "problem_id": ObjectId("60b8d5a1b55a8b0c848b4502"),
            "created_at": NOW,
            "updated_at": NOW,
        }
    )
    mock_db.problems.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4502"),
            "title": "P",
            "hidden": True,
        }
    )
    res = client.get("/api/solutions/60b8d5a1b55a8b0c848b4601", headers=reader_headers)
    assert res.status_code == 403


def test_get_solution_linked_hidden_problem_admin_sees_hidden(client, mock_db, admin_headers):
    mock_db.solutions.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4601"),
            "title": "S",
            "description": "d",
            "problem_id": ObjectId("60b8d5a1b55a8b0c848b4502"),
            "created_at": NOW,
            "updated_at": NOW,
        }
    )
    mock_db.problems.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4502"),
            "title": "P",
            "hidden": True,
        }
    )
    mock_db.architectures.find = MagicMock(return_value=_cursor([]))
    mock_db.apps.find = MagicMock(return_value=_cursor([]))
    res = client.get("/api/solutions/60b8d5a1b55a8b0c848b4601", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["hidden"] is True


def test_list_solutions_reader_excludes_hidden_problem(client, mock_db, reader_headers):
    hidden_pid = ObjectId("60b8d5a1b55a8b0c848b4502")
    mock_db.problems.find = MagicMock(
        side_effect=lambda f=None, *a, **k: _cursor(
            [{"_id": hidden_pid, "title": "P", "hidden": True}]
        )
    )
    mock_db.solutions.find = MagicMock(
        side_effect=lambda f=None, *a, **k: _cursor(
            [
                {
                    "_id": ObjectId("60b8d5a1b55a8b0c848b4601"),
                    "title": "S1",
                    "description": "d",
                    "problem_id": hidden_pid,
                    "created_at": NOW,
                    "updated_at": NOW,
                },
                {
                    "_id": ObjectId("60b8d5a1b55a8b0c848b4602"),
                    "title": "S2",
                    "description": "d",
                    "problem_id": ObjectId("60b8d5a1b55a8b0c848b4503"),
                    "created_at": NOW,
                    "updated_at": NOW,
                },
            ]
        )
    )
    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": hidden_pid, "title": "P", "hidden": True}
    )
    mock_db.architectures.find = MagicMock(return_value=_cursor([]))
    mock_db.apps.find = MagicMock(return_value=_cursor([]))
    res = client.get("/api/solutions/", headers=reader_headers)
    assert res.status_code == 200
    out = res.json()
    assert len(out) == 1
    assert out[0]["title"] == "S2"
    assert out[0]["hidden"] is False
