import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Problem } from '../api/client';
import { DeleteButton } from './DeleteButton';
import './TabStyles.css';

interface ProblemsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
}

export function ProblemsTab({ searchQuery, onCardClick }: ProblemsTabProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const previewDescription = (text: string, max = 140): string =>
    text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

  const { data: problems = [], isLoading: loading, error: queryError } = useQuery<Problem[]>({
    queryKey: ['problems', searchQuery],
    queryFn: () => api.getProblems(searchQuery),
  });

  const createMutation = useMutation({
    mutationFn: (input: { title: string; description: string }) => api.createProblem(input),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      return;
    }
    try {
      await createMutation.mutateAsync({ title: title.trim(), description: description.trim() });
      setTitle('');
      setDescription('');
      setIsFormOpen(false);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['problems'] });
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
          ) : queryError ? (
            <div className="error-banner">{(queryError as Error).message || 'Failed to load problems'}</div>
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
                <DeleteButton
                  entityLabel="Problem"
                  onDelete={() => api.deleteProblem(p.id)}
                  onDeleted={() => queryClient.invalidateQueries({ queryKey: ['problems'] })}
                />

                <div className="card-header">
                  <h4>{p.title}</h4>
                </div>
                <div className="card-desc card-desc-preview">
                  {previewDescription(p.description)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
