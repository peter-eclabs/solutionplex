# Label Tags Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Architecture/Infrastructure labels on Apps, inherit Solution labels when linked, and show a fixed single-row chip preview with `+n more` plus a Created-on date on Solution rows and Apps cards (including App-centered Plex nodes).

**Architecture:** Backend stores optional `architecture_ids` / `infrastructure_ids` on app documents and resolves **effective** `architectures` / `infrastructures` on populate (solution’s lists when linked, else app’s own). Frontend adds a shared `LabelPreview` (ResizeObserver, single-row overflow) and replaces description previews with a Created-on line on Solution nested rows and Apps grid cards. Plex app center reuses effective lists for arch/infra outer nodes.

**Tech Stack:** FastAPI + Pydantic v2 + Motor/MongoDB (pytest + pyright); React 19 + TypeScript (strict), Vite, oxlint. Client has **no unit test runner** — verify UI via `npm run build` + `npm run lint` + manual checklist.

**Spec:** `docs/superpowers/specs/2026-07-13-label-tags-preview-design.md`

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `server/schemas/models.py` | AppCreate/Update/Response fields for arch/infra |
| `server/services/apps.py` | Persist IDs; effective populate |
| `server/services/architectures.py` | `$pull` from apps on delete |
| `server/services/infrastructures.py` | `$pull` from apps on delete |
| `server/tests/test_routers.py` | API tests for persistence + inheritance |
| `client/src/api/client.ts` | `AppPrototype.architectures` / `infrastructures` |
| `client/src/components/formatCreatedOn.ts` | Pure date formatter (shared) |
| `client/src/components/LabelPreview.tsx` | Single-row chips + `+n more` |
| `client/src/components/AppsTab.tsx` | Date + LabelPreview on cards |
| `client/src/components/ProblemSolutions.tsx` | Date + LabelPreview on solution rows |
| `client/src/components/PlexVisualizer.tsx` | App-center arch/infra nodes |
| `client/src/components/TabStyles.css` | Label row + date line styles |

---

### Task 1: Backend schema — App arch/infra fields

**Files:**
- Modify: `server/schemas/models.py`
- Test: `server/tests/test_routers.py` (failing create without implementation comes in Task 2–3; here only schema so OpenAPI accepts fields)

- [ ] **Step 1: Extend AppCreate, AppUpdate, AppResponse**

In `server/schemas/models.py`, update the Apps section:

```python
# Apps
class AppCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)
    github_url: str = Field(..., min_length=1)
    live_url: Optional[str] = None
    solution_id: Optional[str] = None
    architecture_ids: List[str] = []
    infrastructure_ids: List[str] = []


class AppUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1)
    github_url: Optional[str] = Field(None, min_length=1)
    live_url: Optional[str] = None
    solution_id: Optional[str] = None
    architecture_ids: Optional[List[str]] = None
    infrastructure_ids: Optional[List[str]] = None


class AppResponse(BaseModel):
    id: PyObjectId = Field(alias="_id", serialization_alias="id")
    code: Optional[str] = None
    title: str
    description: str
    github_url: str
    live_url: Optional[str] = None
    problem: Optional[ProblemShort] = None
    solutions: List[SolutionShort] = []
    solution: Optional[SolutionShort] = None
    architectures: List[ArchitectureShort] = []
    infrastructures: List[InfrastructureShort] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        from_attributes=True,
    )
```

- [ ] **Step 2: Typecheck**

Run from `server/`:

```bash
uv run pyright server/schemas/models.py
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/schemas/models.py
git commit -m "feat(api): add architecture/infrastructure fields to App schemas"
```

---

### Task 2: Backend — create/update app with own labels (TDD)

**Files:**
- Modify: `server/services/apps.py`
- Modify: `server/tests/test_routers.py`

- [ ] **Step 1: Write failing test — create app with arch/infra, no solution**

Append to `server/tests/test_routers.py`:

```python
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
```

Ensure `from unittest.mock import MagicMock` / `AsyncMock` and `from bson import ObjectId` are already imported at top of the test file (they are in existing tests).

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd server
uv run pytest tests/test_routers.py::test_create_app_with_own_labels_no_solution -v
```

Expected: FAIL (fields ignored / architectures empty / validation).

- [ ] **Step 3: Implement create + populate helpers in `server/services/apps.py`**

Replace `create_app` and extend `populate_app` as follows (full file-level intent):

```python
async def _resolve_ref_ids(
    ids: list[str],
    collection,
    label: str,
) -> list[ObjectId]:
    object_ids: list[ObjectId] = []
    for raw in ids:
        if not ObjectId.is_valid(raw):
            raise ValueError(f"Invalid {label}: {raw}")
        exists = await collection.find_one({"_id": ObjectId(raw)})
        if not exists:
            raise ValueError(f"Associated {label} not found: {raw}")
        object_ids.append(ObjectId(raw))
    return object_ids


async def create_app(data: AppCreate) -> dict:
    sol_object_id = None
    if data.solution_id:
        if not ObjectId.is_valid(data.solution_id):
            raise ValueError("Invalid solution_id")
        sol_exists = await client.solutions_col.find_one(
            {"_id": ObjectId(data.solution_id)}
        )
        if not sol_exists:
            raise ValueError("Associated Solution not found")
        sol_object_id = ObjectId(data.solution_id)

    arch_object_ids = await _resolve_ref_ids(
        data.architecture_ids, client.architectures_col, "architecture_id"
    )
    infra_object_ids = await _resolve_ref_ids(
        data.infrastructure_ids, client.infrastructures_col, "infrastructure_id"
    )

    doc = {
        "title": data.title,
        "description": data.description,
        "github_url": data.github_url,
        "live_url": data.live_url,
        "solution_id": sol_object_id,
        "architecture_ids": arch_object_ids,
        "infrastructure_ids": infra_object_ids,
        "code": await next_code("APP"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await client.apps_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def _populate_effective_labels(a: dict, sol: dict | None) -> None:
    if sol is not None:
        arch_ids = sol.get("architecture_ids", [])
        infra_ids = sol.get("infrastructure_ids", [])
    else:
        arch_ids = a.get("architecture_ids", []) or []
        infra_ids = a.get("infrastructure_ids", []) or []

    arch_cursor = client.architectures_col.find({"_id": {"$in": arch_ids}})
    archs = await arch_cursor.to_list(length=100)
    a["architectures"] = [
        {"id": str(x["_id"]), "code": x.get("code"), "title": x["title"]} for x in archs
    ]

    infra_cursor = client.infrastructures_col.find({"_id": {"$in": infra_ids}})
    infras = await infra_cursor.to_list(length=100)
    a["infrastructures"] = [
        {"id": str(x["_id"]), "code": x.get("code"), "title": x["title"]} for x in infras
    ]


async def populate_app(a: dict) -> dict:
    sol_id = a.get("solution_id")
    sol_doc = None
    if sol_id:
        sol_doc = await client.solutions_col.find_one(
            {"_id": ObjectId(sol_id) if isinstance(sol_id, str) else sol_id}
        )
        if sol_doc:
            a["solution"] = {
                "id": str(sol_doc["_id"]),
                "code": sol_doc.get("code"),
                "title": sol_doc["title"],
            }
            prob = await client.problems_col.find_one({"_id": sol_doc["problem_id"]})
            a["problem"] = (
                {
                    "id": str(prob["_id"]),
                    "code": prob.get("code"),
                    "title": prob["title"],
                }
                if prob
                else None
            )
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

    await _populate_effective_labels(a, sol_doc if a.get("solution") else None)
    return a
```

Also update `update_app` so when `architecture_ids` / `infrastructure_ids` are present in `update_fields`, validate and convert to ObjectIds (mirror solutions service):

```python
    if "architecture_ids" in update_fields:
        update_fields["architecture_ids"] = await _resolve_ref_ids(
            update_fields["architecture_ids"] or [],
            client.architectures_col,
            "architecture_id",
        )
    if "infrastructure_ids" in update_fields:
        update_fields["infrastructure_ids"] = await _resolve_ref_ids(
            update_fields["infrastructure_ids"] or [],
            client.infrastructures_col,
            "infrastructure_id",
        )
```

Place these blocks after the existing `solution_id` handling and before the empty-update early return. Ensure `model_dump` still includes them when set (they are already in AppUpdate).

- [ ] **Step 4: Run test — expect PASS**

```bash
cd server
uv run pytest tests/test_routers.py::test_create_app_with_own_labels_no_solution -v
```

Expected: PASS.

- [ ] **Step 5: Run existing app tests**

```bash
uv run pytest tests/test_routers.py -k app -v
uv run pyright
```

Expected: all pass / no errors. Fix any existing tests that break because `populate_app` now calls `architectures.find` — mock_db already returns empty cursors by default, so `architectures`/`infrastructures` should be `[]`.

- [ ] **Step 6: Commit**

```bash
git add server/services/apps.py server/tests/test_routers.py
git commit -m "feat(api): persist and return app-owned architecture/infrastructure labels"
```

---

### Task 3: Backend — inheritance when linked + unlink preserves own IDs (TDD)

**Files:**
- Modify: `server/tests/test_routers.py`
- Modify: `server/services/apps.py` only if tests reveal a gap (populate already implements inheritance in Task 2)

- [ ] **Step 1: Write failing/passing test — linked app inherits solution labels**

```python
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
            "architecture_ids": [arch_own],  # own IDs differ from solution
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
        ids = query.get("_id", {}).get("$in", []) if isinstance(query.get("_id"), dict) else []
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
    # Must not surface own-only arch
    assert all(a["id"] != str(arch_own) for a in data["architectures"])
```

- [ ] **Step 2: Write test — after unlink, own labels return**

```python
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
        ids = query.get("_id", {}).get("$in", []) if isinstance(query.get("_id"), dict) else []
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
```

- [ ] **Step 3: Run tests**

```bash
cd server
uv run pytest tests/test_routers.py::test_app_inherits_solution_labels_when_linked tests/test_routers.py::test_app_uses_own_labels_when_unlinked -v
```

Expected: PASS with Task 2 populate logic. If FAIL, fix `_populate_effective_labels` only.

- [ ] **Step 4: Commit**

```bash
git add server/tests/test_routers.py server/services/apps.py
git commit -m "test(api): cover app label inheritance from linked solution"
```

---

### Task 4: Backend — pull app refs on arch/infra delete (TDD)

**Files:**
- Modify: `server/services/architectures.py`
- Modify: `server/services/infrastructures.py`
- Modify: `server/tests/test_routers.py`

- [ ] **Step 1: Write failing test**

```python
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
    args, kwargs = mock_db.apps.update_many.await_args
    assert args[0] == {"architecture_ids": arch_id}
    assert args[1] == {"$pull": {"architecture_ids": arch_id}}


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
    args, _ = mock_db.apps.update_many.await_args
    assert args[0] == {"infrastructure_ids": infra_id}
    assert args[1] == {"$pull": {"infrastructure_ids": infra_id}}
```

- [ ] **Step 2: Run — expect FAIL** (`apps.update_many` not called)

```bash
cd server
uv run pytest tests/test_routers.py::test_delete_architecture_pulls_from_apps tests/test_routers.py::test_delete_infrastructure_pulls_from_apps -v
```

- [ ] **Step 3: Implement pull in delete handlers**

In `server/services/architectures.py` `delete_architecture`, after solutions pull:

```python
    await client.apps_col.update_many(
        {"architecture_ids": ObjectId(arch_id)},
        {"$pull": {"architecture_ids": ObjectId(arch_id)}},
    )
```

In `server/services/infrastructures.py` `delete_infrastructure`, after solutions pull:

```python
    await client.apps_col.update_many(
        {"infrastructure_ids": ObjectId(infra_id)},
        {"$pull": {"infrastructure_ids": ObjectId(infra_id)}},
    )
```

- [ ] **Step 4: Run tests + full suite**

```bash
cd server
uv run pytest -v
uv run pyright
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/architectures.py server/services/infrastructures.py server/tests/test_routers.py
git commit -m "fix(api): detach deleted arch/infra references from apps"
```

---

### Task 5: Frontend types + `formatCreatedOn` helper

**Files:**
- Modify: `client/src/api/client.ts`
- Create: `client/src/components/formatCreatedOn.ts`

- [ ] **Step 1: Extend `AppPrototype`**

In `client/src/api/client.ts`:

```ts
export interface AppPrototype {
  id: string;
  code?: string | null;
  title: string;
  description: string;
  github_url: string;
  live_url?: string;
  problem: ProblemShort | null;
  solutions: SolutionShort[];
  solution: SolutionShort | null;
  architectures: ArchitectureShort[];
  infrastructures: InfrastructureShort[];
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Create date formatter**

Create `client/src/components/formatCreatedOn.ts`:

```ts
/** Format API ISO timestamps as "Created on: 13 July 2026". */
export function formatCreatedOn(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
  return `Created on: ${formatted}`;
}
```

- [ ] **Step 3: Typecheck**

```bash
cd client
npm run build
```

Expected: tsc succeeds (or only pre-existing unrelated errors). If `AppPrototype` usages need default empty arrays from mocks, fix call sites that construct partial objects.

- [ ] **Step 4: Commit**

```bash
git add client/src/api/client.ts client/src/components/formatCreatedOn.ts
git commit -m "feat(client): app label types and Created-on date formatter"
```

---

### Task 6: `LabelPreview` component + styles

**Files:**
- Create: `client/src/components/LabelPreview.tsx`
- Modify: `client/src/components/TabStyles.css`

- [ ] **Step 1: Implement component**

Create `client/src/components/LabelPreview.tsx`:

```tsx
import { useLayoutEffect, useRef, useState } from 'react';

export interface LabelItem {
  id: string;
  title: string;
}

interface LabelPreviewProps {
  architectures: LabelItem[];
  infrastructures: LabelItem[];
  className?: string;
}

type Chip = { id: string; title: string; kind: 'arch' | 'infra' };

export function LabelPreview({
  architectures,
  infrastructures,
  className = '',
}: LabelPreviewProps) {
  const chips: Chip[] = [
    ...architectures.map((a) => ({ id: a.id, title: a.title, kind: 'arch' as const })),
    ...infrastructures.map((i) => ({ id: i.id, title: i.title, kind: 'infra' as const })),
  ];

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(chips.length);

  useLayoutEffect(() => {
    if (chips.length === 0) return;

    const measure = () => {
      const container = containerRef.current;
      const measureRow = measureRef.current;
      if (!container || !measureRow) return;

      const available = container.clientWidth;
      const children = Array.from(measureRow.children) as HTMLElement[];
      if (children.length === 0) {
        setVisibleCount(0);
        return;
      }

      const moreEl = children[children.length - 1];
      const moreWidth = moreEl.offsetWidth;
      const gap = 4; // match CSS gap 0.3rem ≈ 4–5px; use measured positions if preferred
      const chipEls = children.slice(0, -1);

      let used = 0;
      let fit = 0;
      for (let i = 0; i < chipEls.length; i++) {
        const w = chipEls[i].offsetWidth;
        const remaining = chipEls.length - (i + 1);
        const needMore = remaining > 0;
        const next = used + (fit > 0 ? gap : 0) + w;
        const withMore = needMore ? next + gap + moreWidth : next;
        if (withMore <= available) {
          used = next;
          fit = i + 1;
        } else {
          break;
        }
      }

      // If nothing fits but we have chips, still show +n more alone when possible
      if (fit === 0 && chips.length > 0 && moreWidth <= available) {
        setVisibleCount(0);
        return;
      }
      setVisibleCount(fit);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [chips]);

  if (chips.length === 0) return null;

  const hidden = Math.max(0, chips.length - visibleCount);
  const shown = chips.slice(0, visibleCount);

  return (
    <div className={`label-preview ${className}`.trim()} ref={containerRef}>
      {/* Hidden measure row: all chips + +n more probe */}
      <div className="label-preview-measure" ref={measureRef} aria-hidden="true">
        {chips.map((c) => (
          <span
            key={`m-${c.kind}-${c.id}`}
            className={`solution-tag ${c.kind === 'arch' ? 'tag-arch' : 'tag-infra'}`}
          >
            {c.title}
          </span>
        ))}
        <span className="solution-tag tag-more">+{chips.length} more</span>
      </div>

      <div className="label-preview-row">
        {shown.map((c) => (
          <span
            key={`${c.kind}-${c.id}`}
            className={`solution-tag ${c.kind === 'arch' ? 'tag-arch' : 'tag-infra'}`}
          >
            {c.title}
          </span>
        ))}
        {hidden > 0 && (
          <span className="solution-tag tag-more" title={chips.slice(visibleCount).map((c) => c.title).join(', ')}>
            +{hidden} more
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS** (append to `client/src/components/TabStyles.css`)

```css
/* Label preview — fixed single row + overflow */
.label-preview {
  position: relative;
  width: 100%;
  margin-top: 0.35rem;
  min-height: 1.45rem;
}

.label-preview-measure {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
  display: flex;
  flex-wrap: nowrap;
  gap: 0.3rem;
  white-space: nowrap;
  height: 0;
  overflow: hidden;
}

.label-preview-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.3rem;
  overflow: hidden;
  align-items: center;
  height: 1.45rem;
}

.tag-more {
  color: var(--text-muted);
  border-color: var(--border-grid);
  background-color: var(--bg-primary);
  flex-shrink: 0;
}

.card-created-on {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}

.problem-solution-created {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
  font-style: normal;
  line-height: 1.4;
}

/* Nested solution rows: no wrap on tags (LabelPreview owns layout) */
.problem-solution-tags {
  display: block;
  margin-top: 0.25rem;
  min-width: 0;
}
```

- [ ] **Step 3: Build + lint**

```bash
cd client
npm run build
npm run lint
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/LabelPreview.tsx client/src/components/TabStyles.css
git commit -m "feat(client): add LabelPreview with single-row +n more overflow"
```

---

### Task 7: Wire Apps grid cards

**Files:**
- Modify: `client/src/components/AppsTab.tsx`

- [ ] **Step 1: Replace description preview with date + labels**

Update imports and card body:

```tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AppPrototype } from '../api/client';
import { CreateAppModal } from './CreateAppModal';
import { DeleteButton } from './DeleteButton';
import { LabelPreview } from './LabelPreview';
import { formatCreatedOn } from './formatCreatedOn';
import './TabStyles.css';
```

Remove `previewDescription` helper.

Inside each app card, replace:

```tsx
                <div className="card-desc card-desc-preview">
                  {previewDescription(app.description)}
                </div>
```

with:

```tsx
                <p className="card-created-on">{formatCreatedOn(app.created_at)}</p>
                <LabelPreview
                  architectures={app.architectures ?? []}
                  infrastructures={app.infrastructures ?? []}
                />
```

- [ ] **Step 2: Build + lint**

```bash
cd client
npm run build
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/AppsTab.tsx
git commit -m "feat(client): show Created-on and label preview on Apps cards"
```

---

### Task 8: Wire Problem → Solution nested rows

**Files:**
- Modify: `client/src/components/ProblemSolutions.tsx`

- [ ] **Step 1: Replace desc + wrapping tags**

Imports:

```tsx
import { LabelPreview } from './LabelPreview';
import { formatCreatedOn } from './formatCreatedOn';
```

Remove `previewDescription` if unused.

Replace the link body (title / desc / tags block) with:

```tsx
              <button
                type="button"
                className="problem-solution-link"
                onClick={() => onNavigate(`/solutions/${s.id}`)}
              >
                <span className="problem-solution-title">{s.title}</span>
                <span className="problem-solution-created">
                  {formatCreatedOn(s.created_at)}
                </span>
                <span className="problem-solution-tags">
                  <LabelPreview
                    architectures={s.architectures ?? []}
                    infrastructures={s.infrastructures ?? []}
                  />
                </span>
              </button>
```

Confirm `Solution` already includes `architectures`, `infrastructures`, `created_at` in `client/src/api/client.ts` (it does).

- [ ] **Step 2: Build + lint**

```bash
cd client
npm run build
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ProblemSolutions.tsx
git commit -m "feat(client): Created-on and LabelPreview on solution rows under problems"
```

---

### Task 9: Plex Visualizer — app-center arch/infra nodes

**Files:**
- Modify: `client/src/components/PlexVisualizer.tsx`

- [ ] **Step 1: Extend apps branch outer items**

In the `component === 'apps'` branch, change `outerItems` type to include architecture and infrastructure:

```tsx
    const outerItems: {
      id: string;
      label: string;
      type: 'problem' | 'solution' | 'architecture' | 'infrastructure';
      icon: string;
      grad: string;
      isCategory?: boolean;
      items?: { id: string; title: string }[];
    }[] = [];
```

After the solutions block (and before `rx`/`ry` calculation), add:

```tsx
    const archs = app.architectures || [];
    if (archs.length === 1) {
      outerItems.push({
        id: archs[0].id,
        label: archs[0].title,
        type: 'architecture',
        icon: 'architecture',
        grad: 'grad-sol-arch',
      });
    } else if (archs.length > 1) {
      outerItems.push({
        id: 'cat-architecture',
        label: 'Architecture',
        type: 'architecture',
        icon: 'architecture',
        grad: 'grad-sol-arch',
        isCategory: true,
        items: archs.map((a) => ({ id: a.id, title: a.title })),
      });
    }

    const infras = app.infrastructures || [];
    if (infras.length === 1) {
      outerItems.push({
        id: infras[0].id,
        label: infras[0].title,
        type: 'infrastructure',
        icon: 'infrastructure',
        grad: 'grad-sol-infra',
      });
    } else if (infras.length > 1) {
      outerItems.push({
        id: 'cat-infrastructure',
        label: 'Infrastructure',
        type: 'infrastructure',
        icon: 'infrastructure',
        grad: 'grad-sol-infra',
        isCategory: true,
        items: infras.map((i) => ({ id: i.id, title: i.title })),
      });
    }
```

Do **not** change Architecture/Infrastructure entity card tabs.

- [ ] **Step 2: Build + lint**

```bash
cd client
npm run build
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/PlexVisualizer.tsx
git commit -m "feat(client): show effective arch/infra nodes on app-centered Plex"
```

---

### Task 10: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Server suite**

```bash
cd server
uv run pytest -v
uv run pyright
```

Expected: all green.

- [ ] **Step 2: Client build**

```bash
cd client
npm run build
npm run lint
```

Expected: pass.

- [ ] **Step 3: Manual checklist (dev servers)**

1. Create Architecture + Infrastructure cards (or use existing).
2. Propose a Solution with multiple arch/infra → open Problem → solution row shows chips; overflow shows `+n more` when narrow; date line present; **no** description preview.
3. Create App **with** “Propose to a Solution” ON → Apps card shows **solution’s** labels + Created-on.
4. Create App with toggle OFF + arch/infra multi-select → Apps card shows **own** labels.
5. Link/unlink prototype from Solution detail → labels switch between inherited and own without losing own IDs (reload after unlink).
6. Open App detail Plex → arch/infra nodes appear from effective labels.
7. Confirm Architecture and Infrastructure **tab cards** still have no label chip row.

- [ ] **Step 4: Final commit only if verification fixes were needed**

Otherwise stop; no empty commit.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Persist app arch/infra IDs | 1, 2 |
| Effective labels inherit from solution when linked | 2, 3 |
| Own IDs kept while linked | 2, 3 |
| `$pull` on arch/infra delete from apps | 4 |
| `LabelPreview` single-row + `+n more` | 6 |
| Solution rows: date + labels | 8 |
| Apps cards: date + labels | 7 |
| Plex app center arch/infra | 9 |
| No arch/infra entity card chips | 9 (explicit non-touch), 10 checklist |
| Tests + pyright + build | 2–4, 10 |

## Placeholder scan

No TBD/TODO steps; all code blocks are concrete.

## Type consistency

- Response fields: `architectures` / `infrastructures` on App (effective).
- Document fields: `architecture_ids` / `infrastructure_ids`.
- UI: `LabelPreview` props match short `{ id, title }` items.
- Date helper: `formatCreatedOn(iso) → "Created on: …"`.
