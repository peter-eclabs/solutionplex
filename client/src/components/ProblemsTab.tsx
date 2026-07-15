import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Problem } from '../api/client';
import { DeleteButton } from './DeleteButton';
import { CardTitle } from './CardTitle';
import { CharCounter } from './CharCounter';
import { formatCreatedOn } from './formatCreatedOn';
import { Can } from '../auth/Can';
import { useRole } from '../auth/AuthContext';
import { HiddenToggle } from './HiddenToggle';
import { HiddenBadge } from './HiddenBadge';
import './TabStyles.css';
import { CheckCircle, X } from 'lucide-react';

interface ProblemsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
  /** Redirect readers who force a create action (defense in depth). */
  onWriteDenied?: () => void;
}

export function ProblemsTab({ searchQuery, onCardClick, onWriteDenied }: ProblemsTabProps) {
  const queryClient = useQueryClient();
  const { canWrite } = useRole();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openCreate = () => {
    if (!canWrite) {
      onWriteDenied?.();
      return;
    }
    setIsFormOpen(true);
  };

  const { data: problems = [], isLoading: loading, error: queryError } = useQuery<Problem[]>({
    queryKey: ['problems', searchQuery],
    queryFn: () => api.getProblems(searchQuery),
  });

  const createMutation = useMutation({
    mutationFn: (input: { title: string; description: string; hidden?: boolean }) => api.createProblem(input),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      return;
    }
    try {
      await createMutation.mutateAsync({ title: title.trim(), description: description.trim(), hidden });
      setTitle('');
      setDescription('');
      setHidden(false);
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
      {canWrite && isFormOpen && (
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
                    maxLength={100}
                    placeholder="e.g. Memory Leak in Session Cache"
                  />
                  <CharCounter value={title} max={100} />
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
                <HiddenToggle checked={hidden} onChange={setHidden} />
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
            <Can action="write">
              <article
                className="entity-card add-card-trigger"
                onClick={openCreate}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openCreate();
                  }
                }}
              >
                <div className="add-card-content">
                  <span className="add-icon">+</span>
                  <span className="add-text">Create Problem Card</span>
                </div>
              </article>
            </Can>

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
                  <div className="flex items-center gap-2">
                    {p.code && <span className="entity-code">{p.code}</span>}
                    {p.hidden && <HiddenBadge />}
                  </div>
                  <CardTitle title={p.title} />

                </div>
                <div className="card-footer">
                  <p className="card-created-on">{formatCreatedOn(p.created_at)}</p>
                  {p.solutions.length > 0 ? (
                    <p className="problem-status problem-solved flex items-center gap-2">
                      <CheckCircle className="w-3 h-3" />
                      Solved — {p.solutions.length} Solution{p.solutions.length === 1 ? '' : 's'}
                    </p>
                  ) : (
                    <p className="problem-status problem-unsolved flex items-center gap-1">
                      <X className="w-3 h-3" />
                      Unsolved
                    </p>
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
