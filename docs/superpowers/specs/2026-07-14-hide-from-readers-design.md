# Design: "Hide from readers" Visibility Control

**Date:** 2026-07-14
**Status:** Approved (design)
**Author:** Agent (brainstorming session)

## Goal

Allow privileged users (Admin / SuperAdmin) to mark a **Problem** card as hidden
from readers. A hidden Problem — and every Solution and App linked to it — becomes
invisible to readers. Readers who guess a hidden card's id and paste the URL are
redirected to the existing "Access Denied" (`UnauthorizedView`) dialog.

The hide control is **only** exposed to Admin/SuperAdmin and is **never** shown to
readers.

## Decisions (from clarifying Q&A)

1. **Inherited-only model.** A single `hidden` flag lives on the Problem. Linked
   Solutions and Apps are hidden automatically by inheritance (no separate toggles
   on Solutions/Apps). Linking a Solution/App to a hidden Problem hides it with no
   extra storage.
2. **Admin indicator.** Hidden cards show a subtle "Hidden" badge in lists and on
   the detail header (visible to Admin/SuperAdmin only, via the inherited `hidden`
   flag on each entity).
3. **Direct URL.** Backend returns `403` for readers requesting a hidden card by
   id; the frontend redirects to `/unauthorized` (the existing Access Denied view).

## Backend

### Schema — `server/schemas/models.py`

- `ProblemCreate`: add `hidden: bool = False`.
- `ProblemUpdate`: add `hidden: Optional[bool] = None`.
- `ProblemResponse`: add `hidden: bool = False`.
- `SolutionResponse`: add `hidden: bool = False` (computed, never client-set).
- `AppResponse`: add `hidden: bool = False` (computed, never client-set).

### Visibility rule

A card is hidden-from-reader when its **Problem** has `hidden: true`. Solutions/Apps
inherit this via the link chain (`solution.problem_id`; `app → solution → problem`).
Documents without the `hidden` field (pre-existing) are treated as visible.

### Service + router changes

GET endpoints already use `require_role(...)`, which returns the `CurrentUser`. Inject
that user into the service layer.

- `problems.py`
  - `create_problem`: persist `hidden` (default `False`).
  - `update_problem`: persist `hidden` when provided (admin-gated as today).
  - `get_problem(id, current_user)`: if the doc is missing → `None` (router → 404).
    If the doc exists and `hidden` and `current_user.role == READER` → raise
    `HTTPException(403, "This problem is hidden from readers")`.
  - `list_problems(q, current_user)`: when reader, add `{"hidden": {"$ne": True}}`
    to the query (keeps legacy docs without the field visible).
- `solutions.py`
  - `get_solution(id, current_user)`: fetch raw solution + its problem. If reader and
    the linked problem is hidden → `403`. `populate_solution` sets `s["hidden"]`.
  - `list_solutions(q, current_user)`: when reader, compute the set of hidden
    problem `ObjectId`s once, then exclude solutions whose `problem_id` is in that set.
    `populate_solution` attaches the inherited `hidden` flag.
- `apps.py`
  - `get_app(id, current_user)`: fetch raw app + its solution + its problem. If reader
    and the linked problem is hidden → `403`. `populate_app` sets `a["hidden"]`.
  - `list_apps(q, current_user)`: when reader, compute hidden problem id set; exclude
    apps whose resolved problem id is in that set. Apps with no solution/problem are
    always visible. `populate_app` attaches the inherited `hidden` flag.

`HTTPException` raised inside services is already re-raised by the routers'
`except HTTPException: raise` blocks, so no router changes beyond passing
`current_user` into the service call.

## Frontend

### API client — `client/src/api/client.ts`

- Add `hidden?: boolean` to `Problem`, `Solution`, `AppPrototype` interfaces.
- `createProblem` / `updateProblem` accept an optional `hidden` field.
- `request<T>` throws a tagged `ApiError` (carrying `status`). On `403` the detail
  view navigates to `/unauthorized` (the existing Access Denied dialog). On `401` the
  current token-clear/reload behaviour is preserved.

### Toggle (Admin/SuperAdmin only)

- `ProblemsTab` create modal: a "Hide from readers?" switch, rendered only when
  `canWrite` (Admin+). Value passed to `createProblem`.
- `DetailView` problem edit form: same switch, persisted on save via `updateProblem`.
- The toggle is **never** rendered for readers (guarded by `canWrite`).

### Hidden badge (Admin/SuperAdmin only)

- A subtle "Hidden" badge on problem/solution/app cards in lists and on the detail
  header. Client reads `entity.hidden`; readers never receive these entities, so the
  badge is admin-only in practice.
- For Solutions/Apps the badge is driven by the server-computed inherited `hidden`
  flag (no client-side linkage inference needed).

### Direct URL redirect

- In `DetailView`, watch the query error; when it is an `ApiError` with `status === 403`,
  call `onNavigate('/unauthorized')` (reusing `UnauthorizedView`).

## Testing

### Backend (pytest, `server/tests`)

- Reader `list_problems` omits hidden problems; admin sees them.
- Reader `get_problem(hidden_id)` → 403; admin → 200.
- Reader `list_solutions` / `list_apps` omit entries whose linked problem is hidden;
  admin sees them (with `hidden: true`).
- Reader `get_solution` / `get_app` of a hidden-by-inheritance entity → 403.
- `create_problem` / `update_problem` persist `hidden`; linking a solution/app to a
  hidden problem yields `hidden: true` on the populated response.

### Frontend

- Toggle rendered only when `canWrite`; absent for readers.
- `403` from any detail GET navigates to `/unauthorized`.

## Out of scope

- Independent hide toggles on Solutions/Apps (deferred per decision #1).
- Hiding Architecture/Infrastructure cards (not linked to Problems; not requested).
- Audit log of who toggled hide (future enhancement).
