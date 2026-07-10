import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Infrastructure } from '../api/client';
import { DeleteButton } from './DeleteButton';
import './TabStyles.css';

interface InfrastructureTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
}

export function InfrastructureTab({ searchQuery, onCardClick }: InfrastructureTabProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const previewDescription = (text: string, max = 140): string =>
    text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

  const { data: infras = [], isLoading: loading, error: queryError } = useQuery<Infrastructure[]>({
    queryKey: ['infrastructures', searchQuery],
    queryFn: () => api.getInfrastructures(searchQuery),
  });

  const createMutation = useMutation({
    mutationFn: (input: { title: string; description: string }) => api.createInfrastructure(input),
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
      queryClient.invalidateQueries({ queryKey: ['infrastructures'] });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create infrastructure');
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
              <h3>Add Infrastructure</h3>
              {error && <div className="error-banner">{error}</div>}
              <form onSubmit={handleSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="infra-title">Stack Name</label>
                  <input
                    id="infra-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. AWS Elasticache Redis Cluster"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="infra-desc">Description</label>
                  <textarea
                    id="infra-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Detailed specifications..."
                    rows={4}
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={!title.trim() || !description.trim()}>
                  Create Infrastructure Card
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}

        <section className="list-panel">
          {loading ? (
            <p className="status-text">Loading infrastructures...</p>
          ) : queryError ? (
            <div className="error-banner">{(queryError as Error).message || 'Failed to load infrastructures'}</div>
          ) : (
          <div className="cards-grid">
            <article
              className="entity-card add-card-trigger btn-infra"
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
                <span className="add-text">Create Infrastructure Card</span>
              </div>
            </article>

            {infras.map((i) => (
              <article
                key={i.id}
                className="entity-card infra-card"
                onClick={() => onCardClick(i.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCardClick(i.id);
                  }
                }}
              >
                <DeleteButton
                  entityLabel="Infrastructure"
                  onDelete={() => api.deleteInfrastructure(i.id)}
                  onDeleted={() => queryClient.invalidateQueries({ queryKey: ['infrastructures'] })}
                />
                <div className="card-header">
                  <h4>{i.title}</h4>
                </div>
                <div className="card-desc card-desc-preview">
                  {previewDescription(i.description)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
