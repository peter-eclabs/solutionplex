import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Problem, Solution, Architecture, Infrastructure, AppPrototype } from '../api/client';
import { PlexVisualizer } from './PlexVisualizer';
import { MarkdownRenderer } from './MarkdownRenderer';
import './TabStyles.css';
import { CustomSelect } from './CustomSelect';


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
    
    // Clear previous node states to prevent stale leakage
    setProblemData(null);
    setSolutionData(null);
    setArchData(null);
    setInfraData(null);
    setAppData(null);
    setReadme('');
    setRelatedSolutions([]);
    setRelatedApps([]);

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
    if (component === 'problems' && problemData) return problemData.title;
    if (component === 'solutions' && solutionData) return solutionData.title;
    if (component === 'architecture' && archData) return archData.title;
    if (component === 'infrastructure' && infraData) return infraData.title;
    if (component === 'apps' && appData) return appData.title;
    return 'Entity Details';
  };

  const getEntityDescription = () => {
    if (component === 'problems' && problemData) return problemData.description;
    if (component === 'solutions' && solutionData) return solutionData.description;
    if (component === 'architecture' && archData) return archData.description;
    if (component === 'infrastructure' && infraData) return infraData.description;
    if (component === 'apps' && appData) return appData.description;
    return '';
  };

  const getEntityTimestamp = () => {
    let d: Problem | Solution | Architecture | Infrastructure | AppPrototype | null = null;
    if (component === 'problems') d = problemData;
    else if (component === 'solutions') d = solutionData;
    else if (component === 'architecture') d = archData;
    else if (component === 'infrastructure') d = infraData;
    else if (component === 'apps') d = appData;
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
                    <CustomSelect
                      id="sol-prob-edit"
                      value={editProblemId}
                      onChange={setEditProblemId}
                      options={allProblems.map((p) => ({ value: p.id, label: p.title }))}
                      placeholder="-- Select Problem Target --"
                    />
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
                    <CustomSelect
                      id="app-prob-edit"
                      value={editProblemId}
                      onChange={setEditProblemId}
                      options={allProblems.map((p) => ({ value: p.id, label: p.title }))}
                      placeholder="-- Select Problem Target --"
                    />
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
                <div className="description-body">
                  <MarkdownRenderer content={getEntityDescription()} />
                </div>

                {/* Plex Visualizer Graph Section */}
                {component === 'problems' && problemData && (
                  <div className="card-visualizer-section">
                    <h4 className="visualizer-section-title">Plex Visualizer</h4>
                    <PlexVisualizer
                      component="problems"
                      data={problemData}
                      relatedApps={relatedApps}
                      onNavigate={onNavigate}
                    />
                  </div>
                )}
                {component === 'solutions' && solutionData && (
                  <div className="card-visualizer-section">
                    <h4 className="visualizer-section-title">Plex Visualizer</h4>
                    <PlexVisualizer
                      component="solutions"
                      data={solutionData}
                      onNavigate={onNavigate}
                    />
                  </div>
                )}
                {component === 'architecture' && archData && (
                  <div className="card-visualizer-section">
                    <h4 className="visualizer-section-title">Plex Visualizer</h4>
                    <PlexVisualizer
                      component="architecture"
                      data={archData}
                      relatedSolutions={relatedSolutions}
                      onNavigate={onNavigate}
                    />
                  </div>
                )}
                {component === 'infrastructure' && infraData && (
                  <div className="card-visualizer-section">
                    <h4 className="visualizer-section-title">Plex Visualizer</h4>
                    <PlexVisualizer
                      component="infrastructure"
                      data={infraData}
                      relatedSolutions={relatedSolutions}
                      onNavigate={onNavigate}
                    />
                  </div>
                )}
                {component === 'apps' && appData && (
                  <div className="card-visualizer-section">
                    <h4 className="visualizer-section-title">Plex Visualizer</h4>
                    <PlexVisualizer
                      component="apps"
                      data={appData}
                      onNavigate={onNavigate}
                    />
                  </div>
                )}

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
                    <div className="readme-block">
                      <MarkdownRenderer content={readme} />
                    </div>
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


      </div>
    </div>
  );
}
