import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { AppPrototype, Problem } from '../api/client';
import { MarkdownRenderer } from './MarkdownRenderer';
import './TabStyles.css';

interface AppsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
  onCardClickProblem: (id: string) => void;
  onCardClickSolution: (id: string) => void;
}

export function AppsTab({ searchQuery, onCardClick, onCardClickProblem, onCardClickSolution }: AppsTabProps) {
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
                  <select
                    id="app-problem"
                    value={selectedProblemId}
                    onChange={(e) => setSelectedProblemId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Problem Target --</option>
                    {problems.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
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
                <div className="card-header">
                  <div>
                    <h4>{app.title}</h4>
                    {app.problem && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <span
                          className="relation-tag solution-tag"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCardClickProblem(app.problem!.id);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          For: {app.problem.title}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="card-timestamp">{new Date(app.created_at).toLocaleDateString()}</span>
                </div>
                <div className="card-desc card-desc-preview">
                  <MarkdownRenderer content={previewDescription(app.description)} />
                </div>

                {app.solutions && app.solutions.length > 0 && (
                  <div className="card-relations" style={{ paddingBottom: '0.75rem' }}>
                    <h5 style={{ color: 'var(--accent-solution)' }}>Associated Solutions</h5>
                    <ul className="relation-list">
                      {app.solutions.map((sol) => (
                        <li
                          key={sol.id}
                          className="relation-tag solution-tag"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCardClickSolution(sol.id);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <span>{sol.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <a
                    href={app.github_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="submit-btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textDecoration: 'none',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      marginTop: 0,
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    GitHub Repo ↗
                  </a>

                  {app.live_url && (
                    <a
                      href={app.live_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="submit-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        background: 'var(--accent-blue)',
                        marginTop: 0,
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8rem',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      Launch App ↗
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
