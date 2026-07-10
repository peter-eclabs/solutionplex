import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Solution, Problem, Architecture, Infrastructure } from '../api/client';
import { MarkdownRenderer } from './MarkdownRenderer';
import './TabStyles.css';

interface SolutionsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
  onCardClickProblem: (id: string) => void;
  onCardClickArch: (id: string) => void;
  onCardClickInfra: (id: string) => void;
  onCardClickApp: (id: string) => void;
}

export function SolutionsTab({
  searchQuery,
  onCardClick,
  onCardClickProblem,
  onCardClickArch,
  onCardClickInfra,
  onCardClickApp,
}: SolutionsTabProps) {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [architectures, setArchitectures] = useState<Architecture[]>([]);
  const [infrastructures, setInfrastructures] = useState<Infrastructure[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState('');
  const [selectedArchIds, setSelectedArchIds] = useState<string[]>([]);
  const [selectedInfraIds, setSelectedInfraIds] = useState<string[]>([]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const previewDescription = (text: string, max = 140): string =>
    text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

  const loadRelations = useCallback(async () => {
    try {
      const [pData, aData, iData] = await Promise.all([
        api.getProblems(),
        api.getArchitectures(),
        api.getInfrastructures(),
      ]);
      setProblems(pData);
      setArchitectures(aData);
      setInfrastructures(iData);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(`Failed to populate form relation selectors: ${err.message}`);
      } else {
        setError('Failed to populate form relation selectors');
      }
    }
  }, []);

  const loadSolutions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getSolutions(searchQuery);
      setSolutions(data);
      setError('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load solutions');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadRelations();
  }, [loadRelations]);

  useEffect(() => {
    loadSolutions();
  }, [loadSolutions]);

  const handleArchCheckbox = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedArchIds([...selectedArchIds, id]);
    } else {
      setSelectedArchIds(selectedArchIds.filter((item) => item !== id));
    }
  };

  const handleInfraCheckbox = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedInfraIds([...selectedInfraIds, id]);
    } else {
      setSelectedInfraIds(selectedInfraIds.filter((item) => item !== id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !selectedProblemId) {
      setError('Title, Description, and target Problem statement are required fields.');
      return;
    }
    try {
      await api.createSolution({
        title: title.trim(),
        description: description.trim(),
        problem_id: selectedProblemId,
        architecture_ids: selectedArchIds,
        infrastructure_ids: selectedInfraIds,
      });
      setTitle('');
      setDescription('');
      setSelectedProblemId('');
      setSelectedArchIds([]);
      setSelectedInfraIds([]);
      setError('');
      setIsFormOpen(false);
      loadSolutions();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to submit solution mapping');
      }
    }
  };  return (
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
              <h3>Propose Solution</h3>
              {error && <div className="error-banner">{error}</div>}
              <form onSubmit={handleSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="sol-title">Solution Title</label>
                  <input
                    id="sol-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Distributed Redis Session Store"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="sol-desc">Description</label>
                  <textarea
                    id="sol-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Technical architecture details..."
                    rows={4}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="sol-problem">Problem Statement (1:1)</label>
                  <select
                    id="sol-problem"
                    value={selectedProblemId}
                    onChange={(e) => setSelectedProblemId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Problem Target --</option>
                    {problems.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Architecture Designs (1:N)</label>
                  <div className="checkbox-select-list">
                    {architectures.length === 0 ? (
                      <span className="status-text" style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                        No architectures available
                      </span>
                    ) : (
                      architectures.map((arch) => (
                        <label key={arch.id} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={selectedArchIds.includes(arch.id)}
                            onChange={(e) => handleArchCheckbox(arch.id, e.target.checked)}
                          />
                          {arch.title}
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="form-field">
                  <label>Infrastructure Stacks (1:N)</label>
                  <div className="checkbox-select-list">
                    {infrastructures.length === 0 ? (
                      <span className="status-text" style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                        No infrastructure available
                      </span>
                    ) : (
                      infrastructures.map((infra) => (
                        <label key={infra.id} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={selectedInfraIds.includes(infra.id)}
                            onChange={(e) => handleInfraCheckbox(infra.id, e.target.checked)}
                          />
                          {infra.title}
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={!title.trim() || !description.trim() || !selectedProblemId}
                >
                  Propose Solution Card
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}

      <section className="list-panel">
        {loading ? (
          <p className="status-text">Loading solution maps...</p>
        ) : (
          <div className="cards-grid">
            <article
              className="entity-card add-card-trigger btn-solution"
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
                <span className="add-text">Propose Solution Card</span>
              </div>
            </article>

            {solutions.map((s) => (
              <article
                key={s.id}
                className="entity-card solution-card"
                onClick={() => onCardClick(s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCardClick(s.id);
                  }
                }}
              >
                <div className="card-header">
                  <h4>{s.title}</h4>
                  <span className="card-timestamp">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="card-desc card-desc-preview">
                  <MarkdownRenderer content={previewDescription(s.description)} />
                </div>
                <div className="card-relations" style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {s.problem && (
                    <div>
                      <h5 style={{ color: 'var(--accent-problem)', margin: '0 0 0.2rem 0', fontSize: '0.75rem' }}>Target Problem</h5>
                      <span
                        className="relation-tag prob-tag"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCardClickProblem(s.problem!.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {s.problem.title}
                      </span>
                    </div>
                  )}

                  {s.architectures && s.architectures.length > 0 && (
                    <div>
                      <h5 style={{ color: 'var(--accent-arch)', margin: '0 0 0.2rem 0', fontSize: '0.75rem' }}>Architecture</h5>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {s.architectures.map((arch) => (
                          <span
                            key={arch.id}
                            className="relation-tag arch-tag"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCardClickArch(arch.id);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {arch.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {s.infrastructures && s.infrastructures.length > 0 && (
                    <div>
                      <h5 style={{ color: 'var(--accent-infra)', margin: '0 0 0.2rem 0', fontSize: '0.75rem' }}>Infrastructure</h5>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {s.infrastructures.map((infra) => (
                          <span
                            key={infra.id}
                            className="relation-tag infra-tag"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCardClickInfra(infra.id);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {infra.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {s.apps && s.apps.length > 0 && (
                    <div>
                      <h5 style={{ color: 'var(--accent-cyan)', margin: '0 0 0.2rem 0', fontSize: '0.75rem' }}>Linked Prototypes</h5>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {s.apps.map((app) => (
                          <span
                            key={app.id}
                            className="relation-tag app-tag"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCardClickApp(app.id);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            {app.title}
                          </span>
                        ))}
                      </div>
                    </div>
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
