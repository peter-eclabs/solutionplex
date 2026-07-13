import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AppPrototype } from '../api/client';
import { CreateAppModal } from './CreateAppModal';
import { DeleteButton } from './DeleteButton';
import { LabelPreview } from './LabelPreview';
import { formatCreatedOn } from './formatCreatedOn';
import { invalidatePlexCaches } from '../api/queryKeys';
import './TabStyles.css';

interface AppsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
}

export function AppsTab({ searchQuery, onCardClick }: AppsTabProps) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: apps = [], isLoading: loading, error: queryError } = useQuery<AppPrototype[]>({
    queryKey: ['apps', searchQuery],
    queryFn: () => api.getApps(searchQuery),
  });

  return (
    <div className="tab-split-container">
      <CreateAppModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onCreated={() => invalidatePlexCaches(queryClient)}
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
                  onDeleted={() => invalidatePlexCaches(queryClient)}
                />
                <div className="card-header">
                  {app.code && <span className="entity-code">{app.code}</span>}
                  <h4>{app.title}</h4>
                </div>
                <p className="card-created-on">{formatCreatedOn(app.created_at)}</p>
                <LabelPreview
                  architectures={app.architectures ?? []}
                  infrastructures={app.infrastructures ?? []}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
