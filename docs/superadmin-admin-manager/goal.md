# Superadmin Seeding & Admin Manager — Goal

**Objective name:** `superadmin-admin-manager`
**Date:** July 2026
**Workflow:** Caveman-Compressed MAW-lite (Orchestrator → Planner → Worker → Report)

---

## 1. Original Objective (verbatim from user)

> Create a static superadmin in mongoDB with email `peter.j@ecgroup-intl.com` and
> password `Peter@123` so that I can login. When a superadmin logins he should have the
> "Admin manager" button on top-right of the page, it opens a page where the admin can
> create see the existing logins and give admin privilage to the specific user he selects.
> Admins can't access admin manager.

---

## 2. Interpretation & Requirements

The codebase already implements an RBAC foundation (`docs/rbac/final_report.md`) with three
roles: `reader < admin < superadmin`, JWT tokens carrying `role`, backend `require_role()`
guards, and a frontend `useRole()` helper that already exposes `canManage` (true for
`superadmin`). This objective layers **user administration** on top of that foundation.

### 2.1 Functional Requirements

1. **Static superadmin seed**
   - On application startup, idempotently ensure a superadmin account exists in MongoDB
     (`users` collection) with:
     - `email = "peter.j@ecgroup-intl.com"`
     - `password = "Peter@123"` (hashed with the existing Argon2id hasher)
     - `role = "superadmin"`
   - Idempotent: if the email already exists, do **not** overwrite/duplicate. Only create
     when absent.
   - This must work against the real MongoDB used by the running app (via `MONGODB_URL` /
     `MONGODB_DB` env). Tests must mock the DB layer (as existing tests do).

2. **Admin Manager backend API (superadmin-only)**
   - `GET /api/admin/users` — list every user (id, email, role). Guarded by
     `require_role(Role.SUPERADMIN)`.
   - `PATCH /api/admin/users/{user_id}` — update a single user's role (e.g. grant
     `admin`). Guarded by `require_role(Role.SUPERADMIN)`. Must validate the target role is
     a valid `Role`. Recommend: reject demoting the last superadmin / self-lockout as a
     safety guard, but at minimum must not allow a non-superadmin to call it (enforced by
     the dependency).
   - Both endpoints return `401` for anonymous and `403` for `admin`/`reader` callers.

3. **Admin Manager frontend**
   - Superadmin sees an **"Admin manager"** button in the top-right header (next to the
     logout button). Hidden for `admin` and `reader`.
   - Clicking it opens an **Admin Manager page** (`/admin` route) listing existing logins
     (email + current role) with a control to grant `admin` privilege to the selected user.
   - The route is guarded: `admin`/`reader` navigation to `/admin` redirects to
     `/unauthorized` (reuse existing `navigateGuarded('/unauthorized', 'superadmin')`
     pattern). The backend guard is the source of truth.
   - After granting, the user list refreshes to reflect the new role.

### 2.2 Non-Functional / Constraints

- Reuse existing patterns: `server/services/users.py`, `server/security/*`, `server/schemas/models.py`,
  `client/src/auth/*`, `client/src/api/client.ts`, `client/src/App.tsx` routing.
- Follow `AGENTS.md` style rules (4-space indent, import grouping, docstrings, `uv run`,
  no `as any`, type safety).
- TDD-first (invoke `test-driven-development` skill before implementing). Backend tests
  mock the DB layer. Frontend gets a lint+build check.
- No secrets committed; the seed credentials live in code (hardcoded per requirement) but
  are only used to create the seed document.

---

## 3. Success Criteria

- [ ] App startup creates the superadmin if missing (idempotent).
- [ ] Logging in as `peter.j@ecgroup-intl.com` / `Peter@123` succeeds and yields a
      `superadmin` JWT.
- [ ] `GET /api/admin/users` and `PATCH /api/admin/users/{id}` return `403` for `admin`.
- [ ] Superadmin sees the "Admin manager" button; clicking it lists users and can grant
      `admin` to a selected user.
- [ ] `admin` users do not see the button and are redirected to `/unauthorized` if they
      force-navigate to `/admin`.
- [ ] `uv run pyright` clean and `uv run pytest` green on backend.
- [ ] `cd client && npm run lint` and `npm run build` clean.

---

## 4. Out of Scope

- Password reset / forgot-password flows.
- Revoking/locking accounts, audit logs.
- Self-service role changes by non-superadmins.
- Refresh tokens, RS256, httpOnly cookies (deferred in RBAC notes).

---

## 5. Reference Artifacts (already implemented)

- `server/schemas/models.py` — `Role` enum, `UserCreate`, `UserResponse`, `UserInDB`.
- `server/security/deps.py` — `require_role(min_role)` factory, `get_current_user`.
- `server/security/passwords.py` — `hash_password` / `verify_password` (Argon2id via pwdlib).
- `server/services/users.py` — `create_user`, `get_user_by_email`.
- `server/routers/auth.py` — existing auth endpoints.
- `server/database/client.py` — `users_col`, `ensure_indexes` (called in lifespan).
- `server/main.py` — `lifespan()` runs `ensure_indexes()`; this is where seeding belongs.
- `client/src/App.tsx` — header + custom `navigate`/`navigateGuarded` routing.
- `client/src/auth/AuthContext.tsx` — `useRole()` already exposes `canManage` (superadmin).
- `client/src/auth/guards.tsx` — `hasMinRole`.
- `client/src/api/client.ts` — `authApi` + `request` helper with bearer header.
