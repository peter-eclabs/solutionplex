import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Technology } from '../api/client';
import { DeleteButton } from './DeleteButton';
import { CardTitle } from './CardTitle';
import { CharCounter } from './CharCounter';
import { Can } from '../auth/Can';
import { useRole } from '../auth/AuthContext';
import './TabStyles.css';

interface TechnologiesTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
  /** Redirect readers who force a create action (defense in depth). */
  onWriteDenied?: () => void;
}

export function TechnologiesTab({ searchQuery, onCardClick, onWriteDenied }: TechnologiesTabProps) {
  const queryClient = useQueryClient();
  const { canWrite } = useRole();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openCreate = () => {
    if (!canWrite) {
      onWriteDenied?.();
      return;
    }
    setIsFormOpen(true);
  };

  const previewDescription = (text: string, max = 140): string =>
    text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

  const { data: techs = [], isLoading: loading, error: queryError } = useQuery<Technology[]>({
    queryKey: ['technologies', searchQuery],
    queryFn: () => api.getTechnologies(searchQuery),
  });

  const createMutation = useMutation({
    mutationFn: (input: { title: string; description: string }) => api.createTechnology(input),
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
      queryClient.invalidateQueries({ queryKey: ['technologies'] });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create technology');
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
              <h3>Add Technology</h3>
              {error && <div className="error-banner">{error}</div>}
              <form onSubmit={handleSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="tech-title">Technology Name</label>
                  <input
                    id="tech-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={100}
                    placeholder="e.g. React Query, FastAPI, Docker"
                  />
                  <CharCounter value={title} max={100} />
                </div>
                <div className="form-field">
                  <label htmlFor="tech-desc">Description</label>
                  <textarea
                    id="tech-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Details of technology usage..."
                    rows={4}
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={!title.trim() || !description.trim()}>
                  Create Technology Card
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}

        <section className="list-panel">
          {loading ? (
            <p className="status-text">Loading technologies...</p>
          ) : queryError ? (
            <div className="error-banner">{(queryError as Error).message || 'Failed to load technologies'}</div>
          ) : (
          <div className="cards-grid">
            <Can action="write">
              <article
                className="entity-card add-card-trigger btn-tech"
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
                  <span className="add-text">Create Technology Card</span>
                </div>
              </article>
            </Can>

            {techs.map((t) => (
              <article
                key={t.id}
                className="entity-card tech-card"
                onClick={() => onCardClick(t.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCardClick(t.id);
                  }
                }}
              >
                <DeleteButton
                  entityLabel="Technology"
                  onDelete={() => api.deleteTechnology(t.id)}
                  onDeleted={() => queryClient.invalidateQueries({ queryKey: ['technologies'] })}
                />
                <div className="card-header">
                  {t.code && <span className="entity-code">{t.code}</span>}
                  <CardTitle title={t.title} />
                </div>
                <div className="card-desc card-desc-preview">
                  {previewDescription(t.description)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
