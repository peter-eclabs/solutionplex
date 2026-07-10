import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { AppShort, AppPrototype } from '../api/client';
import { CreateAppModal } from './CreateAppModal';
import { useToast } from './ToastContext';
import './TabStyles.css';

interface SolutionPrototypesProps {
  solutionId: string;
  solutionTitle: string;
  apps: AppShort[];
  onChanged: () => void;
  onNavigate: (path: string) => void;
}

export function SolutionPrototypes({
  solutionId,
  solutionTitle,
  apps,
  onChanged,
  onNavigate,
}: SolutionPrototypesProps) {
  const { showToast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [linkableApps, setLinkableApps] = useState<AppPrototype[]>([]);
  const [search, setSearch] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isLinkOpen, setIsLinkOpen] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadLinkable = useCallback(async () => {
    try {
      const all = await api.getApps();
      setLinkableApps(all.filter((a) => a.solution?.id !== solutionId));
    } catch (err: unknown) {
      if (err instanceof Error) setLinkError(`Failed to load prototypes: ${err.message}`);
      else setLinkError('Failed to load prototypes');
    }
  }, [solutionId]);

  useEffect(() => {
    if (isLinkOpen) {
      setSearch('');
      setLinkError('');
      loadLinkable();
    }
  }, [isLinkOpen, loadLinkable]);

  const linkApp = async (appId: string) => {
    try {
      await api.updateApp(appId, { solution_id: solutionId });
      setIsLinkOpen(false);
      onChanged();
      showToast('Prototype linked to solution', 'success');
    } catch (err: unknown) {
      if (err instanceof Error) setLinkError(err.message);
      else setLinkError('Failed to link prototype');
    }
  };

  const handleUnlink = async (appId: string) => {
    try {
      await api.updateApp(appId, { solution_id: '' });
      setRemovingId(null);
      onChanged();
      showToast('Prototype unlinked from solution', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to unlink prototype';
      showToast(message, 'error');
    }
  };

  const handleDelete = async (appId: string) => {
    try {
      await api.deleteApp(appId);
      setRemovingId(null);
      onChanged();
      showToast('Prototype deleted', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete prototype';
      showToast(message, 'error');
    }
  };

  const filteredApps = linkableApps.filter((a) =>
    a.title.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="solution-prototypes-section" onClick={(e) => e.stopPropagation()}>
      <div className="problem-solutions-header">
        <span className="solution-prototypes-label">Prototypes ({apps.length})</span>
        <div className="solution-prototypes-actions">
          <button
            type="button"
            className="propose-solution-btn"
            onClick={() => setIsCreateOpen(true)}
          >
            + Create Prototype
          </button>
          <button
            type="button"
            className="propose-solution-btn"
            onClick={() => setIsLinkOpen(true)}
          >
            + Link Existing
          </button>
        </div>
      </div>

      {apps.length === 0 ? (
        <p className="problem-solutions-empty">No prototypes linked to this solution yet.</p>
      ) : (
        <ul className="problem-solutions-list">
          {apps.map((app) => (
            <li key={app.id} className="problem-solution-item solution-prototype-item">
              <button
                type="button"
                className="problem-solution-link"
                onClick={() => onNavigate(`/apps/${app.id}`)}
              >
                <span className="problem-solution-title">{app.title}</span>
              </button>
              {removingId === app.id ? (
                <div className="prototype-remove-menu">
                  <button
                    type="button"
                    className="prototype-unlink-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnlink(app.id);
                    }}
                  >
                    Unlink
                  </button>
                  <button
                    type="button"
                    className="prototype-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(app.id);
                    }}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="prototype-cancel-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRemovingId(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="prototype-remove-trigger"
                  aria-label={`Remove ${app.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemovingId(app.id);
                  }}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <CreateAppModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={onChanged}
        solutionId={solutionId}
        solutionTitle={solutionTitle}
        heading="Create Prototype"
      />

      {isLinkOpen && (
        <div className="modal-overlay" onClick={() => setIsLinkOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <aside className="creation-panel">
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsLinkOpen(false)}
                aria-label="Close form"
              >
                &times;
              </button>
              <h3>Link Existing Prototype</h3>
              <p className="form-context-note">
                Targeting solution: <strong>{solutionTitle}</strong>
              </p>
              {linkError && <div className="error-banner">{linkError}</div>}
              <div className="form-field">
                <label htmlFor="sp-link-search">Search Prototypes</label>
                <input
                  id="sp-link-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to search prototypes..."
                  autoFocus
                />
              </div>
              {search.trim() && (
                <ul className="prototype-link-results">
                  {filteredApps.length === 0 ? (
                    <li className="prototype-link-empty">No matching prototypes</li>
                  ) : (
                    filteredApps.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          className="prototype-link-option"
                          onClick={() => linkApp(a.id)}
                        >
                          {a.title}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
