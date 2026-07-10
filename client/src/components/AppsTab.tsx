import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { AppPrototype, Problem } from '../api/client';
import './TabStyles.css';

interface AppsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
  onCardClickProblem: (id: string) => void;
}

export function AppsTab({ searchQuery, onCardClick, onCardClickProblem }: AppsTabProps) {
  const [apps, setApps] = useState<AppPrototype[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState('');
  
  const [expandedReadmeAppId, setExpandedReadmeAppId] = useState<string | null>(null);
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [readmeLoading, setReadmeLoading] = useState(false);
  
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

  const handleToggleReadme = async (appId: string, url: string) => {
    if (expandedReadmeAppId === appId) {
      setExpandedReadmeAppId(null);
      setReadmeContent('');
      return;
    }

    try {
      setReadmeLoading(true);
      setExpandedReadmeAppId(appId);
      setReadmeContent('Fetching repository README documentation...');
      
      const data = await api.getReadme(url);
      setReadmeContent(data.readme_content);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setReadmeContent(err.message);
      } else {
        setReadmeContent('Failed to retrieve README from GitHub API. Verify URL and token.');
      }
    } finally {
      setReadmeLoading(false);
    }
  };

  return (
    <div className="tab-split-container">
      <aside className="creation-panel collapsed">
        <button
          type="button"
          className="open-form-btn btn-app"
          onClick={() => setIsFormOpen(true)}
        >
          <span>+</span> Create App Card
        </button>
      </aside>

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
        ) : apps.length === 0 ? (
          <p className="status-text">No apps mapped yet.</p>
        ) : (
          <div className="cards-grid">
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
                <p className="card-desc card-desc-preview">{previewDescription(app.description)}</p>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleReadme(app.id, app.github_url);
                    }}
                    className="submit-btn"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      marginTop: 0,
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem'
                    }}
                    disabled={readmeLoading && expandedReadmeAppId === app.id}
                  >
                    {expandedReadmeAppId === app.id ? (readmeLoading ? 'Loading...' : 'Hide README') : 'Show README'}
                  </button>

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
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem'
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
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem'
                      }}
                    >
                      Launch App ↗
                    </a>
                  )}
                </div>

                {expandedReadmeAppId === app.id && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                    <h5 style={{
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-muted)',
                      marginBottom: '0.5rem'
                    }}>
                      README.md Documentation
                    </h5>
                    <pre style={{
                      marginTop: '0.5rem',
                      padding: '1rem',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.825rem',
                      fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.4'
                    }}>
                      {readmeContent}
                    </pre>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
