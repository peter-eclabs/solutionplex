import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Architecture } from '../api/client';
import { DeleteButton } from './DeleteButton';
import './TabStyles.css';

interface ArchitectureTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
}

export function ArchitectureTab({ searchQuery, onCardClick }: ArchitectureTabProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const previewDescription = (text: string, max = 140): string =>
    text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

  const { data: archs = [], isLoading: loading, error: queryError } = useQuery<Architecture[]>({
    queryKey: ['architectures', searchQuery],
    queryFn: () => api.getArchitectures(searchQuery),
  });

  const createMutation = useMutation({
    mutationFn: (input: { title: string; description: string }) => api.createArchitecture(input),
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
      queryClient.invalidateQueries({ queryKey: ['architectures'] });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create architecture');
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
              <h3>Add Architecture</h3>
              {error && <div className="error-banner">{error}</div>}
              <form onSubmit={handleSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="arch-title">Pattern Name</label>
                  <input
                    id="arch-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. CQRS with Event Sourcing"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="arch-desc">Description</label>
                  <textarea
                    id="arch-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Details of architectural application..."
                    rows={4}
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={!title.trim() || !description.trim()}>
                  Create Architecture Card
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}

        <section className="list-panel">
          {loading ? (
            <p className="status-text">Loading architectures...</p>
          ) : queryError ? (
            <div className="error-banner">{(queryError as Error).message || 'Failed to load architectures'}</div>
          ) : (
          <div className="cards-grid">
            <article
              className="entity-card add-card-trigger btn-arch"
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
                <span className="add-text">Create Architecture Card</span>
              </div>
            </article>

            {archs.map((a) => (
              <article
                key={a.id}
                className="entity-card arch-card"
                onClick={() => onCardClick(a.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCardClick(a.id);
                  }
                }}
              >
                <DeleteButton
                  entityLabel="Architecture"
                  onDelete={() => api.deleteArchitecture(a.id)}
                  onDeleted={() => queryClient.invalidateQueries({ queryKey: ['architectures'] })}
                />
                <div className="card-header">
                  <h4>{a.title}</h4>
                </div>
                <div className="card-desc card-desc-preview">
                  {previewDescription(a.description)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
