import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Solution, Problem, Architecture, Infrastructure } from '../api/client';
import './TabStyles.css';

interface SolutionsTabProps {
  searchQuery: string;
}

export function SolutionsTab({ searchQuery }: SolutionsTabProps) {
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
      loadSolutions();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to submit solution mapping');
      }
    }
  };

  return (
    <div className="tab-split-container">
      <aside className="creation-panel">
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

      <section className="list-panel">
        {loading ? (
          <p className="status-text">Loading solution maps...</p>
        ) : solutions.length === 0 ? (
          <p className="status-text">No solutions mapped yet.</p>
        ) : (
          <div className="cards-grid">
            {solutions.map((s) => (
              <article key={s.id} className="entity-card">
                <div className="card-header">
                  <h4>{s.title}</h4>
                  <span className="card-timestamp">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="card-desc">{s.description}</p>

                <div className="card-relations">
                  {s.problem && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <h5>Addresses Problem</h5>
                      <span className="relation-tag" style={{ color: 'var(--text-primary)' }}>
                        {s.problem.title}
                      </span>
                    </div>
                  )}

                  {s.architectures && s.architectures.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <h5>Architectures Used</h5>
                      <div className="relation-list">
                        {s.architectures.map((a) => (
                          <span key={a.id} className="relation-tag arch-tag">
                            {a.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {s.infrastructures && s.infrastructures.length > 0 && (
                    <div>
                      <h5>Infrastructure Deployed</h5>
                      <div className="relation-list">
                        {s.infrastructures.map((i) => (
                          <span key={i.id} className="relation-tag infra-tag">
                            {i.title}
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
