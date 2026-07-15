# Design: Superadmin Remove Registered User

**Date:** 2026-07-15  
**Status:** Approved (design)  
**Author:** Agent (brainstorming session)

## Goal

Allow a **superadmin** in **Admin Manager** to **hard-delete** a registered user so
that person must **re-register** (same email is free again after delete).

This extends the existing Admin Manager (list users + grant/revoke admin). It does
**not** change role hierarchy, seed superadmin, or registration flow beyond freeing
the email after delete.

## Decisions (from clarifying Q&A)

1. **Who can be removed:** Any user **except the acting superadmin** (self). Readers,
   admins, and **other** superadmins may be removed.
2. **UI confirm:** Browser confirm dialog before delete (message includes target email).
3. **Approach A — hard delete only:** Delete the MongoDB user document. Do **not** add
   a live DB check in `get_current_user`. Existing JWTs for a removed user may remain
   valid until natural expiry (current stateless auth behavior).

## Non-goals

- Soft-disable / ban without deleting the row
- Immediate JWT revocation / token blocklist
- Bulk delete
- Admin (non-superadmin) access to remove users
- Cascading delete of domain content (problems/solutions/etc. are not user-owned)

## Backend

### Endpoint — `server/routers/admin.py`

```
DELETE /api/admin/users/{user_id}
```

- **Auth:** `Depends(require_role(Role.SUPERADMIN))` (same as list/patch).
- **Also inject** `CurrentUser` (via `require_role` return or `get_current_user`) so
  the service can enforce self-delete guard.
- **Success:** `204 No Content`.
- **Errors:**
  - `400` invalid ObjectId
  - `400` `"Cannot remove your own account"` when target id equals actor id
  - `404` `"User not found"`
  - `403` non-superadmin (dependency)
  - `500` unexpected

### Service — `server/services/users.py`

```python
async def delete_user(user_id: str, actor_id: str) -> None:
```

1. Reject invalid `user_id` → 400 `"Invalid user id"`.
2. If `user_id == actor_id` → 400 `"Cannot remove your own account"`.
3. `find_one` by ObjectId; missing → 404 `"User not found"`.
4. `delete_one({"_id": oid})`; if `deleted_count == 0` → 404.
5. No last-superadmin delete guard: self-delete already blocked; removing another
   superadmin is allowed when at least the actor remains.

After delete, unique index on `email` allows the same address to register again via
existing `POST /api/auth/register`.

### Schemas

No new Pydantic models required (empty body, 204 response).

## Frontend

### API client — `client/src/api/client.ts`

```ts
removeUser: (userId: string) =>
  request<void>(`/api/admin/users/${userId}`, { method: 'DELETE' }),
```

Ensure shared `request` helper treats 204 as success with no JSON body.

### Admin Manager — `AdminManagerView.tsx`

- Need current user id (from `useAuth` / existing auth context) to hide Remove for self.
- Actions column:
  - Existing Grant admin / Revoke admin for reader/admin (unchanged).
  - Superadmin rows (other users): show **Remove** only (no role buttons today — keep that).
  - For reader/admin rows: show role button **and** **Remove**.
  - Self row: no Remove (show `—` or omit Remove only).
- On Remove click: `window.confirm(\`Remove ${email}? They must re-register.\`)`.
- On confirm: call `adminApi.removeUser`, then `loadUsers()`; surface errors in existing error banner.
- Busy state: reuse `busyId` pattern so double-submit is blocked.

### CSS

Reuse existing button styles; add a danger-style remove button class if none exists
(match revoke styling or a clear destructive variant).

## Security notes

- Endpoint superadmin-only (RBAC).
- Self-delete blocked server-side (UI hide is convenience only).
- Hard delete frees email; re-register creates a **new** user id and default `reader` role.
- JWT for deleted user may work until expiry; out of scope for this change.

## Testing

### Service unit — extend `test_seed_superadmin.py` or new `test_delete_user`

- Deletes other user → document gone.
- Self-delete → 400.
- Missing id → 404.
- Invalid ObjectId → 400.

### API — extend `test_admin_api.py`

- Superadmin DELETE other user → 204; subsequent list omits user.
- Superadmin DELETE self → 400.
- Admin / reader DELETE → 403.
- Superadmin DELETE unknown id → 404.

### Frontend

- Manual: login superadmin → Admin Manager → Remove non-self → confirm → row gone;
  re-register that email works.
- Optional component test later; not required for MVP if repo pattern is backend-heavy.

## Implementation order

1. Service `delete_user` + unit tests (TDD).
2. Router `DELETE` + API tests.
3. `adminApi.removeUser` + 204 handling if needed.
4. Admin Manager UI (Remove + confirm + self hide).
5. `uv run pytest` + `uv run pyright` from `server/`.

## Success criteria

- [ ] Superadmin can remove any registered user except self.
- [ ] Removed email can re-register via existing register flow.
- [ ] Non-superadmin cannot call delete endpoint.
- [ ] Confirm dialog before delete in Admin Manager.
- [ ] Self row has no Remove action; API also rejects self-delete.
- [ ] Existing grant/revoke admin behavior unchanged.
