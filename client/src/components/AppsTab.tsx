import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AppPrototype } from '../api/client';
import { CreateAppModal } from './CreateAppModal';
import { DeleteButton } from './DeleteButton';
import { CardTitle } from './CardTitle';
import { LabelPreview } from './LabelPreview';
import { formatCreatedOn } from './formatCreatedOn';
import { invalidatePlexCaches } from '../api/queryKeys';
import { Can } from '../auth/Can';
import { useRole } from '../auth/AuthContext';
import './TabStyles.css';

interface AppsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
  /** Redirect readers who force a create action (defense in depth). */
  onWriteDenied?: () => void;
}

export function AppsTab({ searchQuery, onCardClick, onWriteDenied }: AppsTabProps) {
  const queryClient = useQueryClient();
  const { canWrite } = useRole();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openCreate = () => {
    if (!canWrite) {
      onWriteDenied?.();
      return;
    }
    setIsFormOpen(true);
  };

  const { data: apps = [], isLoading: loading, error: queryError } = useQuery<AppPrototype[]>({
    queryKey: ['apps', searchQuery],
    queryFn: () => api.getApps(searchQuery),
  });

  return (
    <div className="tab-split-container">
      {canWrite && (
        <CreateAppModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onCreated={() => invalidatePlexCaches(queryClient)}
        />
      )}

      <section className="list-panel">
        {loading ? (
          <p className="status-text">Loading app prototype mappings...</p>
        ) : queryError ? (
          <div className="error-banner">{(queryError as Error).message || 'Failed to load apps'}</div>
        ) : (
          <div className="cards-grid">
            <Can action="write">
              <article
                className="entity-card add-card-trigger btn-app"
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
                  <span className="add-text">Create App Card</span>
                </div>
              </article>
            </Can>

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
                  <CardTitle title={app.title} />
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
