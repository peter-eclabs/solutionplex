import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Solution } from '../api/client';
import { CustomSelect } from './CustomSelect';
import './TabStyles.css';

interface CreateAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** When provided, the app is created pre-linked to this solution and the selector is hidden. */
  solutionId?: string;
  solutionTitle?: string;
  heading?: string;
}

export function CreateAppModal({
  isOpen,
  onClose,
  onCreated,
  solutionId,
  solutionTitle,
  heading = 'Register Prototype',
}: CreateAppModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [selectedSolutionId, setSelectedSolutionId] = useState(solutionId ?? '');
  const [error, setError] = useState('');

  const { data: solutions = [] } = useQuery<Solution[]>({
    queryKey: ['solutions'],
    queryFn: () => api.getSolutions(),
    enabled: isOpen && !solutionId,
  });

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setGithubUrl('');
      setLiveUrl('');
      setSelectedSolutionId(solutionId ?? '');
      setError('');
    }
  }, [isOpen, solutionId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !githubUrl.trim()) {
      setError('Title, Description, and GitHub URL are required fields.');
      return;
    }
    try {
      await api.createApp({
        title: title.trim(),
        description: description.trim(),
        github_url: githubUrl.trim(),
        live_url: liveUrl.trim() || undefined,
        solution_id: solutionId ?? selectedSolutionId ?? undefined,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to create App card');
    }
  };

  const showSolutionSelect = !solutionId;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <aside className="creation-panel">
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close form">
            &times;
          </button>
          <h3>{heading}</h3>
          {solutionId && solutionTitle && (
            <p className="form-context-note">
              Targeting solution: <strong>{solutionTitle}</strong>
            </p>
          )}
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
            {showSolutionSelect && (
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
            )}
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
  );
}
