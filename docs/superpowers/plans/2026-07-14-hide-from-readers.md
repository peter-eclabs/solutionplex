# Hide-from-Readers Visibility Control — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admin/SuperAdmin mark a Problem card "hidden from readers"; the card and all linked Solutions/Apps become invisible to readers, and direct URL access by a reader redirects to the existing Access Denied dialog.

**Architecture:** A single `hidden` boolean lives on the Problem document (Mongo). Solutions and Apps inherit the flag through their link chain (`solution.problem_id`, `app → solution → problem`). GET endpoints filter/deny based on the caller's role (injected `CurrentUser`). The frontend renders a role-gated toggle and a "Hidden" badge, and redirects 403s to `/unauthorized`.

**Tech Stack:** FastAPI + Motor (Python 3.13, `uv`), Pydantic v2, pytest (+ FastAPI TestClient). React 18 + TypeScript (Vite), TanStack Query, custom fetch client.

---

## File Structure

- Modify `server/schemas/models.py` — add `hidden` to Problem/Solution/App response + create/update models and `AppShort`.
- Create `server/services/visibility.py` — `hidden_problem_ids()` helper.
- Modify `server/services/problems.py` — accept `current_user`; persist/return `hidden`; 403 for hidden+reader.
- Modify `server/services/solutions.py` — accept `current_user`; inherit `hidden`; 403 for hidden-by-link+reader.
- Modify `server/services/apps.py` — accept `current_user`; inherit `hidden`; 403 for hidden-by-link+reader.
- Modify `server/routers/problems.py`, `solutions.py`, `apps.py` — inject `CurrentUser` into GET endpoints, pass to services.
- Create `server/tests/test_visibility.py` — router-level tests for hiding/403/inheritance.
- Modify `client/src/api/client.ts` — add `hidden` to types, `ApiError`, `hidden` params.
- Create `client/src/components/HiddenToggle.tsx`, `client/src/components/HiddenBadge.tsx`.
- Modify `client/src/App.css` — switch + badge styles.
- Modify `client/src/components/ProblemsTab.tsx` — create toggle + list badge.
- Modify `client/src/components/DetailView.tsx` — edit toggle + header badges + 403 redirect.
- Modify `client/src/components/AppsTab.tsx`, `ProblemSolutions.tsx`, `SolutionPrototypes.tsx` — list badges.

---

### Task 1: Schema — add `hidden` fields

**Files:**
- Modify: `server/schemas/models.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_schema_hidden.py`:

```python
from server.schemas.models import (
    AppResponse,
    AppShort,
    ProblemCreate,
    ProblemResponse,
    ProblemUpdate,
    SolutionResponse,
)


def test_problem_response_hidden_defaults_false():
    p = ProblemResponse(
        id="60b8d5a1b55a8b0c848b4501",
        title="T",
        description="D",
        solutions=[],
        created_at="2026-07-08T11:00:00",
        updated_at="2026-07-08T11:00:00",
    )
    assert p.hidden is False


def test_problem_create_accepts_hidden():
    c = ProblemCreate(title="T", description="D", hidden=True)
    assert c.hidden is True


def test_problem_update_hidden_optional():
    u = ProblemUpdate(title="T2")
    assert u.hidden is None
    u2 = ProblemUpdate(hidden=True)
    assert u2.hidden is True


def test_solution_and_app_response_have_hidden():
    s = SolutionResponse(
        id="60b8d5a1b55a8b0c848b4601",
        title="S",
        description="D",
        created_at="2026-07-08T11:00:00",
        updated_at="2026-07-08T11:00:00",
    )
    a = AppResponse(
        id="60b8d5a1b55a8b0c848b4701",
        title="A",
        description="D",
        github_url="https://github.com/x/y",
        created_at="2026-07-08T11:00:00",
        updated_at="2026-07-08T11:00:00",
    )
    assert s.hidden is False
    assert a.hidden is False


def test_app_short_has_hidden():
    s = AppShort(id="60b8d5a1b55a8b0c848b4701", title="A")
    assert s.hidden is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && uv run pytest tests/test_schema_hidden.py -v`
Expected: FAIL — `hidden` attribute does not exist.

- [ ] **Step 3: Add `hidden` to the models**

In `server/schemas/models.py`:

- `ProblemCreate`: add `hidden: bool = False` after `description`.
- `ProblemUpdate`: add `hidden: Optional[bool] = None` after `description`.
- `ProblemResponse`: add `hidden: bool = False` after `updated_at`.
- `SolutionResponse`: add `hidden: bool = False` after `updated_at`.
- `AppShort`: add `hidden: Optional[bool] = None` after `created_at`.
- `AppResponse`: add `hidden: bool = False` after `updated_at`.

Example diff for `ProblemCreate`:

```python
class ProblemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)
    hidden: bool = False
```

Example for `AppShort`:

```python
class AppShort(BaseModel):
    id: str
    code: Optional[str] = None
    title: str
    created_at: Optional[datetime] = None
    hidden: Optional[bool] = None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && uv run pytest tests/test_schema_hidden.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/schemas/models.py server/tests/test_schema_hidden.py
git commit -m "feat(schema): add hidden flag to problem/solution/app models"
```

---

### Task 2: Problems service + router visibility

**Files:**
- Create: `server/services/visibility.py`
- Modify: `server/services/problems.py`
- Modify: `server/routers/problems.py:56-103` (get_problem) and `:36-53` (list_problems)
- Test: `server/tests/test_visibility.py`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/test_visibility.py` with these helpers + problem tests (append solution/app tests in later tasks):

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && uv run pytest tests/test_visibility.py -v`
Expected: FAIL (403 not returned / hidden not filtered / hidden missing).

- [ ] **Step 3: Implement `visibility.py`**

Create `server/services/visibility.py`:

```python
from typing import Set

from server.database import client


async def hidden_problem_ids() -> Set[str]:
    """Return the set of string ids for problems flagged hidden from readers."""
    cursor = client.problems_col.find({"hidden": True}, {"_id": 1})
    docs = await cursor.to_list(length=100)
    return {str(d["_id"]) for d in docs}
```

- [ ] **Step 4: Implement problems service visibility**

In `server/services/problems.py`, update imports and functions:

```python
from typing import List, Optional

from bson import ObjectId

from server.database import client
from server.database.client import next_code
from server.schemas.models import CurrentUser, ProblemCreate, ProblemUpdate, Role
```

`create_problem`:

```python
async def create_problem(data: ProblemCreate) -> dict:
    doc = data.model_dump()
    doc["code"] = await next_code("PBM")
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = doc["created_at"]
    result = await client.problems_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc
```

`get_problem` — add `current_user` param and 403 check:

```python
async def get_problem(problem_id: str, current_user: Optional[CurrentUser] = None) -> Optional[dict]:
    if not ObjectId.is_valid(problem_id):
        return None
    doc = await client.problems_col.find_one({"_id": ObjectId(problem_id)})
    if not doc:
        return None
    if current_user is not None and current_user.role == Role.READER and doc.get("hidden"):
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This problem is hidden from readers",
        )
    solutions_cursor = client.solutions_col.find({"problem_id": ObjectId(problem_id)})
    solutions = await solutions_cursor.to_list(length=100)
    doc["solutions"] = [
        {"id": str(s["_id"]), "title": s["title"]} for s in solutions
    ]
    return doc
```

`list_problems` — add `current_user` param and filter:

```python
async def list_problems(q: Optional[str] = None, current_user: Optional[CurrentUser] = None) -> List[dict]:
    filter_query: dict = {}
    if q:
        filter_query = {
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
            ]
        }
    if current_user is not None and current_user.role == Role.READER:
        filter_query["hidden"] = {"$ne": True}
    cursor = client.problems_col.find(filter_query)
    problems = await cursor.to_list(length=100)

    for p in problems:
        solutions_cursor = client.solutions_col.find({"problem_id": p["_id"]})
        solutions = await solutions_cursor.to_list(length=100)
        p["solutions"] = [
            {"id": str(s["_id"]), "title": s["title"]} for s in solutions
        ]
    return problems
```

`update_problem`: `ProblemUpdate` already includes `hidden`; `exclude_unset=True` keeps it out unless sent. No change needed beyond the existing logic (it already builds `update_fields` from `data.model_dump(exclude_unset=True)` and sets `$set`). Verify `hidden` flows through — it does.

- [ ] **Step 5: Wire the router**

In `server/routers/problems.py`, update imports:

```python
from server.schemas.models import CurrentUser, ProblemCreate, ProblemResponse, ProblemUpdate, Role
```

`get_problem`:

```python
@router.get(
    "/{id}",
    response_model=ProblemResponse,
    dependencies=[Depends(require_role(Role.READER))],
    summary="Get Problem details",
    description="Retrieves detail view for a specific Problem card.",
)
async def get_problem(id: str, user: CurrentUser = Depends(require_role(Role.READER))):
    try:
        doc = await service.get_problem(id, current_user=user)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found"
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve problem {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e
```

`list_problems`:

```python
@router.get(
    "/",
    response_model=List[ProblemResponse],
    dependencies=[Depends(require_role(Role.READER))],
    summary="List all Problems",
    description="Retrieves a list of all Problem cards, optionally filtered by keyword.",
)
async def list_problems(q: Optional[str] = None, user: CurrentUser = Depends(require_role(Role.READER))):
    try:
        return await service.list_problems(q=q, current_user=user)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list problems")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && uv run pytest tests/test_visibility.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/services/visibility.py server/services/problems.py server/routers/problems.py server/tests/test_visibility.py
git commit -m "feat(problems): hide-from-readers visibility with 403 for readers"
```

---

### Task 3: Solutions service + router visibility

**Files:**
- Modify: `server/services/solutions.py`
- Modify: `server/routers/solutions.py:40-83` (list_solutions, get_solution)
- Test: append to `server/tests/test_visibility.py`

- [ ] **Step 1: Write the failing tests** (append to `test_visibility.py`)

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && uv run pytest tests/test_visibility.py -v -k solution`
Expected: FAIL.

- [ ] **Step 3: Implement solutions service visibility**

In `server/services/solutions.py`, update imports:

```python
from server.database import client
from server.database.client import next_code
from server.schemas.models import CurrentUser, Role, SolutionCreate, SolutionUpdate
from server.services.apps import _resolve_label_docs, _union_ref_ids
from server.services.visibility import hidden_problem_ids
```

`populate_solution` — set `hidden` from the linked problem:

```python
async def populate_solution(s: dict) -> dict:
    prob = await client.problems_col.find_one({"_id": s["problem_id"]})
    s["problem"] = (
        {"id": str(prob["_id"]), "code": prob.get("code"), "title": prob["title"]}
        if prob
        else None
    )
    s["hidden"] = bool(prob and prob.get("hidden"))
    # ... (rest unchanged: architectures, infrastructures, apps, effective_*)
```

`get_solution` — add `current_user` and 403 check:

```python
async def get_solution(solution_id: str, current_user: Optional[CurrentUser] = None) -> Optional[dict]:
    if not ObjectId.is_valid(solution_id):
        return None
    s = await client.solutions_col.find_one({"_id": ObjectId(solution_id)})
    if not s:
        return None
    if current_user is not None and current_user.role == Role.READER:
        prob = await client.problems_col.find_one({"_id": s["problem_id"]})
        if prob and prob.get("hidden"):
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This solution is hidden from readers",
            )
    return await populate_solution(s)
```

`list_solutions` — add `current_user` and filter:

```python
async def list_solutions(q: Optional[str] = None, current_user: Optional[CurrentUser] = None) -> List[dict]:
    filter_query = {}
    if q:
        filter_query = {
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
            ]
        }
    cursor = client.solutions_col.find(filter_query)
    solutions = await cursor.to_list(length=100)

    if current_user is not None and current_user.role == Role.READER:
        hidden_ids = await hidden_problem_ids()
        solutions = [s for s in solutions if str(s.get("problem_id")) not in hidden_ids]

    resolved_list = []
    for s in solutions:
        resolved_list.append(await populate_solution(s))
    return resolved_list
```

Also set `hidden` on each app short in `populate_solution` (apps list block):

```python
    apps = await app_cursor.to_list(length=100)
    s["apps"] = [
        {
            "id": str(a["_id"]),
            "code": a.get("code"),
            "title": a["title"],
            "created_at": a.get("created_at"),
            "hidden": bool(prob and prob.get("hidden")),
        }
        for a in apps
    ]
```

- [ ] **Step 4: Wire the router**

In `server/routers/solutions.py`, update imports:

```python
from server.schemas.models import CurrentUser, Role, SolutionCreate, SolutionResponse, SolutionUpdate
```

`list_solutions`:

```python
async def list_solutions(q: Optional[str] = None, user: CurrentUser = Depends(require_role(Role.READER))):
    try:
        return await service.list_solutions(q=q, current_user=user)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list solutions")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e
```

`get_solution`:

```python
async def get_solution(id: str, user: CurrentUser = Depends(require_role(Role.READER))):
    try:
        doc = await service.get_solution(id, current_user=user)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Solution not found",
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve solution {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && uv run pytest tests/test_visibility.py -v -k solution`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/services/solutions.py server/routers/solutions.py server/tests/test_visibility.py
git commit -m "feat(solutions): inherit hidden-from-readers via linked problem"
```

---

### Task 4: Apps service + router visibility

**Files:**
- Modify: `server/services/apps.py`
- Modify: `server/routers/apps.py:40-106` (list_apps, get_app)
- Test: append to `server/tests/test_visibility.py`

- [ ] **Step 1: Write the failing tests** (append to `test_visibility.py`)

```python
def test_get_app_linked_hidden_problem_reader_403(client, mock_db, reader_headers):
    mock_db.apps.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4701"),
            "title": "A",
            "description": "d",
            "github_url": "https://github.com/x/y",
            "solution_id": ObjectId("60b8d5a1b55a8b0c848b4601"),
            "created_at": NOW,
            "updated_at": NOW,
        }
    )
    mock_db.solutions.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4601"),
            "title": "S",
            "problem_id": ObjectId("60b8d5a1b55a8b0c848b4502"),
        }
    )
    mock_db.problems.find_one = AsyncMock(
        return_value={
            "_id": ObjectId("60b8d5a1b55a8b0c848b4502"),
            "title": "P",
            "hidden": True,
        }
    )
    res = client.get("/api/apps/60b8d5a1b55a8b0c848b4701", headers=reader_headers)
    assert res.status_code == 403


def test_list_apps_reader_excludes_hidden_problem(client, mock_db, reader_headers):
    hidden_pid = ObjectId("60b8d5a1b55a8b0c848b4502")
    sol_id = ObjectId("60b8d5a1b55a8b0c848b4601")
    mock_db.problems.find = MagicMock(
        side_effect=lambda f=None, *a, **k: _cursor(
            [{"_id": hidden_pid, "title": "P", "hidden": True}]
        )
    )
    mock_db.apps.find = MagicMock(
        side_effect=lambda f=None, *a, **k: _cursor(
            [
                {
                    "_id": ObjectId("60b8d5a1b55a8b0c848b4701"),
                    "title": "A1",
                    "description": "d",
                    "github_url": "https://github.com/x/y",
                    "solution_id": sol_id,
                    "created_at": NOW,
                    "updated_at": NOW,
                },
                {
                    "_id": ObjectId("60b8d5a1b55a8b0c848b4702"),
                    "title": "A2",
                    "description": "d",
                    "github_url": "https://github.com/x/z",
                    "solution_id": None,
                    "created_at": NOW,
                    "updated_at": NOW,
                },
            ]
        )
    )
    mock_db.solutions.find_one = AsyncMock(
        return_value={"_id": sol_id, "title": "S", "problem_id": hidden_pid}
    )
    mock_db.architectures.find = MagicMock(return_value=_cursor([]))
    res = client.get("/api/apps/", headers=reader_headers)
    assert res.status_code == 200
    out = res.json()
    # A1 linked to hidden problem excluded; A2 has no solution so visible
    assert len(out) == 1
    assert out[0]["title"] == "A2"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && uv run pytest tests/test_visibility.py -v -k app`
Expected: FAIL.

- [ ] **Step 3: Implement apps service visibility**

In `server/services/apps.py`, update imports:

```python
from server.database import client
from server.database.client import next_code
from server.schemas.models import AppCreate, AppUpdate, CurrentUser, Role
from server.services.visibility import hidden_problem_ids
```

`populate_app` — compute `hidden` from the linked problem, and set it:

```python
async def populate_app(a: dict) -> dict:
    sol: Optional[dict] = None
    sol_id = a.get("solution_id")
    problem_hidden = False
    if sol_id:
        sol = await client.solutions_col.find_one(
            {"_id": ObjectId(sol_id) if isinstance(sol_id, str) else sol_id}
        )
        if sol:
            a["solution"] = {
                "id": str(sol["_id"]),
                "code": sol.get("code"),
                "title": sol["title"],
            }
            prob = await client.problems_col.find_one({"_id": sol["problem_id"]})
            if prob:
                problem_hidden = bool(prob.get("hidden"))
                a["problem"] = {
                    "id": str(prob["_id"]),
                    "code": prob.get("code"),
                    "title": prob["title"],
                }
        else:
            a["solution"] = None
            a["problem"] = None
    else:
        a["solution"] = None
        a["problem"] = None

    if a["solution"]:
        a["solutions"] = [a["solution"]]
    else:
        a["solutions"] = []

    a["hidden"] = problem_hidden

    await _populate_effective_labels(a, sol)
    return a
```

`get_app` — add `current_user` and 403 check:

```python
async def get_app(app_id: str, current_user: Optional[CurrentUser] = None) -> Optional[dict]:
    if not ObjectId.is_valid(app_id):
        return None
    a = await client.apps_col.find_one({"_id": ObjectId(app_id)})
    if not a:
        return None
    if current_user is not None and current_user.role == Role.READER:
        sol_id = a.get("solution_id")
        if sol_id:
            sol = await client.solutions_col.find_one(
                {"_id": ObjectId(sol_id) if isinstance(sol_id, str) else sol_id}
            )
            if sol:
                prob = await client.problems_col.find_one({"_id": sol["problem_id"]})
                if prob and prob.get("hidden"):
                    from fastapi import HTTPException, status

                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="This app is hidden from readers",
                    )
    return await populate_app(a)
```

`list_apps` — add `current_user` and filter:

```python
async def list_apps(q: Optional[str] = None, current_user: Optional[CurrentUser] = None) -> List[dict]:
    filter_query = {}
    if q:
        filter_query = {
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
            ]
        }
    cursor = client.apps_col.find(filter_query)
    apps = await cursor.to_list(length=100)

    hidden_ids: set[str] = set()
    if current_user is not None and current_user.role == Role.READER:
        hidden_ids = await hidden_problem_ids()

    resolved_list = []
    for a in apps:
        pop = await populate_app(a)
        if hidden_ids and pop.get("problem") and pop["problem"]["id"] in hidden_ids:
            continue
        resolved_list.append(pop)
    return resolved_list
```

- [ ] **Step 4: Wire the router**

In `server/routers/apps.py`, update imports:

```python
from server.schemas.models import AppCreate, AppResponse, AppUpdate, CurrentUser, Role
```

`list_apps`:

```python
async def list_apps(q: Optional[str] = None, user: CurrentUser = Depends(require_role(Role.READER))):
    try:
        return await service.list_apps(q=q, current_user=user)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list apps")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e
```

`get_app`:

```python
async def get_app(id: str, user: CurrentUser = Depends(require_role(Role.READER))):
    try:
        doc = await service.get_app(id, current_user=user)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="App not found"
            )
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve app {id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e
```

- [ ] **Step 5: Run the full visibility suite**

Run: `cd server && uv run pytest tests/test_visibility.py -v`
Expected: PASS

- [ ] **Step 6: Run pyright**

Run: `cd server && uv run pyright`
Expected: no errors (address any `hidden`/import type issues).

- [ ] **Step 7: Commit**

```bash
git add server/services/apps.py server/routers/apps.py server/tests/test_visibility.py
git commit -m "feat(apps): inherit hidden-from-readers via linked problem"
```

---

### Task 5: Frontend API client — types, `ApiError`, params

**Files:**
- Modify: `client/src/api/client.ts`

- [ ] **Step 1: Add `hidden` to the interfaces**

In `client.ts`:

```ts
export interface AppShort {
  id: string;
  code?: string | null;
  title: string;
  created_at?: string;
  hidden?: boolean | null;
}
```

Add `hidden?: boolean;` to `Problem`, `Solution`, and `AppPrototype` interfaces.

- [ ] **Step 2: Add `ApiError` and tag 403**

At the bottom of `client.ts` (before `api`), add:

```ts
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
```

In `request<T>`, replace the error block:

```ts
  if (!response.ok) {
    const errorMsg = await response.text();
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.reload();
      throw new ApiError(401, 'Session expired');
    }
    throw new ApiError(
      response.status,
      errorMsg || `API request failed with status ${response.status}`,
    );
  }
```

- [ ] **Step 3: Add `hidden` to create/update payloads**

```ts
  createProblem: (data: { title: string; description: string; hidden?: boolean }) =>
    request<Problem>('/api/problems/', { method: 'POST', body: JSON.stringify(data) }),
  updateProblem: (id: string, data: { title?: string; description?: string; hidden?: boolean }) =>
    request<Problem>(`/api/problems/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
```

- [ ] **Step 4: Type-check the client**

Run: `cd client && npx tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/api/client.ts
git commit -m "feat(client): add hidden field, ApiError, hide params to API client"
```

---

### Task 6: `HiddenToggle` + `HiddenBadge` components + CSS

**Files:**
- Create: `client/src/components/HiddenToggle.tsx`
- Create: `client/src/components/HiddenBadge.tsx`
- Modify: `client/src/App.css`

- [ ] **Step 1: Create `HiddenBadge.tsx`**

```tsx
export function HiddenBadge() {
  return <span className="hidden-badge">Hidden</span>;
}
```

- [ ] **Step 2: Create `HiddenToggle.tsx`**

```tsx
interface HiddenToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function HiddenToggle({ checked, onChange, disabled }: HiddenToggleProps) {
  return (
    <div className="form-field hidden-toggle-field">
      <label className="hidden-toggle-label">
        <span>Hide from readers?</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </label>
      <p className="field-hint">
        Hidden cards are visible only to Admin/SuperAdmin. Linked solutions and apps
        are hidden automatically.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Add CSS to `App.css`**

Append:

```css
.hidden-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.1rem 0.45rem;
  font-size: 0.62rem;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bg-primary);
  background: var(--accent-problem);
  border-radius: 3px;
  vertical-align: middle;
}

.hidden-toggle-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.field-hint {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex: none;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch .slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-grid);
  transition: 0.2s;
  border-radius: 24px;
}

.switch .slider::before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background: var(--text-secondary);
  transition: 0.2s;
  border-radius: 50%;
}

.switch input:checked + .slider {
  background: var(--accent-problem);
  border-color: var(--accent-problem);
}

.switch input:checked + .slider::before {
  transform: translateX(20px);
  background: var(--bg-primary);
}

.switch input:disabled + .slider {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/HiddenToggle.tsx client/src/components/HiddenBadge.tsx client/src/App.css
git commit -m "feat(ui): add HiddenToggle and HiddenBadge components with styles"
```

---

### Task 7: ProblemsTab — create toggle + list badge

**Files:**
- Modify: `client/src/components/ProblemsTab.tsx`

- [ ] **Step 1: Add state + toggle to the create form**

Imports: add `import { HiddenToggle } from './HiddenToggle';` and `import { HiddenBadge } from './HiddenBadge';`.

Add state next to `description`:

```ts
  const [hidden, setHidden] = useState(false);
```

Reset in `handleSubmit` after success:

```ts
      setTitle('');
      setDescription('');
      setHidden(false);
      setIsFormOpen(false);
```

Update the mutation call to pass `hidden`:

```ts
      await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        hidden,
      });
```

Inside the creation `<form>`, after the description `form-field` and before the submit button, add:

```tsx
                <HiddenToggle checked={hidden} onChange={setHidden} />
```

- [ ] **Step 2: Add the badge to the problem card**

In the `{problems.map((p) => (...))}` card, inside `.card-header` after `<CardTitle .../>`, add:

```tsx
                {p.hidden && <HiddenBadge />}
```

- [ ] **Step 3: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ProblemsTab.tsx
git commit -m "feat(problems-tab): add hide-from-readers toggle and hidden badge"
```

---

### Task 8: DetailView — edit toggle, header badges, 403 redirect

**Files:**
- Modify: `client/src/components/DetailView.tsx`

- [ ] **Step 1: Imports + 403 redirect effect**

Add imports:

```ts
import { ApiError } from '../api/client';
import { HiddenToggle } from './HiddenToggle';
import { HiddenBadge } from './HiddenBadge';
```

Add state next to `editDescription`:

```ts
  const [editHidden, setEditHidden] = useState(false);
```

In the hydrate `useEffect` (the `if (data.kind === 'problems')` block), add:

```ts
      setEditHidden(data.problemData.hidden ?? false);
```

Add an effect to redirect readers on 403 (place after the other effects):

```ts
  // Readers hitting a hidden card's URL directly get the Access Denied dialog.
  useEffect(() => {
    if (queryError instanceof ApiError && queryError.status === 403 && !isEditing) {
      onNavigate('/unauthorized');
    }
  }, [queryError, isEditing, onNavigate]);
```

- [ ] **Step 2: Persist `hidden` on save**

In `updateMutation` (`component === 'problems'` branch), include `hidden`:

```ts
      if (component === 'problems') {
        return api.updateProblem(id, {
          title: editTitle.trim(),
          description: editDescription.trim(),
          hidden: editHidden,
        });
      }
```

- [ ] **Step 3: Add the toggle to the problem edit form**

In the edit `<form>`, after the description `form-field` and before the relationship inputs block (`{component === 'solutions' && (...)}`), add:

```tsx
              {component === 'problems' && canWrite && (
                <HiddenToggle checked={editHidden} onChange={setEditHidden} />
              )}
```

- [ ] **Step 4: Add header badges**

In the viewer (non-edit) block, in `.viewer-header`, after `<h2>{getEntityTitle()}</h2>`, add:

```tsx
                {component === 'problems' && problemData?.hidden && <HiddenBadge />}
                {component === 'solutions' && solutionData?.hidden && <HiddenBadge />}
                {component === 'apps' && appData?.hidden && <HiddenBadge />}
```

- [ ] **Step 5: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/DetailView.tsx
git commit -m "feat(detail): hide toggle, hidden badges, 403 -> unauthorized redirect"
```

---

### Task 9: List badges for Apps, embedded Solutions, embedded Apps

**Files:**
- Modify: `client/src/components/AppsTab.tsx`
- Modify: `client/src/components/ProblemSolutions.tsx`
- Modify: `client/src/components/SolutionPrototypes.tsx`

- [ ] **Step 1: AppsTab badge**

In `AppsTab.tsx`, import `HiddenBadge` and add inside the app card `.card-header` after `<CardTitle .../>`:

```tsx
                {app.hidden && <HiddenBadge />}
```

- [ ] **Step 2: ProblemSolutions badge**

In `ProblemSolutions.tsx`, import `HiddenBadge` and add inside the `.problem-solution-link` button after the title span:

```tsx
                <span className="problem-solution-title">{s.title}</span>
                {s.hidden && <HiddenBadge />}
```

- [ ] **Step 3: SolutionPrototypes badge**

In `SolutionPrototypes.tsx`, import `HiddenBadge` and add after the title span in the link button:

```tsx
                 <span className="problem-solution-title">{app.title}</span>
                 {app.hidden && <HiddenBadge />}
```

(`app` here is `AppShort` which now has `hidden`.)

- [ ] **Step 4: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AppsTab.tsx client/src/components/ProblemSolutions.tsx client/src/components/SolutionPrototypes.tsx
git commit -m "feat(ui): show Hidden badge on app/solution list cards"
```

---

### Task 10: Verification

**Files:** (no new files)

- [ ] **Step 1: Backend type-check + tests**

Run: `cd server && uv run pyright && uv run pytest`
Expected: pyright clean; all tests pass (including `test_visibility.py` and existing `test_routers.py`).

- [ ] **Step 2: Frontend type-check + lint + build**

Run: `cd client && npx tsc --noEmit && npm run lint && npm run build`
Expected: clean type-check, lint passes, production build succeeds.

- [ ] **Step 3: Final commit (if any fixups)**

If verification surfaced fixes, commit them:

```bash
git add -A && git commit -m "fix: address verification issues for hide-from-readers"
```

---

## Self-Review Notes

- **Spec coverage:** Toggle on create (Task 7) + edit (Task 8) ✓; invisible to readers (Tasks 2-4 server filtering + 403) ✓; direct-URL 403 → `/unauthorized` (Task 8 effect) ✓; linked solutions/apps auto-hidden (Tasks 3-4 inheritance) ✓; toggle hidden from readers (`canWrite` guard — create modal is `canWrite`-gated; edit toggle guarded by `canWrite`) ✓; badge for admins (Tasks 6-9) ✓.
- **No placeholders:** All steps contain concrete code.
- **Type consistency:** `hidden` added to `Problem`/`Solution`/`AppPrototype`/`AppShort` on both server (`models.py`) and client (`client.ts`); `ApiError.status` used consistently in `DetailView`. Service signatures use `current_user: Optional[CurrentUser] = None` so non-request callers (e.g. `create_solution` → `get_solution(id)`) keep working.
