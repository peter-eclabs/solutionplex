import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { AppPrototype, Problem } from '../api/client';
import './TabStyles.css';
import { CustomSelect } from './CustomSelect';
import { DeleteButton } from './DeleteButton';


interface AppsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
}

export function AppsTab({ searchQuery, onCardClick }: AppsTabProps) {
  const [apps, setApps] = useState<AppPrototype[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const previewDescription = (text: string, max = 140): string =>
    text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

  const loadProblems = useCallback(async () => {
    try {
      const pData = await api.getProblems();
      setProblems(pData);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(`Failed to populate problems: ${err.message}`);
      } else {
        setError('Failed to populate problems dropdown');
      }
    }
  }, []);

  const loadApps = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getApps(searchQuery);
      setApps(data);
      setError('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load apps');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !githubUrl.trim() || !selectedProblemId) {
      setError('Title, Description, GitHub URL, and Problem Target are required fields.');
      return;
    }
    try {
      await api.createApp({
        title: title.trim(),
        description: description.trim(),
        github_url: githubUrl.trim(),
        live_url: liveUrl.trim() || undefined,
        problem_id: selectedProblemId,
      });
      setTitle('');
      setDescription('');
      setGithubUrl('');
      setLiveUrl('');
      setSelectedProblemId('');
      setError('');
      setIsFormOpen(false);
      loadApps();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create App card');
      }
    }
  };

  return (
    <div className="tab-split-container">
      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <aside className="creation-panel">
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsFormOpen(false)}
                aria-label="Close form"
              >
                &times;
              </button>
              <h3>Register Prototype</h3>
              {error && <div className="error-banner">{error}</div>}
              <form onSubmit={handleSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="app-title">App Name</label>
                  <input
                    id="app-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Cache Monitor Admin"
                  />
                </div>
                
                <div className="form-field">
                  <label htmlFor="app-desc">Description</label>
                  <textarea
                    id="app-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Core features and target users..."
                    rows={4}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="app-problem">Problem Statement (1:1)</label>
                  <CustomSelect
                    id="app-problem"
                    value={selectedProblemId}
                    onChange={setSelectedProblemId}
                    options={problems.map((p) => ({ value: p.id, label: p.title }))}
                    placeholder="-- Select Problem Target --"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="app-github">GitHub Repository URL (Required)</label>
                  <input
                    id="app-github"
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    required
                    placeholder="https://github.com/owner/repo"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="app-live">Live Deployed URL (Optional)</label>
                  <input
                    id="app-live"
                    type="url"
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                    placeholder="https://myprototype.vercel.app"
                  />
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={!title.trim() || !description.trim() || !githubUrl.trim() || !selectedProblemId}
                >
                  Create App Card
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}

      <section className="list-panel">
        {loading ? (
          <p className="status-text">Loading app prototype mappings...</p>
        ) : (
          <div className="cards-grid">
            <article
              className="entity-card add-card-trigger btn-app"
              onClick={() => setIsFormOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsFormOpen(true);
                }
              }}
            >
              <div className="add-card-content">
                <span className="add-icon">+</span>
                <span className="add-text">Create App Card</span>
              </div>
            </article>

            {apps.map((app) => (
              <article
                key={app.id}
                className="entity-card app-card"
                onClick={() => onCardClick(app.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCardClick(app.id);
                  }
                }}
              >
                <DeleteButton
                  entityLabel="App"
                  onDelete={() => api.deleteApp(app.id)}
                  onDeleted={loadApps}
                />
                <div className="card-header">
                  <h4>{app.title}</h4>
                </div>
                <div className="card-desc card-desc-preview">
                  {previewDescription(app.description)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
