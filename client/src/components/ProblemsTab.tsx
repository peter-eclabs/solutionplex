import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Problem } from '../api/client';
import './TabStyles.css';

interface ProblemsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
  onCardClickSolution: (id: string) => void;
}

export function ProblemsTab({ searchQuery, onCardClick, onCardClickSolution }: ProblemsTabProps) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const previewDescription = (text: string, max = 140): string =>
    text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

  const loadProblems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getProblems(searchQuery);
      setProblems(data);
      setError('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load problems');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      return;
    }
    try {
      await api.createProblem({ title: title.trim(), description: description.trim() });
      setTitle('');
      setDescription('');
      setIsFormOpen(false);
      loadProblems();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create problem');
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
              <h3>Register Problem</h3>
              {error && <div className="error-banner">{error}</div>}
              <form onSubmit={handleSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="prob-title">Title</label>
                  <input
                    id="prob-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Memory Leak in Session Cache"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="prob-desc">Description</label>
                  <textarea
                    id="prob-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Detailed description of the issue..."
                    rows={4}
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={!title.trim() || !description.trim()}>
                  Create Problem Card
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}

      <section className="list-panel">
        {loading ? (
          <p className="status-text">Loading problem entries...</p>
        ) : (
          <div className="cards-grid">
            <article
              className="entity-card add-card-trigger btn-problem"
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
                <span className="add-text">Create Problem Card</span>
              </div>
            </article>

            {problems.map((p) => (
              <article
                key={p.id}
                className="entity-card problem-card"
                onClick={() => onCardClick(p.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCardClick(p.id);
                  }
                }}
              >
                <div className="card-header">
                  <h4>{p.title}</h4>
                  <span className="card-timestamp">
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="card-desc card-desc-preview">
                  {previewDescription(p.description)}
                </p>

                {p.solutions && p.solutions.length > 0 && (
                  <div className="card-relations">
                    <h5>Proposed Solutions</h5>
                    <ul className="relation-list">
                      {p.solutions.map((s) => (
                        <li
                          key={s.id}
                          className="relation-tag solution-tag"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCardClickSolution(s.id);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <span>{s.title}</span>
                        </li>
                      ))}
                    </ul>
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
