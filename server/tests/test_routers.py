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
    assert data["code"] == "PBM-001"


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
    mock_db.solutions.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4570"), "code": "SOL-001", "title": "Fix locks", "problem_id": ObjectId("60b8d5a1b55a8b0c848b4567")}
    )
    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4567"), "code": "PBM-001", "title": "DB Lock"}
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
            "code": "APP-001",
            "description": "Core features and target users...",
            "github_url": "https://github.com/owner/repo",
            "live_url": "https://myprototype.vercel.app",
            "solution_id": ObjectId("60b8d5a1b55a8b0c848b4570"),
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
            "solution_id": "60b8d5a1b55a8b0c848b4570",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Cache Monitor Admin"
    assert data["code"] == "APP-001"
    assert data["github_url"] == "https://github.com/owner/repo"
    assert data["live_url"] == "https://myprototype.vercel.app"
    assert data["solution"]["title"] == "Fix locks"
    assert data["problem"]["title"] == "DB Lock"
    assert data["problem"]["code"] == "PBM-001"


def test_create_app_invalid_solution(client, mock_db):
    # If solution is not found, return 400
    mock_db.solutions.find_one = AsyncMock(return_value=None)
    res = client.post(
        "/api/apps/",
        json={
            "title": "Cache Monitor Admin",
            "description": "Core features and target users...",
            "github_url": "https://github.com/owner/repo",
            "live_url": "https://myprototype.vercel.app",
            "solution_id": "60b8d5a1b55a8b0c848b4570",
        },
    )
    assert res.status_code == 400
    assert "Associated Solution not found" in res.json()["detail"]


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
                "solution_id": ObjectId("60b8d5a1b55a8b0c848b4570"),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        ]
    )
    mock_db.apps.find = MagicMock(return_value=mock_apps_cursor)
    mock_db.solutions.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4570"), "title": "Fix locks", "problem_id": ObjectId("60b8d5a1b55a8b0c848b4567")}
    )
    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4567"), "title": "DB Lock"}
    )

    res = client.get("/api/apps/")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["title"] == "Cache Monitor Admin"
    assert data[0]["solution"]["title"] == "Fix locks"
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
            "solution_id": ObjectId("60b8d5a1b55a8b0c848b4570"),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
    )
    mock_db.solutions.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4570"), "title": "Fix locks", "problem_id": ObjectId("60b8d5a1b55a8b0c848b4567")}
    )
    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": ObjectId("60b8d5a1b55a8b0c848b4567"), "title": "DB Lock"}
    )

    res = client.get("/api/apps/60b8d5a1b55a8b0c848b4580")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Cache Monitor Admin"
    assert data["github_url"] == "https://github.com/owner/repo"
    assert data["solution"]["title"] == "Fix locks"
    assert data["problem"]["title"] == "DB Lock"


def test_get_app_not_found(client, mock_db):
    mock_db.apps.find_one = AsyncMock(return_value=None)
    res = client.get("/api/apps/60b8d5a1b55a8b0c848b4580")
    assert res.status_code == 404
    assert res.json()["detail"] == "App not found"


def test_problem_solution_app_relationship(client, mock_db):
    from datetime import datetime
    problem_id = ObjectId("60b8d5a1b55a8b0c848b4567")
    solution_id = ObjectId("60b8d5a1b55a8b0c848b4570")
    app_id = ObjectId("60b8d5a1b55a8b0c848b4580")

    # Mock database responses for solution populate
    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": problem_id, "title": "DB Lock"}
    )
    
    mock_arch_cursor = AsyncMock()
    mock_arch_cursor.to_list = AsyncMock(return_value=[])
    mock_db.architectures.find = MagicMock(return_value=mock_arch_cursor)

    mock_infra_cursor = AsyncMock()
    mock_infra_cursor.to_list = AsyncMock(return_value=[])
    mock_db.infrastructures.find = MagicMock(return_value=mock_infra_cursor)

    # When get_solution is called, it calls client.apps_col.find
    mock_apps_cursor = AsyncMock()
    mock_apps_cursor.to_list = AsyncMock(
        return_value=[{"_id": app_id, "title": "Cache Monitor Admin"}]
    )
    mock_db.apps.find = MagicMock(return_value=mock_apps_cursor)

    # Set up solution mock find_one
    mock_db.solutions.find_one = AsyncMock(
        return_value={
            "_id": solution_id,
            "title": "Fix locks",
            "description": "Add connection pooling",
            "problem_id": problem_id,
            "architecture_ids": [],
            "infrastructure_ids": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
    )

    # Call get_solution api endpoint
    res_sol = client.get(f"/api/solutions/{solution_id}")
    assert res_sol.status_code == 200
    data_sol = res_sol.json()
    assert data_sol["apps"][0]["id"] == str(app_id)
    assert data_sol["apps"][0]["title"] == "Cache Monitor Admin"

    # Now verify get_app resolves solution
    mock_db.solutions.find_one = AsyncMock(
        return_value={"_id": solution_id, "title": "Fix locks", "problem_id": problem_id}
    )

    # Set up app mock find_one
    mock_db.apps.find_one = AsyncMock(
        return_value={
            "_id": app_id,
            "title": "Cache Monitor Admin",
            "description": "Core features...",
            "github_url": "https://github.com/owner/repo",
            "live_url": "https://myprototype.vercel.app",
            "solution_id": solution_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
    )

    # Call get_app api endpoint
    res_app = client.get(f"/api/apps/{app_id}")
    assert res_app.status_code == 200
    data_app = res_app.json()
    assert data_app["solution"]["id"] == str(solution_id)
    assert data_app["solution"]["title"] == "Fix locks"




def test_create_app_with_own_labels_no_solution(client, mock_db):
    from datetime import datetime

    arch_id = ObjectId("60b8d5a1b55a8b0c848b4568")
    infra_id = ObjectId("60b8d5a1b55a8b0c848b4569")
    app_id = ObjectId("60b8d5a1b55a8b0c848b4581")

    mock_db.architectures.find_one = AsyncMock(
        return_value={"_id": arch_id, "code": "ARC-001", "title": "CQRS"}
    )
    mock_db.infrastructures.find_one = AsyncMock(
        return_value={"_id": infra_id, "code": "INF-001", "title": "Redis"}
    )

    inserted = {}

    async def capture_insert(doc):
        inserted["doc"] = doc
        return type("Result", (object,), {"inserted_id": app_id})()

    mock_db.apps.insert_one = AsyncMock(side_effect=capture_insert)

    async def find_app(query):
        return {
            "_id": app_id,
            "title": "Standalone Demo",
            "code": "APP-002",
            "description": "No solution link",
            "github_url": "https://github.com/owner/standalone",
            "live_url": None,
            "solution_id": None,
            "architecture_ids": [arch_id],
            "infrastructure_ids": [infra_id],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

    mock_db.apps.find_one = AsyncMock(side_effect=find_app)

    # populate_app resolves arch/infra via find with $in — mock cursor
    arch_cursor = MagicMock()
    arch_cursor.to_list = AsyncMock(
        return_value=[{"_id": arch_id, "code": "ARC-001", "title": "CQRS"}]
    )
    infra_cursor = MagicMock()
    infra_cursor.to_list = AsyncMock(
        return_value=[{"_id": infra_id, "code": "INF-001", "title": "Redis"}]
    )

    def find_side_effect(query):
        if "_id" in query and isinstance(query["_id"], dict) and "$in" in query["_id"]:
            ids = query["_id"]["$in"]
            if arch_id in ids:
                return arch_cursor
            if infra_id in ids:
                return infra_cursor
        cursor = MagicMock()
        cursor.to_list = AsyncMock(return_value=[])
        return cursor

    mock_db.architectures.find = MagicMock(side_effect=find_side_effect)
    mock_db.infrastructures.find = MagicMock(side_effect=find_side_effect)

    res = client.post(
        "/api/apps/",
        json={
            "title": "Standalone Demo",
            "description": "No solution link",
            "github_url": "https://github.com/owner/standalone",
            "architecture_ids": [str(arch_id)],
            "infrastructure_ids": [str(infra_id)],
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["solution"] is None
    assert len(data["architectures"]) == 1
    assert data["architectures"][0]["title"] == "CQRS"
    assert len(data["infrastructures"]) == 1
    assert data["infrastructures"][0]["title"] == "Redis"
    assert inserted["doc"]["architecture_ids"] == [arch_id]
    assert inserted["doc"]["infrastructure_ids"] == [infra_id]
    assert inserted["doc"]["solution_id"] is None


def test_app_inherits_solution_labels_when_linked(client, mock_db):
    from datetime import datetime

    sol_id = ObjectId("60b8d5a1b55a8b0c848b4570")
    arch_sol = ObjectId("60b8d5a1b55a8b0c848b4568")
    infra_sol = ObjectId("60b8d5a1b55a8b0c848b4569")
    arch_own = ObjectId("60b8d5a1b55a8b0c848b4578")
    app_id = ObjectId("60b8d5a1b55a8b0c848b4580")
    problem_id = ObjectId("60b8d5a1b55a8b0c848b4567")

    mock_db.apps.find_one = AsyncMock(
        return_value={
            "_id": app_id,
            "title": "Cache Monitor Admin",
            "code": "APP-001",
            "description": "desc",
            "github_url": "https://github.com/owner/repo",
            "live_url": None,
            "solution_id": sol_id,
            "architecture_ids": [arch_own],
            "infrastructure_ids": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
    )
    mock_db.solutions.find_one = AsyncMock(
        return_value={
            "_id": sol_id,
            "code": "SOL-001",
            "title": "Fix locks",
            "problem_id": problem_id,
            "architecture_ids": [arch_sol],
            "infrastructure_ids": [infra_sol],
        }
    )
    mock_db.problems.find_one = AsyncMock(
        return_value={"_id": problem_id, "code": "PBM-001", "title": "DB Lock"}
    )

    arch_cursor = MagicMock()
    arch_cursor.to_list = AsyncMock(
        return_value=[{"_id": arch_sol, "code": "ARC-001", "title": "Instructor"}]
    )
    infra_cursor = MagicMock()
    infra_cursor.to_list = AsyncMock(
        return_value=[{"_id": infra_sol, "code": "INF-001", "title": "LangChain"}]
    )

    def find_side_effect(query):
        ids = (
            query.get("_id", {}).get("$in", [])
            if isinstance(query.get("_id"), dict)
            else []
        )
        if arch_sol in ids:
            return arch_cursor
        if infra_sol in ids:
            return infra_cursor
        c = MagicMock()
        c.to_list = AsyncMock(return_value=[])
        return c

    mock_db.architectures.find = MagicMock(side_effect=find_side_effect)
    mock_db.infrastructures.find = MagicMock(side_effect=find_side_effect)

    res = client.get(f"/api/apps/{app_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["architectures"][0]["title"] == "Instructor"
    assert data["infrastructures"][0]["title"] == "LangChain"
    assert all(a["id"] != str(arch_own) for a in data["architectures"])


def test_app_uses_own_labels_when_unlinked(client, mock_db):
    from datetime import datetime

    arch_own = ObjectId("60b8d5a1b55a8b0c848b4578")
    infra_own = ObjectId("60b8d5a1b55a8b0c848b4579")
    app_id = ObjectId("60b8d5a1b55a8b0c848b4580")

    mock_db.apps.find_one = AsyncMock(
        return_value={
            "_id": app_id,
            "title": "Standalone",
            "code": "APP-003",
            "description": "desc",
            "github_url": "https://github.com/owner/repo",
            "live_url": None,
            "solution_id": None,
            "architecture_ids": [arch_own],
            "infrastructure_ids": [infra_own],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
    )

    arch_cursor = MagicMock()
    arch_cursor.to_list = AsyncMock(
        return_value=[{"_id": arch_own, "code": "ARC-009", "title": "OwnArch"}]
    )
    infra_cursor = MagicMock()
    infra_cursor.to_list = AsyncMock(
        return_value=[{"_id": infra_own, "code": "INF-009", "title": "OwnInfra"}]
    )

    def find_side_effect(query):
        ids = (
            query.get("_id", {}).get("$in", [])
            if isinstance(query.get("_id"), dict)
            else []
        )
        if arch_own in ids:
            return arch_cursor
        if infra_own in ids:
            return infra_cursor
        c = MagicMock()
        c.to_list = AsyncMock(return_value=[])
        return c

    mock_db.architectures.find = MagicMock(side_effect=find_side_effect)
    mock_db.infrastructures.find = MagicMock(side_effect=find_side_effect)

    res = client.get(f"/api/apps/{app_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["architectures"][0]["title"] == "OwnArch"
    assert data["infrastructures"][0]["title"] == "OwnInfra"


def test_delete_architecture_pulls_from_apps(client, mock_db):
    arch_id = ObjectId("60b8d5a1b55a8b0c848b4568")
    mock_db.architectures.delete_one = AsyncMock(
        return_value=type("R", (object,), {"deleted_count": 1})()
    )
    mock_db.solutions.update_many = AsyncMock()
    mock_db.apps.update_many = AsyncMock()

    res = client.delete(f"/api/architectures/{arch_id}")
    assert res.status_code == 200
    mock_db.apps.update_many.assert_awaited()
    call = mock_db.apps.update_many.await_args
    assert call is not None
    assert call.args[0] == {"architecture_ids": arch_id}
    assert call.args[1] == {"$pull": {"architecture_ids": arch_id}}


def test_delete_infrastructure_pulls_from_apps(client, mock_db):
    infra_id = ObjectId("60b8d5a1b55a8b0c848b4569")
    mock_db.infrastructures.delete_one = AsyncMock(
        return_value=type("R", (object,), {"deleted_count": 1})()
    )
    mock_db.solutions.update_many = AsyncMock()
    mock_db.apps.update_many = AsyncMock()

    res = client.delete(f"/api/infrastructures/{infra_id}")
    assert res.status_code == 200
    mock_db.apps.update_many.assert_awaited()
    call = mock_db.apps.update_many.await_args
    assert call is not None
    assert call.args[0] == {"infrastructure_ids": infra_id}
    assert call.args[1] == {"$pull": {"infrastructure_ids": infra_id}}

