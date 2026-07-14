import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import type { UserResponse } from '../api/client';
import './AdminManagerView.css';

interface AdminManagerViewProps {
  onNavigate: (path: string) => void;
}

export function AdminManagerView({ onNavigate }: AdminManagerViewProps) {
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

  const handleGrantAdmin = async (userId: string) => {
    setBusyId(userId);
    setError('');
    try {
      await adminApi.setRole(userId, 'admin');
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
        Existing logins. Grant admin privilege to a selected user.
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
              const canGrant = u.role !== 'admin' && u.role !== 'superadmin';
              return (
                <tr key={u.id}>
                  <td className="admin-user-email">{u.email}</td>
                  <td>
                    <span className={`admin-role-badge role-${u.role}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {canGrant ? (
                      <button
                        type="button"
                        className="admin-grant-btn"
                        disabled={busyId === u.id}
                        onClick={() => void handleGrantAdmin(u.id)}
                      >
                        {busyId === u.id ? 'Updating…' : 'Grant admin'}
                      </button>
                    ) : (
                      <span className="admin-no-action">—</span>
                    )}
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
