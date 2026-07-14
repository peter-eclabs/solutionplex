import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import type { AppShort, AppPrototype } from '../api/client';
import { CreateAppModal } from './CreateAppModal';
import { useToast } from './ToastContext';
import { formatCreatedOn } from './formatCreatedOn';
import { Can } from '../auth/Can';
import { useRole } from '../auth/AuthContext';
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
  const { canWrite } = useRole();
  const { showToast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [allApps, setAllApps] = useState<AppPrototype[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [search, setSearch] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const linkListRef = useRef<HTMLDivElement>(null);
  const [linkCoords, setLinkCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const [removingId, setRemovingId] = useState<string | null>(null);

  const openLinkDropdown = useCallback(() => {
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (rect) setLinkCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setIsDropdownOpen(true);
  }, []);

  const loadAllApps = useCallback(async () => {
    setIsLoadingApps(true);
    try {
      const all = await api.getApps();
      setAllApps(all);
      // Open the list once data is ready so existing Apps-tab prototypes are visible.
      requestAnimationFrame(() => openLinkDropdown());
    } catch (err: unknown) {
      if (err instanceof Error) setLinkError(`Failed to load prototypes: ${err.message}`);
      else setLinkError('Failed to load prototypes');
    } finally {
      setIsLoadingApps(false);
    }
  }, [openLinkDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        linkListRef.current &&
        !linkListRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }
    };
    const handleReposition = () => {
      if (isDropdownOpen) {
        const rect = dropdownRef.current?.getBoundingClientRect();
        if (rect) setLinkCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (isLinkOpen) {
      setSearch('');
      setLinkError('');
      setAllApps([]);
      setIsDropdownOpen(false);
      setLinkCoords(null);
      loadAllApps();
    }
  }, [isLinkOpen, loadAllApps]);

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

  const query = search.trim().toLowerCase();
  const filteredApps = allApps.filter((a) => a.title.toLowerCase().includes(query));
  const isAlreadyLinked = (a: AppPrototype) => a.solution?.id === solutionId;
  const linkableCount = filteredApps.filter((a) => !isAlreadyLinked(a)).length;

  return (
    <div className="solution-prototypes-section" onClick={(e) => e.stopPropagation()}>
      <div className="problem-solutions-header">
        <span className="solution-prototypes-label">Prototypes ({apps.length})</span>
        <Can action="write">
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
        </Can>
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
                {app.created_at && (
                  <span className="problem-solution-created">
                    {formatCreatedOn(app.created_at)}
                  </span>
                )}
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
              ) : canWrite ? (
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
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <CreateAppModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={onChanged}
          solutionId={solutionId}
          solutionTitle={solutionTitle}
          heading="Create Prototype"
        />
      )}

      {canWrite && isLinkOpen && (
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                <label
                  htmlFor="sp-link-search"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  Search Prototypes
                </label>
                <div
                  className={`custom-select-container ${isDropdownOpen ? 'is-open' : ''}`}
                  ref={dropdownRef}
                >
                  <div
                    className="custom-select-trigger"
                    style={{ padding: 0, overflow: 'hidden' }}
                    onClick={() => openLinkDropdown()}
                  >
                    <input
                      id="sp-link-search"
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        openLinkDropdown();
                      }}
                      onFocus={() => openLinkDropdown()}
                      placeholder="Type to search prototypes..."
                      autoFocus
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        padding: '0.65rem 0.8rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      className="custom-select-arrow-btn"
                      aria-label="Toggle options"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isDropdownOpen) setIsDropdownOpen(false);
                        else openLinkDropdown();
                      }}
                    >
                      <span className="custom-select-arrow" style={{ marginRight: '0.8rem' }}></span>
                    </button>
                  </div>
                  {isDropdownOpen && linkCoords && createPortal(
                    <div
                      className="custom-select-dropdown"
                      ref={linkListRef}
                      style={{ position: 'fixed', top: linkCoords.top, left: linkCoords.left, width: linkCoords.width, zIndex: 2000 }}
                    >
                      {isLoadingApps ? (
                        <div className="custom-select-option" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                          Loading prototypes…
                        </div>
                      ) : allApps.length === 0 ? (
                        <div className="custom-select-option" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                          No prototypes registered yet. Create one first.
                        </div>
                      ) : filteredApps.length === 0 ? (
                        <div className="custom-select-option" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                          No matching prototypes
                        </div>
                      ) : (
                        <>
                          {filteredApps.map((a) => {
                            const linked = isAlreadyLinked(a);
                            const suffix = linked
                              ? ' (already linked)'
                              : a.solution
                                ? ` → ${a.solution.title}`
                                : '';
                            return (
                              <div
                                key={a.id}
                                className={`custom-select-option${linked ? ' is-disabled' : ''}`}
                                title={
                                  linked
                                    ? 'Already linked to this solution'
                                    : a.solution
                                      ? `Currently linked to ${a.solution.title} — will reassign`
                                      : a.title
                                }
                                onClick={() => {
                                  if (linked) return;
                                  linkApp(a.id);
                                  setIsDropdownOpen(false);
                                }}
                              >
                                {a.title}{suffix}
                              </div>
                            );
                          })}
                          {linkableCount === 0 && (
                            <div
                              className="custom-select-option is-disabled"
                              style={{
                                borderTop: '1px solid var(--border-grid)',
                                cursor: 'default',
                                height: 'auto',
                                minHeight: 'var(--dropdown-option-height)',
                                whiteSpace: 'normal',
                              }}
                            >
                              All matching prototypes are already linked to this solution.
                            </div>
                          )}
                        </>
                      )}
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
