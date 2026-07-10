import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AppPrototype, Solution } from '../api/client';
import './TabStyles.css';
import { CustomSelect } from './CustomSelect';
import { DeleteButton } from './DeleteButton';


interface AppsTabProps {
  searchQuery: string;
  onCardClick: (id: string) => void;
}

export function AppsTab({ searchQuery, onCardClick }: AppsTabProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [selectedSolutionId, setSelectedSolutionId] = useState('');

  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const previewDescription = (text: string, max = 140): string =>
    text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

  const { data: solutions = [] } = useQuery<Solution[]>({
    queryKey: ['solutions'],
    queryFn: () => api.getSolutions(),
  });

  const { data: apps = [], isLoading: loading, error: queryError } = useQuery<AppPrototype[]>({
    queryKey: ['apps', searchQuery],
    queryFn: () => api.getApps(searchQuery),
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      title: string;
      description: string;
      github_url: string;
      live_url?: string;
      solution_id?: string;
    }) => api.createApp(input),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !githubUrl.trim()) {
      setError('Title, Description, and GitHub URL are required fields.');
      return;
    }
    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        github_url: githubUrl.trim(),
        live_url: liveUrl.trim() || undefined,
        solution_id: selectedSolutionId || undefined,
      });
      setTitle('');
      setDescription('');
      setGithubUrl('');
      setLiveUrl('');
      setSelectedSolutionId('');
      setError('');
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create App card');
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
              <h3>Register Prototype</h3>
              {error && <div className="error-banner">{error}</div>}
              <form onSubmit={handleSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="app-title">App Name</label>
                  <input
                    id="app-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Cache Monitor Admin"
                  />
                </div>
                
                <div className="form-field">
                  <label htmlFor="app-desc">Description</label>
                  <textarea
                    id="app-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Core features and target users..."
                    rows={4}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="app-solution">Associated Solution (Optional)</label>
                  <CustomSelect
                    id="app-solution"
                    value={selectedSolutionId}
                    onChange={setSelectedSolutionId}
                    options={solutions.map((s) => ({ value: s.id, label: s.title }))}
                    placeholder="-- Select Solution Target --"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="app-github">GitHub Repository URL (Required)</label>
                  <input
                    id="app-github"
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    required
                    placeholder="https://github.com/owner/repo"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="app-live">Live Deployed URL (Optional)</label>
                  <input
                    id="app-live"
                    type="url"
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                    placeholder="https://myprototype.vercel.app"
                  />
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={!title.trim() || !description.trim() || !githubUrl.trim()}
                >
                  Create App Card
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}

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
