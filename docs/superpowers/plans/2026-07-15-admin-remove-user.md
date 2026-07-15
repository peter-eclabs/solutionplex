# Admin Remove User — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmin hard-deletes any registered user except self from Admin Manager so that email can re-register.

**Architecture:** Extend existing admin stack. Service `delete_user(user_id, actor_id)` removes Mongo user doc with self-delete guard. `DELETE /api/admin/users/{user_id}` is superadmin-only and returns 204. Frontend adds confirm + Remove button; `request()` must accept empty 204 bodies.

**Tech Stack:** FastAPI + Motor (Python 3.13, `uv`), pytest + TestClient, React + TypeScript (Vite), existing `adminApi` / `AdminManagerView`.

**Spec:** `docs/superpowers/specs/2026-07-15-admin-remove-user-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `server/services/users.py` | Add `delete_user(user_id, actor_id)` |
| `server/routers/admin.py` | Add `DELETE /users/{user_id}` |
| `server/tests/test_seed_superadmin.py` | Unit tests for `delete_user` |
| `server/tests/test_admin_api.py` | HTTP tests for DELETE |
| `client/src/api/client.ts` | Empty-body 204 support + `adminApi.removeUser` |
| `client/src/components/AdminManagerView.tsx` | Remove button, confirm, hide for self |
| `client/src/components/AdminManagerView.css` | Remove button styles |

No new files required.

---

### Task 1: Service — `delete_user` (TDD)

**Files:**
- Modify: `server/services/users.py`
- Modify: `server/tests/test_seed_superadmin.py`

- [ ] **Step 1: Write failing unit tests**

Append to `server/tests/test_seed_superadmin.py`:

```python
class TestDeleteUser:
    @pytest.mark.asyncio
    async def test_delete_user_success(self, monkeypatch):
        from server.services import users as users_service

        uid = ObjectId()
        actor = ObjectId()
        mock_col = AsyncMock()
        mock_col.find_one = AsyncMock(
            return_value={
                "_id": uid,
                "email": "gone@example.com",
                "role": "reader",
                "hashed_password": "x",
            }
        )
        mock_col.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=1)
        )
        monkeypatch.setattr(
            "server.services.users.client.users_col", mock_col
        )

        await users_service.delete_user(str(uid), str(actor))

        mock_col.delete_one.assert_awaited_once_with({"_id": uid})

    @pytest.mark.asyncio
    async def test_delete_user_rejects_self(self, monkeypatch):
        from fastapi import HTTPException

        from server.services import users as users_service

        uid = ObjectId()
        mock_col = AsyncMock()
        mock_col.find_one = AsyncMock()
        mock_col.delete_one = AsyncMock()
        monkeypatch.setattr(
            "server.services.users.client.users_col", mock_col
        )

        with pytest.raises(HTTPException) as exc_info:
            await users_service.delete_user(str(uid), str(uid))
        assert exc_info.value.status_code == 400
        assert "own account" in exc_info.value.detail
        mock_col.find_one.assert_not_awaited()
        mock_col.delete_one.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_delete_user_not_found(self, monkeypatch):
        from fastapi import HTTPException

        from server.services import users as users_service

        mock_col = AsyncMock()
        mock_col.find_one = AsyncMock(return_value=None)
        mock_col.delete_one = AsyncMock()
        monkeypatch.setattr(
            "server.services.users.client.users_col", mock_col
        )

        with pytest.raises(HTTPException) as exc_info:
            await users_service.delete_user(
                "000000000000000000000001",
                "000000000000000000000002",
            )
        assert exc_info.value.status_code == 404
        mock_col.delete_one.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_delete_user_invalid_id(self, monkeypatch):
        from fastapi import HTTPException

        from server.services import users as users_service

        mock_col = AsyncMock()
        monkeypatch.setattr(
            "server.services.users.client.users_col", mock_col
        )

        with pytest.raises(HTTPException) as exc_info:
            await users_service.delete_user("not-an-oid", "000000000000000000000002")
        assert exc_info.value.status_code == 400
        assert "Invalid user id" in exc_info.value.detail
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd server
uv run pytest tests/test_seed_superadmin.py::TestDeleteUser -v
```

Expected: FAIL — `delete_user` not defined / AttributeError.

- [ ] **Step 3: Implement `delete_user`**

Append to `server/services/users.py` (after `update_user_role`):

```python
async def delete_user(user_id: str, actor_id: str) -> None:
    """Hard-delete a user account with self-delete protection.

    Args:
        user_id: Hex string MongoDB ObjectId of the target user.
        actor_id: Hex string MongoDB ObjectId of the acting superadmin.

    Raises:
        HTTPException 400: Invalid ObjectId, or attempting to remove self.
        HTTPException 404: User not found.
    """
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id",
        )
    if user_id == actor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own account",
        )

    oid = ObjectId(user_id)
    current = await client.users_col.find_one({"_id": oid})
    if current is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    result = await client.users_col.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd server
uv run pytest tests/test_seed_superadmin.py::TestDeleteUser -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add server/services/users.py server/tests/test_seed_superadmin.py
git commit -m "feat(users): hard-delete user with self-delete guard"
```

---

### Task 2: Router — `DELETE /api/admin/users/{user_id}` (TDD)

**Files:**
- Modify: `server/routers/admin.py`
- Modify: `server/tests/test_admin_api.py`

- [ ] **Step 1: Write failing HTTP tests**

Append to `server/tests/test_admin_api.py`:

```python
class TestAdminDeleteUser:
    def test_unauthenticated_401(self, client: TestClient):
        resp = client.delete("/api/admin/users/0000000000000000000000bb")
        assert resp.status_code == 401

    def test_admin_forbidden_403(self, client: TestClient):
        resp = client.delete(
            "/api/admin/users/0000000000000000000000bb",
            headers=_headers("admin"),
        )
        assert resp.status_code == 403

    def test_reader_forbidden_403(self, client: TestClient):
        resp = client.delete(
            "/api/admin/users/0000000000000000000000bb",
            headers=_headers("reader"),
        )
        assert resp.status_code == 403

    def test_superadmin_deletes_other_user(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        mock_delete = AsyncMock(return_value=None)
        monkeypatch.setattr(
            "server.routers.admin.users_service.delete_user",
            mock_delete,
        )
        actor = "test-user-id"
        target = "0000000000000000000000bb"
        resp = client.delete(
            f"/api/admin/users/{target}",
            headers=_headers("superadmin", subject=actor),
        )
        assert resp.status_code == 204
        mock_delete.assert_awaited_once_with(target, actor)

    def test_superadmin_self_delete_returns_400(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        from fastapi import HTTPException, status as http_status

        async def _raise(user_id: str, actor_id: str):
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove your own account",
            )

        monkeypatch.setattr(
            "server.routers.admin.users_service.delete_user",
            _raise,
        )
        actor = "0000000000000000000000aa"
        resp = client.delete(
            f"/api/admin/users/{actor}",
            headers=_headers("superadmin", subject=actor),
        )
        assert resp.status_code == 400
        assert "own account" in resp.json()["detail"]

    def test_superadmin_not_found_404(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        from fastapi import HTTPException, status as http_status

        async def _raise(*_a, **_k):
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        monkeypatch.setattr(
            "server.routers.admin.users_service.delete_user",
            _raise,
        )
        resp = client.delete(
            "/api/admin/users/0000000000000000000000ff",
            headers=_headers("superadmin"),
        )
        assert resp.status_code == 404
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd server
uv run pytest tests/test_admin_api.py::TestAdminDeleteUser -v
```

Expected: FAIL — 405 Method Not Allowed or route missing (not 204/400/404 as intended).

- [ ] **Step 3: Add DELETE endpoint**

Update imports in `server/routers/admin.py` if needed:

```python
from server.schemas.models import CurrentUser, Role, UserResponse, UserRoleUpdate
from server.security.deps import require_role
```

Append endpoint (inject actor via parameter, not only `dependencies=`):

```python
@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a user",
    description=(
        "Hard-deletes the user account so the email can re-register. "
        "Superadmin only. Cannot remove own account."
    ),
)
async def delete_user(
    user_id: str,
    actor: CurrentUser = Depends(require_role(Role.SUPERADMIN)),
):
    """Remove a registered user.

    Args:
        user_id: Target user ObjectId hex string.
        actor: Authenticated superadmin performing the delete.

    Raises:
        HTTPException 400/404: Propagated from the service layer.
        HTTPException 500: On unexpected server errors.
    """
    try:
        await users_service.delete_user(user_id, actor.id)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete user")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd server
uv run pytest tests/test_admin_api.py -v
uv run pyright
```

Expected: all admin API tests pass; pyright clean for touched files.

- [ ] **Step 5: Commit**

```bash
git add server/routers/admin.py server/tests/test_admin_api.py
git commit -m "feat(admin): DELETE /api/admin/users/{id} for superadmin"
```

---

### Task 3: Frontend API — 204-safe `request` + `removeUser`

**Files:**
- Modify: `client/src/api/client.ts`

- [ ] **Step 1: Fix `request` for empty success bodies**

In `client/src/api/client.ts`, replace the success JSON parse block:

```typescript
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    const data: T = JSON.parse(text) as T;
    return data;
  } catch {
    throw new Error('Server returned a non-JSON response. Is the API server running?');
  }
```

Full success path after `if (!response.ok) { ... }` should look like:

```typescript
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    const data: T = JSON.parse(text) as T;
    return data;
  } catch {
    throw new Error('Server returned a non-JSON response. Is the API server running?');
  }
```

- [ ] **Step 2: Add `adminApi.removeUser`**

Extend `adminApi`:

```typescript
export const adminApi = {
  /** List all users (id, email, role). */
  listUsers: () => request<UserResponse[]>('/api/admin/users'),

  /** Set a user's role (e.g. grant admin). */
  setRole: (userId: string, role: UserRole) =>
    request<UserResponse>(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  /** Hard-delete a user (superadmin). Email can re-register after. */
  removeUser: (userId: string) =>
    request<void>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    }),
};
```

- [ ] **Step 3: Typecheck client if available**

```bash
cd client
npm run build
```

If full build is heavy or blocked by unrelated WIP, at least ensure no TS errors in `client.ts` via IDE / `npx tsc --noEmit` when clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/api/client.ts
git commit -m "feat(client): admin removeUser API and 204-safe request"
```

---

### Task 4: Admin Manager UI — Remove + confirm

**Files:**
- Modify: `client/src/components/AdminManagerView.tsx`
- Modify: `client/src/components/AdminManagerView.css`

- [ ] **Step 1: Wire auth + remove handler**

Update `AdminManagerView.tsx` to:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import type { UserResponse } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import './AdminManagerView.css';

interface AdminManagerViewProps {
  onNavigate: (path: string) => void;
}

export function AdminManagerView({ onNavigate }: AdminManagerViewProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await adminApi.listUsers();
      setUsers(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleSetRole = async (userId: string, role: 'admin' | 'reader') => {
    setBusyId(userId);
    setError('');
    try {
      await adminApi.setRole(userId, role);
      await loadUsers();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update role');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (target: UserResponse) => {
    const ok = window.confirm(
      `Remove ${target.email}? They must re-register.`,
    );
    if (!ok) return;

    setBusyId(target.id);
    setError('');
    try {
      await adminApi.removeUser(target.id);
      await loadUsers();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to remove user');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-manager">
      <div className="admin-manager-header">
        <h2>Admin Manager</h2>
        <button
          type="button"
          className="admin-back-btn"
          onClick={() => onNavigate('/')}
        >
          ← Back
        </button>
      </div>

      <p className="admin-manager-subtitle">
        Existing logins. Grant or revoke admin, or remove a user so they must
        re-register.
      </p>

      {error && <div className="admin-manager-error">{error}</div>}

      {loading ? (
        <p className="status-text">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="status-text">No users found.</p>
      ) : (
        <table className="admin-user-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isBusy = busyId === u.id;
              const isSelf = user?.id === u.id;
              return (
                <tr key={u.id}>
                  <td className="admin-user-email">{u.email}</td>
                  <td>
                    <span className={`admin-role-badge role-${u.role}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      {u.role === 'reader' ? (
                        <button
                          type="button"
                          className="admin-grant-btn"
                          disabled={isBusy}
                          onClick={() => void handleSetRole(u.id, 'admin')}
                        >
                          {isBusy ? 'Updating…' : 'Grant admin'}
                        </button>
                      ) : u.role === 'admin' ? (
                        <button
                          type="button"
                          className="admin-revoke-btn"
                          disabled={isBusy}
                          onClick={() => void handleSetRole(u.id, 'reader')}
                        >
                          {isBusy ? 'Updating…' : 'Revoke admin'}
                        </button>
                      ) : null}
                      {isSelf ? (
                        u.role === 'superadmin' ? (
                          <span className="admin-no-action">—</span>
                        ) : null
                      ) : (
                        <button
                          type="button"
                          className="admin-remove-btn"
                          disabled={isBusy}
                          onClick={() => void handleRemove(u)}
                        >
                          {isBusy ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

Self row: superadmin shows `—` (no role change + no remove). Other users: Remove always; role buttons only for reader/admin.

- [ ] **Step 2: CSS for remove + action row**

In `AdminManagerView.css`, extend button selector group and add:

```css
.admin-back-btn,
.admin-grant-btn,
.admin-revoke-btn,
.admin-remove-btn {
  background: transparent;
  border: 1px solid var(--border-grid);
  color: var(--text-secondary);
  padding: 0.35rem 0.7rem;
  font-size: 0.7rem;
  font-family: var(--font-mono);
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 3px;
  transition: border-color 0.2s, color 0.2s, background-color 0.2s;
}

.admin-remove-btn {
  border-color: var(--accent-problem);
  color: var(--accent-problem);
}

.admin-remove-btn:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--accent-problem) 15%, transparent);
}

.admin-grant-btn:disabled,
.admin-revoke-btn:disabled,
.admin-remove-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}
```

(If the shared selector was already listing three buttons, merge remove into that single rule and avoid duplicate base styles.)

- [ ] **Step 3: Manual smoke (when server + Mongo up)**

1. Login as superadmin.
2. Open Admin Manager.
3. Self row: no Remove.
4. Remove a reader/admin → confirm → row gone.
5. Register same email again → succeeds as reader.

- [ ] **Step 4: Final verification**

```bash
cd server
uv run pytest tests/test_seed_superadmin.py tests/test_admin_api.py -v
uv run pyright
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AdminManagerView.tsx client/src/components/AdminManagerView.css
git commit -m "feat(admin-ui): remove user with confirm in Admin Manager"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Hard-delete user document | Task 1 |
| Self-delete blocked (API) | Task 1 + 2 |
| Superadmin-only DELETE | Task 2 |
| 204 No Content | Task 2 + 3 |
| Email free to re-register | Task 1 (unique index freed) |
| Confirm dialog | Task 4 |
| Hide Remove for self | Task 4 |
| Grant/revoke unchanged | Task 4 (kept) |
| JWT until expiry OK | No task (non-goal) |

## Self-review notes

- No placeholders.
- `delete_user(user_id, actor_id)` signature consistent across service, router, tests.
- Error strings: `"Cannot remove your own account"`, `"Invalid user id"`, `"User not found"`.
- `request()` 204 fix required so `removeUser` does not throw on empty body.
- Actor id comes from JWT `sub` (`CurrentUser.id` / `useAuth().user.id`) — same string form as Mongo ObjectId hex from login.
