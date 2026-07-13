import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Solution, Architecture, Infrastructure } from '../api/client';
import { MultiSelect } from './MultiSelect';
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
  const [proposeToSolution, setProposeToSolution] = useState(!!solutionId);
  const [selectedSolutionId, setSelectedSolutionId] = useState(solutionId ?? '');
  const [selectedArchIds, setSelectedArchIds] = useState<string[]>([]);
  const [selectedInfraIds, setSelectedInfraIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const solutionListRef = useRef<HTMLDivElement>(null);
  const [solutionCoords, setSolutionCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const { data: solutions = [] } = useQuery<Solution[]>({
    queryKey: ['solutions'],
    queryFn: () => api.getSolutions(),
    enabled: isOpen && !solutionId,
  });

  const { data: architectures = [] } = useQuery<Architecture[]>({
    queryKey: ['architectures'],
    queryFn: () => api.getArchitectures(),
    enabled: isOpen && !solutionId,
  });

  const { data: infrastructures = [] } = useQuery<Infrastructure[]>({
    queryKey: ['infrastructures'],
    queryFn: () => api.getInfrastructures(),
    enabled: isOpen && !solutionId,
  });

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setGithubUrl('');
      setLiveUrl('');
      setProposeToSolution(!!solutionId);
      setSelectedSolutionId(solutionId ?? '');
      setSelectedArchIds([]);
      setSelectedInfraIds([]);
      setSearchQuery(solutionTitle ?? '');
      setIsDropdownOpen(false);
      setError('');
    }
  }, [isOpen, solutionId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        solutionListRef.current &&
        !solutionListRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }
    };
    const handleReposition = () => {
      if (isDropdownOpen) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) setSolutionCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isDropdownOpen]);

  const openSolutionDropdown = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setSolutionCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setIsDropdownOpen(true);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !githubUrl.trim()) {
      setError('Title, Description, and GitHub URL are required fields.');
      return;
    }

    const targetSolutionId = proposeToSolution ? (solutionId ?? selectedSolutionId) : '';
    if (proposeToSolution) {
      if (!targetSolutionId) {
        setError('Please select a Solution to propose this App to.');
        return;
      }
    } else if (selectedArchIds.length === 0 || selectedInfraIds.length === 0) {
      setError('Please select both an Architecture Design and an Infrastructure Stack.');
      return;
    }

    try {
      await api.createApp({
        title: title.trim(),
        description: description.trim(),
        github_url: githubUrl.trim(),
        live_url: liveUrl.trim() || undefined,
        solution_id: targetSolutionId || undefined,
        architecture_ids: proposeToSolution ? [] : selectedArchIds,
        infrastructure_ids: proposeToSolution ? [] : selectedInfraIds,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to create App card');
    }
  };

  // The toggle is always shown; when pre-linked to a solution it defaults to ON.
  const showToggle = true;

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

            {showToggle && (
              <div className="form-field toggle-field">
                <label className="toggle-label" htmlFor="app-propose-toggle">
                  Propose to a Solution?
                </label>
                <label className="toggle-switch">
                  <input
                    id="app-propose-toggle"
                    type="checkbox"
                    checked={proposeToSolution}
                    onChange={(e) => setProposeToSolution(e.target.checked)}
                  />
                  <span className="toggle-slider" aria-hidden="true"></span>
                </label>
              </div>
            )}

            {showToggle && proposeToSolution && (
              <div className="form-field" ref={containerRef}>
                <label htmlFor="app-solution">Associated Solution (Required)</label>
                <div className={`multi-select-container ${isDropdownOpen ? 'is-open' : ''}`} style={{ position: 'relative' }}>
                  <div
                    className="multi-select-trigger"
                    onClick={() => openSolutionDropdown()}
                  >
                    <input
                      id="app-solution"
                      type="text"
                      className="multi-select-input"
                      value={searchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchQuery(val);
                        setIsDropdownOpen(true);
                        const match = solutions.find(
                          (s) => s.title.toLowerCase() === val.trim().toLowerCase()
                        );
                        if (match) {
                          setSelectedSolutionId(match.id);
                        } else {
                          setSelectedSolutionId('');
                        }
                      }}
                      onFocus={() => openSolutionDropdown()}
                      placeholder="Type to search solutions..."
                    />
                    <button
                      type="button"
                      className="custom-select-arrow-btn"
                      aria-label="Toggle options"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isDropdownOpen) setIsDropdownOpen(false);
                        else openSolutionDropdown();
                      }}
                    >
                      <span className="custom-select-arrow" style={{ margin: 0 }}></span>
                    </button>
                  </div>

                  {isDropdownOpen && solutionCoords && createPortal(
                    <div
                      className="custom-select-dropdown"
                      ref={solutionListRef}
                      style={{ position: 'fixed', top: solutionCoords.top, left: solutionCoords.left, width: solutionCoords.width, zIndex: 2000 }}
                    >
                      <div
                        className={`custom-select-option ${selectedSolutionId === '' ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSelectedSolutionId('');
                          setSearchQuery('');
                          setIsDropdownOpen(false);
                        }}
                      >
                        -- Select Solution Target --
                      </div>
                      {solutions
                        .filter((s) =>
                          s.title.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((s) => (
                          <div
                            key={s.id}
                            className={`custom-select-option ${selectedSolutionId === s.id ? 'is-selected' : ''}`}
                            onClick={() => {
                              setSelectedSolutionId(s.id);
                              setSearchQuery(s.title);
                              setIsDropdownOpen(false);
                            }}
                          >
                            {s.title}
                          </div>
                        ))}
                      {solutions.filter((s) =>
                        s.title.toLowerCase().includes(searchQuery.toLowerCase())
                      ).length === 0 && (
                        <div className="custom-select-option is-disabled" style={{ cursor: 'default' }}>
                          No matches found
                        </div>
                      )}
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            )}

            {showToggle && !proposeToSolution && (
              <>
                <div className="form-field">
                  <label>Architecture Designs (Required)</label>
                  <MultiSelect
                    id="app-arch"
                    options={architectures.map((arch) => ({ value: arch.id, label: arch.title }))}
                    selectedValues={selectedArchIds}
                    onChange={setSelectedArchIds}
                    placeholder="Search architecture designs…"
                    emptyText="No architectures available"
                  />
                </div>

                <div className="form-field">
                  <label>Infrastructure Stacks (Required)</label>
                  <MultiSelect
                    id="app-infra"
                    options={infrastructures.map((infra) => ({ value: infra.id, label: infra.title }))}
                    selectedValues={selectedInfraIds}
                    onChange={setSelectedInfraIds}
                    placeholder="Search infrastructure stacks…"
                    emptyText="No infrastructure available"
                  />
                </div>
              </>
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
