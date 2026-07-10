import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Infrastructure } from '../api/client';
import './TabStyles.css';

interface InfrastructureTabProps {
  searchQuery: string;
}

export function InfrastructureTab({ searchQuery }: InfrastructureTabProps) {
  const [infras, setInfras] = useState<Infrastructure[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadInfras = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getInfrastructures(searchQuery);
      setInfras(data);
      setError('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load infrastructures');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadInfras();
  }, [loadInfras]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      return;
    }
    try {
      await api.createInfrastructure({ title: title.trim(), description: description.trim() });
      setTitle('');
      setDescription('');
      loadInfras();
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
      <aside className="creation-panel">
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

      <section className="list-panel">
        {loading ? (
          <p className="status-text">Loading infrastructures...</p>
        ) : infras.length === 0 ? (
          <p className="status-text">No infrastructure cards found.</p>
        ) : (
          <div className="cards-grid">
            {infras.map((i) => (
              <article key={i.id} className="entity-card">
                <div className="card-header">
                  <h4>{i.title}</h4>
                  <span className="card-timestamp">
                    {new Date(i.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="card-desc">{i.description}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
