import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AppPrototype } from '../api/client';
import { CreateAppModal } from './CreateAppModal';
import { DeleteButton } from './DeleteButton';
import './TabStyles.css';

interface AppsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
}

export function AppsTab({ searchQuery, onCardClick }: AppsTabProps) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const previewDescription = (text: string, max = 140): string =>
    text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

  const { data: apps = [], isLoading: loading, error: queryError } = useQuery<AppPrototype[]>({
    queryKey: ['apps', searchQuery],
    queryFn: () => api.getApps(searchQuery),
  });

  return (
    <div className="tab-split-container">
      <CreateAppModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['apps'] })}
      />

      <section className="list-panel">
        {loading ? (
          <p className="status-text">Loading app prototype mappings...</p>
        ) : queryError ? (
          <div className="error-banner">{(queryError as Error).message || 'Failed to load apps'}</div>
        ) : (
          <div className="cards-grid">
            <article
              className="entity-card add-card-trigger btn-app"
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
                <span className="add-text">Create App Card</span>
              </div>
            </article>

            {apps.map((app) => (
              <article
                key={app.id}
                className="entity-card app-card"
                onClick={() => onCardClick(app.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCardClick(app.id);
                  }
                }}
              >
                <DeleteButton
                  entityLabel="App"
                  onDelete={() => api.deleteApp(app.id)}
                  onDeleted={() => queryClient.invalidateQueries({ queryKey: ['apps'] })}
                />
                <div className="card-header">
                  <h4>{app.title}</h4>
                </div>
                <div className="card-desc card-desc-preview">
                  {previewDescription(app.description)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
