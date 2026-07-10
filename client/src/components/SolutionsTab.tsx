import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Solution, Problem, Architecture, Infrastructure } from '../api/client';
import { MultiSelect } from './MultiSelect';
import './TabStyles.css';
import { CustomSelect } from './CustomSelect';


interface SolutionsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
}

export function SolutionsTab({
  searchQuery,
  onCardClick,
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
                  <CustomSelect
                    id="sol-problem"
                    value={selectedProblemId}
                    onChange={setSelectedProblemId}
                    options={problems.map((p) => ({ value: p.id, label: p.title }))}
                    placeholder="-- Select Problem Target --"
                  />
                </div>

                <div className="form-field">
                  <label>Architecture Designs (1:N)</label>
                  <MultiSelect
                    id="sol-arch"
                    options={architectures.map((arch) => ({ value: arch.id, label: arch.title }))}
                    selectedValues={selectedArchIds}
                    onChange={setSelectedArchIds}
                    placeholder="Search architecture designs…"
                    emptyText="No architectures available"
                  />
                </div>

                <div className="form-field">
                  <label>Infrastructure Stacks (1:N)</label>
                  <MultiSelect
                    id="sol-infra"
                    options={infrastructures.map((infra) => ({ value: infra.id, label: infra.title }))}
                    selectedValues={selectedInfraIds}
                    onChange={setSelectedInfraIds}
                    placeholder="Search infrastructure stacks…"
                    emptyText="No infrastructure available"
                  />
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
                </div>
                <div className="card-desc card-desc-preview">
                  {previewDescription(s.description)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
