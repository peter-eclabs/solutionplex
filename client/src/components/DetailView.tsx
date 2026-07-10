import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Problem, Solution, Architecture, Infrastructure, AppPrototype } from '../api/client';
import './TabStyles.css';

interface DetailViewProps {
  component: 'problems' | 'solutions' | 'architecture' | 'infrastructure' | 'apps';
  id: string;
  onNavigate: (path: string) => void;
}

export function DetailView({ component, id, onNavigate }: DetailViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Loaded Entity Data
  const [problemData, setProblemData] = useState<Problem | null>(null);
  const [solutionData, setSolutionData] = useState<Solution | null>(null);
  const [archData, setArchData] = useState<Architecture | null>(null);
  const [infraData, setInfraData] = useState<Infrastructure | null>(null);
  const [appData, setAppData] = useState<AppPrototype | null>(null);

  // README (for Apps)
  const [readme, setReadme] = useState('');
  const [readmeLoading, setReadmeLoading] = useState(false);

  // Reciprocal Plex relations
  const [relatedSolutions, setRelatedSolutions] = useState<Solution[]>([]);
  const [relatedApps, setRelatedApps] = useState<AppPrototype[]>([]);

  // Editing states (common)
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Editing states (specialized)
  const [editProblemId, setEditProblemId] = useState('');
  const [editArchIds, setEditArchIds] = useState<string[]>([]);
  const [editInfraIds, setEditInfraIds] = useState<string[]>([]);
  const [editGithubUrl, setEditGithubUrl] = useState('');
  const [editLiveUrl, setEditLiveUrl] = useState('');

  // Global lookups for editing dropdowns
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [allArchs, setAllArchs] = useState<Architecture[]>([]);
  const [allInfras, setAllInfras] = useState<Infrastructure[]>([]);

  const loadLookups = useCallback(async () => {
    try {
      const [probs, archs, infras] = await Promise.all([
        api.getProblems(),
        api.getArchitectures(),
        api.getInfrastructures(),
      ]);
      setAllProblems(probs);
      setAllArchs(archs);
      setAllInfras(infras);
    } catch (err) {
      console.error('Failed to load lookup data for editing relations', err);
    }
  }, []);

  const loadEntity = useCallback(async () => {
    setLoading(true);
    setError('');
    setIsEditing(false);
    try {
      if (component === 'problems') {
        const data = await api.getProblem(id);
        setProblemData(data);
        setEditTitle(data.title);
        setEditDescription(data.description);

        // Fetch reciprocal apps for this problem
        const apps = await api.getApps();
        setRelatedApps(apps.filter((a) => a.problem?.id === id));
      } else if (component === 'solutions') {
        const data = await api.getSolution(id);
        setSolutionData(data);
        setEditTitle(data.title);
        setEditDescription(data.description);
        setEditProblemId(data.problem?.id || '');
        setEditArchIds(data.architectures.map((a) => a.id));
        setEditInfraIds(data.infrastructures.map((i) => i.id));
        await loadLookups();
      } else if (component === 'architecture') {
        const data = await api.getArchitecture(id);
        setArchData(data);
        setEditTitle(data.title);
        setEditDescription(data.description);

        // Fetch solutions implementing this architecture
        const sols = await api.getSolutions();
        setRelatedSolutions(sols.filter((s) => s.architectures.some((a) => a.id === id)));
      } else if (component === 'infrastructure') {
        const data = await api.getInfrastructure(id);
        setInfraData(data);
        setEditTitle(data.title);
        setEditDescription(data.description);

        // Fetch solutions implementing this infrastructure
        const sols = await api.getSolutions();
        setRelatedSolutions(sols.filter((s) => s.infrastructures.some((i) => i.id === id)));
      } else if (component === 'apps') {
        const data = await api.getApp(id);
        setAppData(data);
        setEditTitle(data.title);
        setEditDescription(data.description);
        setEditProblemId(data.problem?.id || '');
        setEditGithubUrl(data.github_url);
        setEditLiveUrl(data.live_url || '');
        await loadLookups();
        
        // Fetch README
        setReadmeLoading(true);
        try {
          const readmeRes = await api.getReadme(data.github_url);
          setReadme(readmeRes.readme_content);
        } catch {
          setReadme('Failed to retrieve repository README.md. Verify URL or GitHub integration.');
        } finally {
          setReadmeLoading(false);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to retrieve entity data.');
      }
    } finally {
      setLoading(false);
    }
  }, [component, id, loadLookups]);

  useEffect(() => {
    loadEntity();
  }, [loadEntity]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editDescription.trim()) {
      return;
    }
    setLoading(true);
    try {
      if (component === 'problems') {
        await api.updateProblem(id, { title: editTitle.trim(), description: editDescription.trim() });
      } else if (component === 'solutions') {
        await api.updateSolution(id, {
          title: editTitle.trim(),
          description: editDescription.trim(),
          problem_id: editProblemId || undefined,
          architecture_ids: editArchIds,
          infrastructure_ids: editInfraIds,
        });
      } else if (component === 'architecture') {
        await api.updateArchitecture(id, { title: editTitle.trim(), description: editDescription.trim() });
      } else if (component === 'infrastructure') {
        await api.updateInfrastructure(id, { title: editTitle.trim(), description: editDescription.trim() });
      } else if (component === 'apps') {
        await api.updateApp(id, {
          title: editTitle.trim(),
          description: editDescription.trim(),
          problem_id: editProblemId || undefined,
          github_url: editGithubUrl.trim(),
          live_url: editLiveUrl.trim() || undefined,
        });
      }
      setIsEditing(false);
      await loadEntity();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update details');
      }
      setLoading(false);
    }
  };

  const handleArchCheckbox = (archId: string, checked: boolean) => {
    if (checked) {
      setEditArchIds([...editArchIds, archId]);
    } else {
      setEditArchIds(editArchIds.filter((item) => item !== archId));
    }
  };

  const handleInfraCheckbox = (infraId: string, checked: boolean) => {
    if (checked) {
      setEditInfraIds([...editInfraIds, infraId]);
    } else {
      setEditInfraIds(editInfraIds.filter((item) => item !== infraId));
    }
  };

  const getEntityTitle = () => {
    if (problemData) return problemData.title;
    if (solutionData) return solutionData.title;
    if (archData) return archData.title;
    if (infraData) return infraData.title;
    if (appData) return appData.title;
    return 'Entity Details';
  };

  const getEntityDescription = () => {
    if (problemData) return problemData.description;
    if (solutionData) return solutionData.description;
    if (archData) return archData.description;
    if (infraData) return infraData.description;
    if (appData) return appData.description;
    return '';
  };

  const getEntityTimestamp = () => {
    const d = problemData || solutionData || archData || infraData || appData;
    if (!d) return '';
    return new Date(d.created_at).toLocaleString();
  };

  const getComponentBadgeColor = () => {
    switch (component) {
      case 'problems': return 'var(--accent-problem)';
      case 'solutions': return 'var(--accent-solution)';
      case 'architecture': return 'var(--accent-arch)';
      case 'infrastructure': return 'var(--accent-infra)';
      case 'apps': return 'var(--accent-cyan)';
    }
  };

  if (loading && !isEditing) {
    return (
      <div className="telemetry-loader">
        <div className="loader-orbit"></div>
        <p className="status-text">Synchronizing Telemetry Nodes...</p>
      </div>
    );
  }

  if (error && !isEditing) {
    return (
      <div className="error-container" style={{ padding: '2rem', maxWidth: '600px', margin: '4rem auto', border: '1px solid var(--accent-problem)', background: 'var(--bg-secondary)' }}>
        <h3 style={{ color: 'var(--accent-problem)', textTransform: 'uppercase', marginBottom: '1rem' }}>⚠ Error Syncing Node</h3>
        <p className="error-banner">{error}</p>
        <button onClick={() => onNavigate('/')} className="submit-btn" style={{ borderColor: 'var(--accent-problem)', color: 'var(--accent-problem)', background: 'transparent' }}>
          ← Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="detail-page-container">
      {/* Header telemetry info */}
      <div className="detail-nav-header">
        <button onClick={() => onNavigate('/')} className="back-link">
          <span className="arrow">←</span> BACK TO DASHBOARD
        </button>
        <div className="telemetry-node-info">
          <span className="telemetry-label">SYSTEM_NODE // </span>
          <span className="telemetry-value" style={{ color: getComponentBadgeColor() }}>
            {component.toUpperCase()}_{id.slice(-6)}
          </span>
        </div>
      </div>

      <div className="detail-layout">
        {/* Main Details Section */}
        <div className="detail-main-card">
          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="crud-form detail-edit-form">
              <div className="form-header-edit">
                <h3>Edit Component Core</h3>
                <div className="edit-actions">
                  <button type="button" onClick={() => setIsEditing(false)} className="cancel-edit-btn">
                    Cancel
                  </button>
                  <button type="submit" className="save-edit-btn">
                    Save Nodes
                  </button>
                </div>
              </div>

              {error && <div className="error-banner">{error}</div>}

              <div className="form-field">
                <label htmlFor="detail-title">Title</label>
                <input
                  id="detail-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="detail-desc">Description</label>
                <textarea
                  id="detail-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  required
                  rows={8}
                />
              </div>

              {/* Special relationship inputs for Solutions */}
              {component === 'solutions' && (
                <>
                  <div className="form-field">
                    <label htmlFor="sol-prob-edit">Target Problem</label>
                    <select
                      id="sol-prob-edit"
                      value={editProblemId}
                      onChange={(e) => setEditProblemId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Problem Target --</option>
                      {allProblems.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Architecture Designs (1:N)</label>
                    <div className="checkbox-select-list">
                      {allArchs.map((arch) => (
                        <label key={arch.id} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={editArchIds.includes(arch.id)}
                            onChange={(e) => handleArchCheckbox(arch.id, e.target.checked)}
                          />
                          {arch.title}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Infrastructure Stacks (1:N)</label>
                    <div className="checkbox-select-list">
                      {allInfras.map((infra) => (
                        <label key={infra.id} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={editInfraIds.includes(infra.id)}
                            onChange={(e) => handleInfraCheckbox(infra.id, e.target.checked)}
                          />
                          {infra.title}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Special inputs for Apps */}
              {component === 'apps' && (
                <>
                  <div className="form-field">
                    <label htmlFor="app-prob-edit">Target Problem</label>
                    <select
                      id="app-prob-edit"
                      value={editProblemId}
                      onChange={(e) => setEditProblemId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Problem Target --</option>
                      {allProblems.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="app-github-edit">GitHub Repo URL</label>
                    <input
                      id="app-github-edit"
                      type="url"
                      value={editGithubUrl}
                      onChange={(e) => setEditGithubUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="app-live-edit">Live App URL (Optional)</label>
                    <input
                      id="app-live-edit"
                      type="url"
                      value={editLiveUrl}
                      onChange={(e) => setEditLiveUrl(e.target.value)}
                    />
                  </div>
                </>
              )}
            </form>
          ) : (
            <div className="card-viewer-mode">
              <div className="viewer-header">
                <div className="type-badge" style={{ borderColor: getComponentBadgeColor(), color: getComponentBadgeColor() }}>
                  {component.slice(0, -1).toUpperCase()}
                </div>
                <h2>{getEntityTitle()}</h2>
                <button onClick={() => setIsEditing(true)} className="edit-trigger-btn">
                  Edit Card
                </button>
              </div>

              <div className="viewer-body">
                <p className="description-body">{getEntityDescription()}</p>

                {component === 'apps' && appData && (
                  <div className="app-links-group">
                    <a
                      href={appData.github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="submit-btn"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-grid)', marginTop: 0 }}
                    >
                      GitHub Repository ↗
                    </a>
                    {appData.live_url && (
                      <a
                        href={appData.live_url}
                        target="_blank"
                        rel="noreferrer"
                        className="submit-btn"
                        style={{ background: 'var(--accent-cyan)', color: 'var(--bg-primary)', marginTop: 0 }}
                      >
                        Launch Live App ↗
                      </a>
                    )}
                  </div>
                )}
              </div>

              {component === 'apps' && appData && (
                <div className="app-readme-container">
                  <h4>README.md Documentation</h4>
                  {readmeLoading ? (
                    <p className="status-text">Accessing GitHub repository README streams...</p>
                  ) : (
                    <pre className="readme-block">{readme}</pre>
                  )}
                </div>
              )}

              <div className="viewer-footer">
                <div className="timestamp-group">
                  <span>RECORDED:</span>
                  <strong>{getEntityTimestamp()}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Relations Sidebar ("The Plex") */}
        <div className="detail-relations-sidebar">
          <h3>The Plex Relationships</h3>
          <div className="relations-list-wrapper">
            {/* Outgoing relationships depending on the component */}
            {problemData && (
              <div className="relation-category-block">
                <h4>Proposed Solutions</h4>
                {problemData.solutions.length === 0 ? (
                  <p className="empty-rel-text">No solutions proposed for this problem yet.</p>
                ) : (
                  <div className="rel-cards-list">
                    {problemData.solutions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => onNavigate(`/solutions/${s.id}`)}
                        className="rel-mini-card solution-border"
                      >
                        <h5>{s.title}</h5>
                        <span>View Solution Node →</span>
                      </div>
                    ))}
                  </div>
                )}

                <h4 style={{ marginTop: '1.5rem' }}>Associated App Prototypes</h4>
                {relatedApps.length === 0 ? (
                  <p className="empty-rel-text">No functional apps linked to this problem yet.</p>
                ) : (
                  <div className="rel-cards-list">
                    {relatedApps.map((app) => (
                      <div
                        key={app.id}
                        onClick={() => onNavigate(`/apps/${app.id}`)}
                        className="rel-mini-card app-border"
                      >
                        <h5>{app.title}</h5>
                        <span>View App Node →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {solutionData && (
              <div className="relation-category-block">
                <h4>Addresses Problem Statement</h4>
                {solutionData.problem ? (
                  <div
                    onClick={() => onNavigate(`/problems/${solutionData.problem!.id}`)}
                    className="rel-mini-card problem-border"
                  >
                    <h5>{solutionData.problem.title}</h5>
                    <span>View Problem Statement →</span>
                  </div>
                ) : (
                  <p className="empty-rel-text">No problem statement targeted.</p>
                )}

                <h4 style={{ marginTop: '1.5rem' }}>Architectural Pattern Stacks</h4>
                {solutionData.architectures.length === 0 ? (
                  <p className="empty-rel-text">No architectural designs linked to this solution.</p>
                ) : (
                  <div className="rel-cards-list">
                    {solutionData.architectures.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => onNavigate(`/architecture/${a.id}`)}
                        className="rel-mini-card arch-border"
                      >
                        <h5>{a.title}</h5>
                        <span>View Architectural Pattern →</span>
                      </div>
                    ))}
                  </div>
                )}

                <h4 style={{ marginTop: '1.5rem' }}>Infrastructure Infrastructure Stacks</h4>
                {solutionData.infrastructures.length === 0 ? (
                  <p className="empty-rel-text">No infrastructure stacks deployed with this solution.</p>
                ) : (
                  <div className="rel-cards-list">
                    {solutionData.infrastructures.map((i) => (
                      <div
                        key={i.id}
                        onClick={() => onNavigate(`/infrastructure/${i.id}`)}
                        className="rel-mini-card infra-border"
                      >
                        <h5>{i.title}</h5>
                        <span>View Infrastructure Stack →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {archData && (
              <div className="relation-category-block">
                <h4>Solutions Implementing Pattern</h4>
                {relatedSolutions.length === 0 ? (
                  <p className="empty-rel-text">No active solution cards are deploying this architecture pattern.</p>
                ) : (
                  <div className="rel-cards-list">
                    {relatedSolutions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => onNavigate(`/solutions/${s.id}`)}
                        className="rel-mini-card solution-border"
                      >
                        <h5>{s.title}</h5>
                        <span>View Solution Node →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {infraData && (
              <div className="relation-category-block">
                <h4>Solutions Deploying Stack</h4>
                {relatedSolutions.length === 0 ? (
                  <p className="empty-rel-text">No active solution cards are deploying this infrastructure stack.</p>
                ) : (
                  <div className="rel-cards-list">
                    {relatedSolutions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => onNavigate(`/solutions/${s.id}`)}
                        className="rel-mini-card solution-border"
                      >
                        <h5>{s.title}</h5>
                        <span>View Solution Node →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {appData && (
              <div className="relation-category-block">
                <h4>Resolves Problem Statement</h4>
                {appData.problem ? (
                  <div
                    onClick={() => onNavigate(`/problems/${appData.problem!.id}`)}
                    className="rel-mini-card problem-border"
                  >
                    <h5>{appData.problem.title}</h5>
                    <span>View Problem Statement →</span>
                  </div>
                ) : (
                  <p className="empty-rel-text">No problem statement targeted.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
