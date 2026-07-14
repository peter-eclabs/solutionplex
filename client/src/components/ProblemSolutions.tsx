import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Solution, Architecture, Infrastructure } from '../api/client';
import { MultiSelect } from './MultiSelect';
import { DeleteButton } from './DeleteButton';
import { LabelPreview } from './LabelPreview';
import { CharCounter } from './CharCounter';
import { formatCreatedOn } from './formatCreatedOn';
import { Can } from '../auth/Can';
import { useRole } from '../auth/AuthContext';
import { HiddenBadge } from './HiddenBadge';
import './TabStyles.css';

interface ProblemSolutionsProps {
  problemId: string;
  problemTitle: string;
  solutions: Solution[];
  onChanged: () => void;
  onNavigate: (path: string) => void;
}

export function ProblemSolutions({
  problemId,
  problemTitle,
  solutions,
  onChanged,
  onNavigate,
}: ProblemSolutionsProps) {
  const { canWrite } = useRole();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedArchIds, setSelectedArchIds] = useState<string[]>([]);
  const [selectedInfraIds, setSelectedInfraIds] = useState<string[]>([]);
  const [architectures, setArchitectures] = useState<Architecture[]>([]);
  const [infrastructures, setInfrastructures] = useState<Infrastructure[]>([]);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const loadRelations = useCallback(async () => {
    try {
      const [aData, iData] = await Promise.all([
        api.getArchitectures(),
        api.getInfrastructures(),
      ]);
      setArchitectures(aData);
      setInfrastructures(iData);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(`Failed to populate relation selectors: ${err.message}`);
      } else {
        setError('Failed to populate relation selectors');
      }
    }
  }, []);

  useEffect(() => {
    if (isFormOpen) {
      loadRelations();
    }
  }, [isFormOpen, loadRelations]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedArchIds([]);
    setSelectedInfraIds([]);
    setError('');
  };

  const openForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Title and Description are required fields.');
      return;
    }
    if (selectedArchIds.length === 0 || selectedInfraIds.length === 0) {
      setError('Architecture Designs and Infrastructure Stacks are required.');
      return;
    }
    try {
      await api.createSolution({
        title: title.trim(),
        description: description.trim(),
        problem_id: problemId,
        architecture_ids: selectedArchIds,
        infrastructure_ids: selectedInfraIds,
      });
      setIsFormOpen(false);
      resetForm();
      onChanged();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to submit solution mapping');
      }
    }
  };

  return (
    <div className="problem-solutions-section" onClick={(e) => e.stopPropagation()}>
      <div className="problem-solutions-header">
        <span className="problem-solutions-label">
          Solutions ({solutions.length})
        </span>
        <Can action="write">
          <button
            type="button"
            className="propose-solution-btn"
            onClick={openForm}
          >
            + Propose Solution
          </button>
        </Can>
      </div>

      {solutions.length === 0 ? (
        <p className="problem-solutions-empty">
          No solutions proposed yet for this problem.
        </p>
      ) : (
        <ul className="problem-solutions-list">
          {solutions.map((s) => (
            <li key={s.id} className="problem-solution-item">
              <DeleteButton
                entityLabel="Solution"
                onDelete={() => api.deleteSolution(s.id)}
                onDeleted={onChanged}
              />
              <button
                type="button"
                className="problem-solution-link"
                onClick={() => onNavigate(`/solutions/${s.id}`)}
              >
                <span className="problem-solution-title">{s.title}</span>
                {s.hidden && <HiddenBadge />}
                <span className="problem-solution-created">
                  {formatCreatedOn(s.created_at)}
                </span>
                <span className="problem-solution-tags">
                  <LabelPreview
                    architectures={
                      s.effective_architectures ?? s.architectures ?? []
                    }
                    infrastructures={
                      s.effective_infrastructures ?? s.infrastructures ?? []
                    }
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

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
              <h3>Propose Solution</h3>
              <p className="form-context-note">
                Targeting problem: <strong>{problemTitle}</strong>
              </p>
              {error && <div className="error-banner">{error}</div>}
              <form onSubmit={handleSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="psol-title">Solution Title</label>
                  <input
                    id="psol-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={100}
                    placeholder="e.g. Distributed Redis Session Store"
                  />
                  <CharCounter value={title} max={100} />
                </div>

                <div className="form-field">
                  <label htmlFor="psol-desc">Description</label>
                  <textarea
                    id="psol-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Technical architecture details..."
                    rows={4}
                  />
                </div>

                <div className="form-field">
                  <label>Architecture Designs (required)</label>
                  <MultiSelect
                    id="psol-arch"
                    options={architectures.map((arch) => ({ value: arch.id, label: arch.title }))}
                    selectedValues={selectedArchIds}
                    onChange={setSelectedArchIds}
                    placeholder="Search architecture designs…"
                    emptyText="No architectures available"
                  />
                </div>

                <div className="form-field">
                  <label>Infrastructure Stacks (required)</label>
                  <MultiSelect
                    id="psol-infra"
                    options={infrastructures.map((infra) => ({ value: infra.id, label: infra.title }))}
                    selectedValues={selectedInfraIds}
                    onChange={setSelectedInfraIds}
                    placeholder="Search infrastructure stacks…"
                    emptyText="No infrastructure available"
                  />
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={
                    !title.trim() ||
                    !description.trim() ||
                    selectedArchIds.length === 0 ||
                    selectedInfraIds.length === 0
                  }
                >
                  Propose Solution Card
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
