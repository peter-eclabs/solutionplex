# RBAC Implementation — Goal Document

**Objective Name:** `rbac`
**Date:** July 2026
**Owner:** Solutionplex Platform Team
**Status:** Planning

---

## 1. Original Objective

Implement a secure, scalable **Role-Based Access Control (RBAC)** system across the
React frontend and FastAPI backend of Solutionplex. Access to data and UI visibility is
restricted based on three distinct user roles stored in MongoDB Atlas.

The system must:

1. Restrict data access and UI visibility by role.
2. Carry the user's role inside the JWT so the frontend never needs a DB round-trip on
   every page load.
3. Return `403 Forbidden` from the backend when a requestor lacks the minimum clearance.
4. Hide/disable mutation UI (`Create`, `Edit`, `Delete`) for the `Reader` role.
5. Redirect unauthorized route access to an Unauthorized page / main dashboard.

---

## 2. Role & Permission Matrix

Roles are split into three tiers. `Admin` and `SuperAdmin` share identical permissions
**today**, but MUST be modelled as independent roles in the codebase so future divergence
is possible without a data migration.

| Role        | Access Level       | Core Capabilities                                                                 |
|-------------|--------------------|-----------------------------------------------------------------------------------|
| SuperAdmin  | Full System Control | Unrestricted access to all data, user management, and configuration settings.     |
| Admin       | Full Operational Access | Complete access to application features and data management. Prepared for future restrictions. |
| Reader      | Read-Only Access   | Allowed to view assigned pages and data. Strictly blocked from creating, modifying, or deleting any resources. |

**Clearance model (minimum required role per protected action):**

- Read (GET list / detail): `Reader` (or above)
- Create / Update / Delete (any entity): `Admin` (or `SuperAdmin`)
- User management / configuration: `SuperAdmin` (reserved for future use)

Roles are ordered: `Reader < Admin < SuperAdmin`. A request satisfies a requirement if
`role_rank(request_role) >= role_rank(required_role)`.

---

## 3. Backend Requirements (FastAPI & MongoDB)

### 3.1 Database Schema
- The user model in MongoDB Atlas MUST include a mandatory `role` field.
- Default role for new registrations: `Reader`, unless explicitly overridden.
- Other expected fields: `email`/`username` (unique), `hashed_password`, timestamps.

### 3.2 Token Payload
- The generated JWT MUST embed the user's `role` (and `sub`/user id, `email`).
- Goal: frontend decodes the JWT client-side to read role without DB queries per load.

### 3.3 Route Guards
- Reusable FastAPI dependencies that intercept incoming requests, decode/validate the JWT,
  and check role clearance.
- Endpoints return `403 Forbidden` when the role does not meet the minimum required
  clearance.
- Unauthenticated requests (no/invalid token) to protected endpoints return `401`.
- Public endpoints remain open (health, login, register).

### 3.4 Existing Backend Surface (for integration)
The backend already exposes routers under `server/routers/`:
`problems`, `solutions`, `architectures`, `infrastructures`, `apps`, `search`
plus `server/main.py` (FastAPI app + CORS) and `server/database/client.py`
(`AsyncIOMotorClient`, collections: `problems`, `solutions`, `architectures`,
`infrastructures`, `apps`, `counters`).

Mutation routes to protect (require `Admin`+):
- `POST/PUT/DELETE /api/problems/*`
- `POST/PUT/DELETE /api/solutions/*`
- `POST/PUT/DELETE /api/architectures/*`
- `POST/PUT/DELETE /api/infrastructures/*`
- `POST/PUT/DELETE /api/apps/*`
- Search + list + detail stay readable by `Reader`.

Stack: FastAPI, `pydantic` v2, `motor` async MongoDB driver, `pydantic-settings`
(`server/config.py`), `uv` for running. No auth library present yet.

---

## 4. Frontend Requirements (React)

### 4.1 Protected Routes
- Wrap sensitive routes in a higher-order component / custom hook that checks the decoded
  JWT role before rendering the page.

### 4.2 Conditional UI Rendering
- Mutation UI elements (`Create`, `Edit`, `Delete` buttons / modals) MUST be hidden or
  fully disabled for the `Reader` role.

### 4.3 Unauthorized Redirects
- If a user manually types a URL they cannot access, gracefully redirect to an
  Unauthorized landing page or the main dashboard.

### 4.4 Existing Frontend Surface (for integration)
- React 19 + `@tanstack/react-query`. **No** router library — custom `history.pushState`
  routing lives in `client/src/App.tsx` (`navigate`, `parseRoute`). Tabs:
  `problems`, `architecture`, `infrastructure`, `apps`.
- API client in `client/src/api/client.ts`, query keys in `client/src/api/queryKeys.ts`.
- Mutation UI lives in tab components + `DetailView.tsx` + `CreateAppModal.tsx`,
  `DeleteButton.tsx`, etc.

RBAC frontend must introduce:
- An auth context/store (token storage, login state, decoded role).
- A login view + registration view.
- A `useRole()` / `RequireRole` guard hook/component.
- Conditional rendering of mutation controls keyed off the current role.
- An `/unauthorized` (or redirect) destination.

---

## 5. Design Constraints & Conventions (from AGENTS.md)

- Python: 4-space indent, `snake_case` funcs/vars, `PascalCase` classes, type hints,
  docstrings, f-strings, no bare `except`. `uv run` for execution/typecheck.
- `pyright` is the type checker (`uv run pyright`). Tests: `uv run pytest`.
- TypeScript: strict mode, `const`, single quotes, semicolons, no `any`/non-null abuse,
  `UpperCamelCase` components, type-only imports.
- Error handling: routers wrap logic in try/except → log → `HTTPException`; re-raise
  `HTTPException` untouched.
- Security: never log secrets/keys; never commit `.env`.

---

## 6. Success Criteria

- [ ] `Reader` can list/view all entities but cannot create/update/delete (backend 403,
      frontend hides controls).
- [ ] `Admin`/`SuperAdmin` can perform all mutations.
- [ ] JWT carries `role`; frontend reads role from token without DB call.
- [ ] Unauthenticated → `401`; under-cleared → `403` on protected routes.
- [ ] Manual navigation to forbidden route redirects to Unauthorized/Dashboard.
- [ ] `Admin` and `SuperAdmin` are distinct enum values (future-proofing).
- [ ] New registrations default to `Reader`.
- [ ] `uv run pyright` and `uv run pytest` pass on backend.

---

## 7. Phase Breakdown (for Planner)

- **Phase 1 — Backend Auth Foundation:** user schema + MongoDB collection, password
  hashing, registration & login endpoints, JWT creation/encoding with embedded role,
  settings/secrets config, auth dependencies (`get_current_user`, `require_role`).
- **Phase 2 — Backend Route Guards:** apply `require_role` dependencies to all mutation
  routes across existing routers; keep reads public-to-Reader; add tests.
- **Phase 3 — Frontend Auth:** auth context/store, token persistence, JWT decode hook,
  login + registration views, wire API client with `Authorization` header.
- **Phase 4 — Frontend Protection & Conditional UI:** `RequireRole` guard, hide/disable
  Create/Edit/Delete for `Reader`, Unauthorized redirect, protected navigation.
