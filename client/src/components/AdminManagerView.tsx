import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import type { UserResponse } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';
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
  const [pendingRemove, setPendingRemove] = useState<UserResponse | null>(null);

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

  const handleConfirmRemove = async () => {
    if (!pendingRemove) return;
    const target = pendingRemove;
    setBusyId(target.id);
    setError('');
    try {
      await adminApi.removeUser(target.id);
      setPendingRemove(null);
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

  const removeBusy = pendingRemove !== null && busyId === pendingRemove.id;

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
                          onClick={() => setPendingRemove(u)}
                        >
                          Remove
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

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove user"
        message={
          pendingRemove ? (
            <>
              Remove <strong>{pendingRemove.email}</strong>? They must
              re-register.
            </>
          ) : null
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        danger
        busy={removeBusy}
        onCancel={() => {
          if (!removeBusy) setPendingRemove(null);
        }}
        onConfirm={() => void handleConfirmRemove()}
      />
    </div>
  );
}
