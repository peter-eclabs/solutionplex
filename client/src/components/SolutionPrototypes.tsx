import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { AppShort, AppPrototype } from '../api/client';
import { CustomSelect } from './CustomSelect';
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [error, setError] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [linkableApps, setLinkableApps] = useState<AppPrototype[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState('');
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
      setSelectedLinkId('');
      setLinkError('');
      loadLinkable();
    }
  }, [isLinkOpen, loadLinkable]);

  const resetCreate = () => {
    setTitle('');
    setDescription('');
    setGithubUrl('');
    setLiveUrl('');
    setError('');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !githubUrl.trim()) {
      setError('Title, Description, and GitHub URL are required fields.');
      return;
    }
    try {
      await api.createApp({
        title: title.trim(),
        description: description.trim(),
        github_url: githubUrl.trim(),
        live_url: liveUrl.trim() || undefined,
        solution_id: solutionId,
      });
      setIsCreateOpen(false);
      resetCreate();
      onChanged();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to create prototype');
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLinkId) {
      setLinkError('Select a prototype to link.');
      return;
    }
    try {
      await api.updateApp(selectedLinkId, { solution_id: solutionId });
      setIsLinkOpen(false);
      onChanged();
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
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  const handleDelete = async (appId: string) => {
    try {
      await api.deleteApp(appId);
      setRemovingId(null);
      onChanged();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  return (
    <div className="solution-prototypes-section" onClick={(e) => e.stopPropagation()}>
      <div className="problem-solutions-header">
        <span className="solution-prototypes-label">Prototypes ({apps.length})</span>
        <div className="solution-prototypes-actions">
          <button
            type="button"
            className="propose-solution-btn"
            onClick={() => {
              resetCreate();
              setIsCreateOpen(true);
            }}
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
                    onClick={() => handleUnlink(app.id)}
                  >
                    Unlink
                  </button>
                  <button
                    type="button"
                    className="prototype-delete-btn"
                    onClick={() => handleDelete(app.id)}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="prototype-cancel-btn"
                    onClick={() => setRemovingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="prototype-remove-trigger"
                  aria-label={`Remove ${app.title}`}
                  onClick={() => setRemovingId(app.id)}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <aside className="creation-panel">
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsCreateOpen(false)}
                aria-label="Close form"
              >
                &times;
              </button>
              <h3>Create Prototype</h3>
              <p className="form-context-note">
                Targeting solution: <strong>{solutionTitle}</strong>
              </p>
              {error && <div className="error-banner">{error}</div>}
              <form onSubmit={handleCreateSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="sp-title">Prototype Name</label>
                  <input
                    id="sp-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Cache Monitor Admin"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="sp-desc">Description</label>
                  <textarea
                    id="sp-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={4}
                    placeholder="Core features and target users..."
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="sp-github">GitHub Repository URL (Required)</label>
                  <input
                    id="sp-github"
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    required
                    placeholder="https://github.com/owner/repo"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="sp-live">Live Deployed URL (Optional)</label>
                  <input
                    id="sp-live"
                    type="url"
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                    placeholder="https://myprototype.vercel.app"
                  />
                </div>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={!title.trim() || !description.trim() || !githubUrl.trim()}
                >
                  Create Prototype Card
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}

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
              <form onSubmit={handleLinkSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="sp-link">Select Prototype</label>
                  <CustomSelect
                    id="sp-link"
                    value={selectedLinkId}
                    onChange={setSelectedLinkId}
                    options={linkableApps.map((a) => ({ value: a.id, label: a.title }))}
                    placeholder="-- Select Prototype --"
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={!selectedLinkId}>
                  Link Prototype
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
