from unittest.mock import AsyncMock, MagicMock

from bson import ObjectId


def test_health(client):
    res = client.get("/")
    assert res.status_code == 200
    assert res.json() == {"status": "healthy", "service": "solutionplex-server"}


def test_create_problem_router(client, mock_db):
    mock_db.problems.insert_one = AsyncMock(
        return_value=type(
            "Result",
            (object,),
            {"inserted_id": ObjectId("60b8d5a1b55a8b0c848b4567")},
        )()
    )
    # Simulating no active solution associated initially
    mock_solutions_cursor = AsyncMock()
    mock_solutions_cursor.to_list = AsyncMock(return_value=[])
    mock_db.solutions.find.return_value = mock_solutions_cursor

    res = client.post(
        "/api/problems/",
        json={"title": "DB Lock", "description": "Slow write lockouts"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "DB Lock"
    assert data["id"] == "60b8d5a1b55a8b0c848b4567"


def test_create_solution_relationship_validation(client, mock_db):
    # If problem is not found, return 400
    mock_db.problems.find_one = AsyncMock(return_value=None)
    res = client.post(
        "/api/solutions/",
        json={
            "title": "Fix locks",
            "description": "Add connection pooling",
            "problem_id": "60b8d5a1b55a8b0c848b4567",
        },
    )
    assert res.status_code == 400
    assert "Associated Problem not found" in res.json()["detail"]


def test_create_solution_invalid_architecture(client, mock_db):
    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4567"), "title": "DB Lock"}
    )
    mock_db.architectures.find_one = AsyncMock(return_value=None)
    res = client.post(
        "/api/solutions/",
        json={
            "title": "Fix locks",
            "description": "Add connection pooling",
            "problem_id": "60b8d5a1b55a8b0c848b4567",
            "architecture_ids": ["60b8d5a1b55a8b0c848b4568"],
        },
    )
    assert res.status_code == 400
    assert "Associated Architecture not found" in res.json()["detail"]


def test_create_solution_invalid_infrastructure(client, mock_db):
    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4567"), "title": "DB Lock"}
    )
    mock_db.architectures.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4568"), "title": "Micro"}
    )
    mock_db.infrastructures.find_one = AsyncMock(return_value=None)
    res = client.post(
        "/api/solutions/",
        json={
            "title": "Fix locks",
            "description": "Add connection pooling",
            "problem_id": "60b8d5a1b55a8b0c848b4567",
            "architecture_ids": ["60b8d5a1b55a8b0c848b4568"],
            "infrastructure_ids": ["60b8d5a1b55a8b0c848b4569"],
        },
    )
    assert res.status_code == 400
    assert "Associated Infrastructure not found" in res.json()["detail"]


def test_search_scoped_by_tab(client, mock_db):
    mock_problems_cursor = AsyncMock()
    mock_problems_cursor.to_list = AsyncMock(
        return_value=[
            {
                "_id": ObjectId("60b8d5a1b55a8b0c848b4567"),
                "title": "DB Lock",
                "description": "Slow write lockouts",
                "created_at": "2026-07-08T11:00:00",
                "updated_at": "2026-07-08T11:00:00",
            }
        ]
    )
    mock_db.problems.find.return_value = mock_problems_cursor

    # Also mocks solution lookup for problems
    mock_solutions_cursor = AsyncMock()
    mock_solutions_cursor.to_list = AsyncMock(return_value=[])
    mock_db.solutions.find.return_value = mock_solutions_cursor

    res = client.get("/api/search/?q=DB&tab=problems")
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 1
    assert results[0]["title"] == "DB Lock"


def test_create_solution_success(client, mock_db):
    from datetime import datetime

    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4567"), "title": "DB Lock"}
    )
    mock_db.architectures.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4568"),
            "title": "Microservices",
        }
    )
    mock_db.infrastructures.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4569"), "title": "AWS"}
    )

    mock_db.solutions.insert_one = AsyncMock(
        return_value=type(
            "Result",
            (object,),
            {"inserted_id": ObjectId("60b8d5a1b55a8b0c848b4570")},
        )()
    )
    mock_db.solutions.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4570"),
            "title": "Fix locks",
            "description": "Add connection pooling",
            "problem_id": ObjectId("60b8d5a1b55a8b0c848b4567"),
            "architecture_ids": [ObjectId("60b8d5a1b55a8b0c848b4568")],
            "infrastructure_ids": [ObjectId("60b8d5a1b55a8b0c848b4569")],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
    )

    # Cursor mock for architectures lookup
    mock_arch_cursor = AsyncMock()
    mock_arch_cursor.to_list = AsyncMock(
        return_value=[
            {
                "_id": ObjectId("60b8d5a1b55a8b0c848b4568"),
                "title": "Microservices",
            }
        ]
    )
    mock_db.architectures.find = MagicMock(return_value=mock_arch_cursor)

    # Cursor mock for infrastructures lookup
    mock_infra_cursor = AsyncMock()
    mock_infra_cursor.to_list = AsyncMock(
        return_value=[{"_id": ObjectId("60b8d5a1b55a8b0c848b4569"), "title": "AWS"}]
    )
    mock_db.infrastructures.find = MagicMock(return_value=mock_infra_cursor)

    res = client.post(
        "/api/solutions/",
        json={
            "title": "Fix locks",
            "description": "Add connection pooling",
            "problem_id": "60b8d5a1b55a8b0c848b4567",
            "architecture_ids": ["60b8d5a1b55a8b0c848b4568"],
            "infrastructure_ids": ["60b8d5a1b55a8b0c848b4569"],
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Fix locks"
    assert data["problem"]["title"] == "DB Lock"
    assert data["architectures"][0]["title"] == "Microservices"
    assert data["infrastructures"][0]["title"] == "AWS"


def test_fetch_readme_success(client, monkeypatch):
    import base64
    import httpx

    class MockResponse:
        status_code = 200

        def json(self):
            return {"content": base64.b64encode(b"Hello World").decode("utf-8")}

    async def mock_get(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    res = client.get(
        "/api/apps/readme?github_url=https://github.com/owner/repo"
    )
    assert res.status_code == 200
    assert res.json() == {"readme_content": "Hello World"}


def test_fetch_readme_api_error(client, monkeypatch):
    import httpx

    class MockResponse:
        status_code = 404
        text = "Not Found"

    async def mock_get(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    res = client.get(
        "/api/apps/readme?github_url=https://github.com/owner/repo"
    )
    assert res.status_code == 400
    assert "Failed to fetch README from GitHub API" in res.json()["detail"]


def test_create_app_success(client, mock_db):
    from datetime import datetime
    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4567"), "title": "DB Lock"}
    )
    mock_db.apps.insert_one = AsyncMock(
        return_value=type(
            "Result",
            (object,),
            {"inserted_id": ObjectId("60b8d5a1b55a8b0c848b4580")},
        )()
    )
    mock_db.apps.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4580"),
            "title": "Cache Monitor Admin",
            "description": "Core features and target users...",
            "github_url": "https://github.com/owner/repo",
            "live_url": "https://myprototype.vercel.app",
            "problem_id": ObjectId("60b8d5a1b55a8b0c848b4567"),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
    )

    res = client.post(
        "/api/apps/",
        json={
            "title": "Cache Monitor Admin",
            "description": "Core features and target users...",
            "github_url": "https://github.com/owner/repo",
            "live_url": "https://myprototype.vercel.app",
            "problem_id": "60b8d5a1b55a8b0c848b4567",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Cache Monitor Admin"
    assert data["github_url"] == "https://github.com/owner/repo"
    assert data["live_url"] == "https://myprototype.vercel.app"
    assert data["problem"]["title"] == "DB Lock"


def test_create_app_invalid_problem(client, mock_db):
    # If problem is not found, return 400
    mock_db.problems.find_one = AsyncMock(return_value=None)
    res = client.post(
        "/api/apps/",
        json={
            "title": "Cache Monitor Admin",
            "description": "Core features and target users...",
            "github_url": "https://github.com/owner/repo",
            "live_url": "https://myprototype.vercel.app",
            "problem_id": "60b8d5a1b55a8b0c848b4567",
        },
    )
    assert res.status_code == 400
    assert "Associated Problem not found" in res.json()["detail"]


def test_list_apps_success(client, mock_db):
    from datetime import datetime
    mock_apps_cursor = AsyncMock()
    mock_apps_cursor.to_list = AsyncMock(
        return_value=[
            {
                "_id": ObjectId("60b8d5a1b55a8b0c848b4580"),
                "title": "Cache Monitor Admin",
                "description": "Core features...",
                "github_url": "https://github.com/owner/repo",
                "live_url": "https://myprototype.vercel.app",
                "problem_id": ObjectId("60b8d5a1b55a8b0c848b4567"),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        ]
    )
    mock_db.apps.find = MagicMock(return_value=mock_apps_cursor)
    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4567"), "title": "DB Lock"}
    )

    res = client.get("/api/apps/")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["title"] == "Cache Monitor Admin"
    assert data[0]["problem"]["title"] == "DB Lock"


def test_get_app_success(client, mock_db):
    from datetime import datetime
    mock_db.apps.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4580"),
            "title": "Cache Monitor Admin",
            "description": "Core features...",
            "github_url": "https://github.com/owner/repo",
            "live_url": "https://myprototype.vercel.app",
            "problem_id": ObjectId("60b8d5a1b55a8b0c848b4567"),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
    )
    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4567"), "title": "DB Lock"}
    )

    res = client.get("/api/apps/60b8d5a1b55a8b0c848b4580")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Cache Monitor Admin"
    assert data["github_url"] == "https://github.com/owner/repo"
    assert data["problem"]["title"] == "DB Lock"


def test_get_app_not_found(client, mock_db):
    mock_db.apps.find_one = AsyncMock(return_value=None)
    res = client.get("/api/apps/60b8d5a1b55a8b0c848b4580")
    assert res.status_code == 404
    assert res.json()["detail"] == "App not found"



