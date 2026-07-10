import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Architecture } from '../api/client';
import './TabStyles.css';

interface ArchitectureTabProps {
  searchQuery: string;
}

export function ArchitectureTab({ searchQuery }: ArchitectureTabProps) {
  const [archs, setArchs] = useState<Architecture[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadArchs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getArchitectures(searchQuery);
      setArchs(data);
      setError('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load architectures');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadArchs();
  }, [loadArchs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      return;
    }
    try {
      await api.createArchitecture({ title: title.trim(), description: description.trim() });
      setTitle('');
      setDescription('');
      loadArchs();
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
      <aside className="creation-panel">
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

      <section className="list-panel">
        {loading ? (
          <p className="status-text">Loading architectures...</p>
        ) : archs.length === 0 ? (
          <p className="status-text">No architecture cards found.</p>
        ) : (
          <div className="cards-grid">
            {archs.map((a) => (
              <article key={a.id} className="entity-card">
                <div className="card-header">
                  <h4>{a.title}</h4>
                  <span className="card-timestamp">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="card-desc">{a.description}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
