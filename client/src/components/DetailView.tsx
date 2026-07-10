import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Problem, Solution, Architecture, Infrastructure, AppPrototype } from '../api/client';
import { PlexVisualizer } from './PlexVisualizer';
import { MarkdownRenderer } from './MarkdownRenderer';
import './TabStyles.css';
import { CustomSelect } from './CustomSelect';
import { ProblemSolutions } from './ProblemSolutions';
import { SolutionPrototypes } from './SolutionPrototypes';

interface DetailViewProps {
  component: 'problems' | 'solutions' | 'architecture' | 'infrastructure' | 'apps';
  id: string;
  onNavigate: (path: string) => void;
}

type DetailPayload =
  | { kind: 'problems'; problemData: Problem; relatedApps: AppPrototype[]; problemSolutions: Solution[] }
  | { kind: 'solutions'; solutionData: Solution }
  | { kind: 'architecture'; archData: Architecture; relatedSolutions: Solution[] }
  | { kind: 'infrastructure'; infraData: Infrastructure; relatedSolutions: Solution[] }
  | { kind: 'apps'; appData: AppPrototype; readme: string };

export function DetailView({ component, id, onNavigate }: DetailViewProps) {
  const queryClient = useQueryClient();
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
  const [problemSolutions, setProblemSolutions] = useState<Solution[]>([]);

  // Editing states (common)
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Editing states (specialized)
  const [editProblemId, setEditProblemId] = useState('');
  const [editSolutionId, setEditSolutionId] = useState('');
  const [editArchIds, setEditArchIds] = useState<string[]>([]);
  const [editInfraIds, setEditInfraIds] = useState<string[]>([]);
  const [editGithubUrl, setEditGithubUrl] = useState('');
  const [editLiveUrl, setEditLiveUrl] = useState('');

  // Global lookups for editing dropdowns
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [allSolutions, setAllSolutions] = useState<Solution[]>([]);
  const [allArchs, setAllArchs] = useState<Architecture[]>([]);
  const [allInfras, setAllInfras] = useState<Infrastructure[]>([]);

  const { data, isLoading, error: queryError } = useQuery<DetailPayload>({
    queryKey: [component, id],
    enabled: !!component && !!id,
    queryFn: async (): Promise<DetailPayload> => {
      switch (component) {
        case 'problems': {
          const [problemData, apps, sols] = await Promise.all([
            api.getProblem(id),
            api.getApps(),
            api.getSolutions(),
          ]);
          return {
            kind: 'problems',
            problemData,
            relatedApps: apps.filter((a) => a.problem?.id === id),
            problemSolutions: sols.filter((s) => s.problem?.id === id),
          };
        }
        case 'solutions': {
          const solutionData = await api.getSolution(id);
          return { kind: 'solutions', solutionData };
        }
        case 'architecture': {
          const [archData, sols] = await Promise.all([api.getArchitecture(id), api.getSolutions()]);
          return {
            kind: 'architecture',
            archData,
            relatedSolutions: sols.filter((s) => s.architectures.some((a) => a.id === id)),
          };
        }
        case 'infrastructure': {
          const [infraData, sols] = await Promise.all([api.getInfrastructure(id), api.getSolutions()]);
          return {
            kind: 'infrastructure',
            infraData,
            relatedSolutions: sols.filter((s) => s.infrastructures.some((i) => i.id === id)),
          };
        }
        case 'apps': {
          const appData = await api.getApp(id);
          let readme = '';
          try {
            const res = await api.getReadme(appData.github_url);
            readme = res.readme_content;
          } catch {
            readme = 'Failed to retrieve repository README.md. Verify URL or GitHub integration.';
          }
          return { kind: 'apps', appData, readme };
        }
        default:
          throw new Error('Unknown entity component');
      }
    },
  });

  const { data: lookups } = useQuery({
    queryKey: ['detail-lookups'],
    enabled: component === 'solutions' || component === 'apps',
    queryFn: async () => {
      const [probs, archs, infras, sols] = await Promise.all([
        api.getProblems(),
        api.getArchitectures(),
        api.getInfrastructures(),
        api.getSolutions(),
      ]);
      return { allProblems: probs, allArchs: archs, allInfras: infras, allSolutions: sols };
    },
  });

  // Hydrate view + edit state from the cached query payload.
  useEffect(() => {
    if (!data || isEditing) return;

    setProblemData(null);
    setSolutionData(null);
    setArchData(null);
    setInfraData(null);
    setAppData(null);
    setReadme('');
    setReadmeLoading(false);
    setRelatedSolutions([]);
    setRelatedApps([]);
    setProblemSolutions([]);

    if (data.kind === 'problems') {
      setProblemData(data.problemData);
      setEditTitle(data.problemData.title);
      setEditDescription(data.problemData.description);
      setRelatedApps(data.relatedApps);
      setProblemSolutions(data.problemSolutions);
    } else if (data.kind === 'solutions') {
      setSolutionData(data.solutionData);
      setEditTitle(data.solutionData.title);
      setEditDescription(data.solutionData.description);
      setEditProblemId(data.solutionData.problem?.id || '');
      setEditArchIds(data.solutionData.architectures.map((a) => a.id));
      setEditInfraIds(data.solutionData.infrastructures.map((i) => i.id));
    } else if (data.kind === 'architecture') {
      setArchData(data.archData);
      setEditTitle(data.archData.title);
      setEditDescription(data.archData.description);
    } else if (data.kind === 'infrastructure') {
      setInfraData(data.infraData);
      setEditTitle(data.infraData.title);
      setEditDescription(data.infraData.description);
    } else if (data.kind === 'apps') {
      setAppData(data.appData);
      setEditTitle(data.appData.title);
      setEditDescription(data.appData.description);
      setEditSolutionId(data.appData.solution?.id || '');
      setEditGithubUrl(data.appData.github_url);
      setEditLiveUrl(data.appData.live_url || '');
      setReadme(data.readme);
    }
  }, [data, isEditing]);

  // Keep edit dropdowns populated from the lookups cache.
  useEffect(() => {
    if (!lookups) return;
    setAllProblems(lookups.allProblems);
    setAllArchs(lookups.allArchs);
    setAllInfras(lookups.allInfras);
    setAllSolutions(lookups.allSolutions);
  }, [lookups]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (component === 'problems') {
        return api.updateProblem(id, { title: editTitle.trim(), description: editDescription.trim() });
      } else if (component === 'solutions') {
        return api.updateSolution(id, {
          title: editTitle.trim(),
          description: editDescription.trim(),
          problem_id: editProblemId || undefined,
          architecture_ids: editArchIds,
          infrastructure_ids: editInfraIds,
        });
      } else if (component === 'architecture') {
        return api.updateArchitecture(id, { title: editTitle.trim(), description: editDescription.trim() });
      } else if (component === 'infrastructure') {
        return api.updateInfrastructure(id, { title: editTitle.trim(), description: editDescription.trim() });
      } else {
        return api.updateApp(id, {
          title: editTitle.trim(),
          description: editDescription.trim(),
          solution_id: editSolutionId || undefined,
          github_url: editGithubUrl.trim(),
          live_url: editLiveUrl.trim() || undefined,
        });
      }
    },
  });

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editDescription.trim()) {
      return;
    }
    if (component === 'apps' && !editSolutionId) {
      setError('Target Solution is a required field.');
      return;
    }
    setError('');
    try {
      await updateMutation.mutateAsync();
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: [component, id] });
      if (component === 'solutions' || component === 'apps') {
        queryClient.invalidateQueries({ queryKey: ['detail-lookups'] });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update details');
      }
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

  const getBackNavigation = () => {
    const state = window.history.state as { fromApp?: boolean; fromPath?: string } | null;
    
    if (state?.fromApp && state?.fromPath) {
      const fromPath = state.fromPath;
      if (fromPath === '/') {
        return { label: 'BACK TO DASHBOARD', action: () => window.history.back() };
      }
      if (fromPath.startsWith('/problems/')) {
        return { label: 'BACK TO PROBLEM', action: () => window.history.back() };
      }
      if (fromPath.startsWith('/solutions/')) {
        return { label: 'BACK TO SOLUTION', action: () => window.history.back() };
      }
      if (fromPath.startsWith('/architecture/')) {
        return { label: 'BACK TO ARCHITECTURE', action: () => window.history.back() };
      }
      if (fromPath.startsWith('/infrastructure/')) {
        return { label: 'BACK TO INFRASTRUCTURE', action: () => window.history.back() };
      }
      if (fromPath.startsWith('/apps/')) {
        return { label: 'BACK TO APP', action: () => window.history.back() };
      }
    }

    if (component === 'solutions' && solutionData?.problem?.id) {
      return {
        label: 'BACK TO PROBLEM',
        action: () => onNavigate(`/problems/${solutionData.problem!.id}`),
      };
    }
    if (component === 'apps') {
      if (appData?.solution?.id) {
        return {
          label: 'BACK TO SOLUTION',
          action: () => onNavigate(`/solutions/${appData.solution!.id}`),
        };
      }
      if (appData?.problem?.id) {
        return {
          label: 'BACK TO PROBLEM',
          action: () => onNavigate(`/problems/${appData.problem!.id}`),
        };
      }
    }
    
    return {
      label: 'BACK TO DASHBOARD',
      action: () => onNavigate('/'),
    };
  };

  if (isLoading && !isEditing) {
    return (
      <div className="telemetry-loader">
        <div className="loader-orbit"></div>
        <p className="status-text">Synchronizing Telemetry Nodes...</p>
      </div>
    );
  }

  if ((error || queryError) && !isEditing) {
    return (
      <div className="error-container" style={{ padding: '2rem', maxWidth: '600px', margin: '4rem auto', border: '1px solid var(--accent-problem)', background: 'var(--bg-secondary)' }}>
        <h3 style={{ color: 'var(--accent-problem)', textTransform: 'uppercase', marginBottom: '1rem' }}>⚠ Error Syncing Node</h3>
        <p className="error-banner">{error || (queryError as Error).message}</p>
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
        <button onClick={getBackNavigation().action} className="back-link">
          <span className="arrow">←</span> {getBackNavigation().label}
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
                  <button type="submit" className="save-edit-btn" disabled={updateMutation.isPending}>
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
                    <label htmlFor="app-sol-edit">Target Solution (Required)</label>
                    <CustomSelect
                      id="app-sol-edit"
                      value={editSolutionId}
                      onChange={setEditSolutionId}
                      options={allSolutions.map((s) => ({ value: s.id, label: s.title }))}
                      placeholder="-- Select Solution Target --"
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

                  {/* Embedded Solutions (migrated from Solutions tab) */}
                  {component === 'problems' && problemData && (
                    <ProblemSolutions
                      problemId={problemData.id}
                      problemTitle={problemData.title}
                      solutions={problemSolutions}
                      onChanged={() => queryClient.invalidateQueries({ queryKey: ['problems', problemData.id] })}
                      onNavigate={onNavigate}
                    />
                  )}

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
                  <SolutionPrototypes
                    solutionId={solutionData.id}
                    solutionTitle={solutionData.title}
                    apps={solutionData.apps}
                    onChanged={() => queryClient.invalidateQueries({ queryKey: ['solutions', solutionData.id] })}
                    onNavigate={onNavigate}
                  />
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
