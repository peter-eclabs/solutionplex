# Phase 3: Frontend CRUD Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement CRUD screens and cards for Problems, Solutions, Architecture, and Infrastructure. Create reference-linking forms (1:1 problems dropdown, 1:N architectures/infrastructures checklist) and wire search inputs.

**Architecture:** Refinement of the tab layout. Individual tab components handle their own fetch state, mutation state, list renderings, side-by-side creation panel, and reactivity to parent search query props.

**Tech Stack:** React 18, TypeScript, Vanilla CSS.

---

### Task 1: Problems Tab Interface
**Files:**
- `client/src/components/ProblemsTab.tsx` (Create)
- `client/src/components/TabStyles.css` (Create)

- [ ] Load and follow the `frontend-design` skill by using `view_file` on `C:\Users\Peter\.gemini\skills\frontend-design\SKILL.md` before implementing the components.
- [ ] Create `client/src/components/ProblemsTab.tsx` with a two-column desktop split: creation form on the left, problem cards on the right. Card must display linked solutions if any exist:
  ```tsx
  import { useState, useEffect } from 'react';
  import { api, Problem } from '../api/client';
  import './TabStyles.css';

  interface Props {
    searchQuery: string;
  }

  export default function ProblemsTab({ searchQuery }: Props) {
    const [problems, setProblems] = useState<Problem[]>([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const loadProblems = async () => {
      try {
        setLoading(true);
        const data = await api.getProblems(searchQuery);
        setProblems(data);
        setError('');
      } catch (err: any) {
        setError(err.message || 'Failed to load problems');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      loadProblems();
    }, [searchQuery]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title || !description) return;
      try {
        await api.createProblem({ title, description });
        setTitle('');
        setDescription('');
        loadProblems();
      } catch (err: any) {
        setError(err.message || 'Failed to create problem');
      }
    };

    return (
      <div className="tab-split-container">
        <aside className="creation-panel">
          <h3>Register Problem</h3>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit} className="crud-form">
            <div className="form-field">
              <label htmlFor="prob-title">Title</label>
              <input
                id="prob-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Memory Leak in Session Cache"
              />
            </div>
            <div className="form-field">
              <label htmlFor="prob-desc">Description</label>
              <textarea
                id="prob-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Detailed description of the issue..."
                rows={4}
              />
            </div>
            <button type="submit" className="submit-btn">Create Problem Card</button>
          </form>
        </aside>

        <section className="list-panel">
          {loading ? (
            <p className="status-text">Loading problem entries...</p>
          ) : problems.length === 0 ? (
            <p className="status-text">No problem cards found.</p>
          ) : (
            <div className="cards-grid">
              {problems.map((p) => (
                <article key={p.id} className="entity-card">
                  <div className="card-header">
                    <h4>{p.title}</h4>
                    <span className="card-timestamp">{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="card-desc">{p.description}</p>
                  
                  {p.solutions && p.solutions.length > 0 && (
                    <div className="card-relations">
                      <h5>Proposed Solutions</h5>
                      <ul className="relation-list">
                        {p.solutions.map((s) => (
                          <li key={s.id} className="relation-tag solution-tag">
                            <span>{s.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }
  ```
- [ ] Create `client/src/components/TabStyles.css` to implement layout rules for the side-by-side panels:
  ```css
  .tab-split-container {
    display: flex;
    gap: 2.5rem;
    align-items: flex-start;
  }

  .creation-panel {
    flex: 0 0 320px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    position: sticky;
    top: 2rem;
  }

  .creation-panel h3 {
    margin-bottom: 1.25rem;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .crud-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-field label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-field input,
  .form-field textarea,
  .form-field select {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 0.625rem;
    font-size: 0.875rem;
    transition: var(--transition-smooth);
  }

  .form-field input:focus,
  .form-field textarea:focus,
  .form-field select:focus {
    border-color: var(--border-focus);
  }

  .submit-btn {
    background-color: var(--accent-blue);
    color: var(--text-primary);
    border: none;
    border-radius: var(--radius-md);
    padding: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-smooth);
    margin-top: 0.5rem;
  }

  .submit-btn:hover {
    background-color: var(--accent-blue-hover);
  }

  .list-panel {
    flex-grow: 1;
  }

  .cards-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .entity-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    transition: var(--transition-smooth);
  }

  .entity-card:hover {
    border-color: var(--border-hover);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }

  .card-header h4 {
    font-size: 1.125rem;
    font-weight: 600;
  }

  .card-timestamp {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .card-desc {
    font-size: 0.95rem;
    color: var(--text-secondary);
    margin-bottom: 1.25rem;
    white-space: pre-wrap;
  }

  .card-relations {
    border-top: 1px solid var(--border-subtle);
    padding-top: 1rem;
  }

  .card-relations h5 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }

  .relation-list {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .relation-tag {
    font-size: 0.75rem;
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    background-color: var(--bg-tertiary);
  }

  .solution-tag {
    color: var(--accent-green);
    border-color: rgba(16, 185, 129, 0.2);
  }

  .error-banner {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--accent-danger);
    color: var(--accent-danger);
    padding: 0.75rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
    font-size: 0.85rem;
  }

  .status-text {
    color: var(--text-secondary);
    text-align: center;
    padding: 3rem;
  }

  /* Multi-select checklist styles */
  .checkbox-select-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 120px;
    overflow-y: auto;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 0.5rem;
    background-color: var(--bg-primary);
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .checkbox-item input {
    cursor: pointer;
  }
  ```
- [ ] Commit Problems component:
  ```bash
  git add client/src/components/ProblemsTab.tsx client/src/components/TabStyles.css
  git commit -m "feat: implement ProblemsTab component with creation form and active card list"
  ```

---

### Task 2: Architecture and Infrastructure Tab Interfaces
**Files:**
- `client/src/components/ArchitectureTab.tsx` (Create)
- `client/src/components/InfrastructureTab.tsx` (Create)

- [ ] Create `client/src/components/ArchitectureTab.tsx` following the split layout:
  ```tsx
  import { useState, useEffect } from 'react';
  import { api, Architecture } from '../api/client';

  interface Props {
    searchQuery: string;
  }

  export default function ArchitectureTab({ searchQuery }: Props) {
    const [archs, setArchs] = useState<Architecture[]>([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const loadArchs = async () => {
      try {
        setLoading(true);
        const data = await api.getArchitectures(searchQuery);
        setArchs(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load architectures');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      loadArchs();
    }, [searchQuery]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title || !description) return;
      try {
        await api.createArchitecture({ title, description });
        setTitle('');
        setDescription('');
        loadArchs();
      } catch (err: any) {
        setError(err.message || 'Failed to create architecture');
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
            <button type="submit" className="submit-btn">Create Architecture Card</button>
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
                    <span className="card-timestamp">{new Date(a.created_at).toLocaleDateString()}</span>
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
  ```
- [ ] Create `client/src/components/InfrastructureTab.tsx` following the split layout:
  ```tsx
  import { useState, useEffect } from 'react';
  import { api, Infrastructure } from '../api/client';

  interface Props {
    searchQuery: string;
  }

  export default function InfrastructureTab({ searchQuery }: Props) {
    const [infras, setInfras] = useState<Infrastructure[]>([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const loadInfras = async () => {
      try {
        setLoading(true);
        const data = await api.getInfrastructures(searchQuery);
        setInfras(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load infrastructures');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      loadInfras();
    }, [searchQuery]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title || !description) return;
      try {
        await api.createInfrastructure({ title, description });
        setTitle('');
        setDescription('');
        loadInfras();
      } catch (err: any) {
        setError(err.message || 'Failed to create infrastructure');
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
            <button type="submit" className="submit-btn">Create Infrastructure Card</button>
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
                    <span className="card-timestamp">{new Date(i.created_at).toLocaleDateString()}</span>
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
  ```
- [ ] Commit components:
  ```bash
  git add client/src/components/ArchitectureTab.tsx client/src/components/InfrastructureTab.tsx
  git commit -m "feat: implement Architecture and Infrastructure tab pages"
  ```

---

### Task 3: Solutions Tab and Relationship Interceptor
**Files:**
- `client/src/components/SolutionsTab.tsx` (Create)

- [ ] Create `client/src/components/SolutionsTab.tsx` requiring a mandatory Problem selection and checklists for Architecture/Infrastructure tags:
  ```tsx
  import { useState, useEffect } from 'react';
  import { api, Solution, Problem, Architecture, Infrastructure } from '../api/client';

  interface Props {
    searchQuery: string;
  }

  export default function SolutionsTab({ searchQuery }: Props) {
    const [solutions, setSolutions] = useState<Solution[]>([]);
    const [problems, setProblems] = useState<Problem[]>([]);
    const [architectures, setArchitectures] = useState<Architecture[]>([]);
    const [infrastructures, setInfrastructures] = useState<Infrastructure[]>([]);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedProblemId, setSelectedProblemId] = useState('');
    const [selectedArchIds, setSelectedArchIds] = useState<string[]>([]);
    const [selectedInfraIds, setSelectedInfraIds] = useState<string[]>([]);
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const loadRelations = async () => {
      try {
        const [pData, aData, iData] = await Promise.all([
          api.getProblems(),
          api.getArchitectures(),
          api.getInfrastructures(),
        ]);
        setProblems(pData);
        setArchitectures(aData);
        setInfrastructures(iData);
      } catch (err: any) {
        setError('Failed to populate forms relation selectors');
      }
    };

    const loadSolutions = async () => {
      try {
        setLoading(true);
        const data = await api.getSolutions(searchQuery);
        setSolutions(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load solutions');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      loadRelations();
    }, []);

    useEffect(() => {
      loadSolutions();
    }, [searchQuery]);

    const handleArchCheckbox = (id: string, checked: boolean) => {
      if (checked) {
        setSelectedArchIds([...selectedArchIds, id]);
      } else {
        setSelectedArchIds(selectedArchIds.filter((item) => item !== id));
      }
    };

    const handleInfraCheckbox = (id: string, checked: boolean) => {
      if (checked) {
        setSelectedInfraIds([...selectedInfraIds, id]);
      } else {
        setSelectedInfraIds(selectedInfraIds.filter((item) => item !== id));
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title || !description || !selectedProblemId) {
        setError('Title, Description, and target Problem statement are required fields.');
        return;
      }
      try {
        await api.createSolution({
          title,
          description,
          problem_id: selectedProblemId,
          architecture_ids: selectedArchIds,
          infrastructure_ids: selectedInfraIds,
        });
        setTitle('');
        setDescription('');
        setSelectedProblemId('');
        setSelectedArchIds([]);
        setSelectedInfraIds([]);
        setError('');
        loadSolutions();
      } catch (err: any) {
        setError(err.message || 'Failed to submit solution mapping');
      }
    };

    return (
      <div className="tab-split-container">
        <aside className="creation-panel">
          <h3>Propose Solution</h3>
          {error && <div className="error-banner">{error}</div>}
          <form onSubmit={handleSubmit} className="crud-form">
            <div className="form-field">
              <label htmlFor="sol-title">Solution Title</label>
              <input
                id="sol-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Distributed Redis Session Store"
              />
            </div>
            
            <div className="form-field">
              <label htmlFor="sol-desc">Description</label>
              <textarea
                id="sol-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Technical architecture details..."
                rows={4}
              />
            </div>

            <div className="form-field">
              <label htmlFor="sol-problem">Problem Statement (1:1)</label>
              <select
                id="sol-problem"
                value={selectedProblemId}
                onChange={(e) => setSelectedProblemId(e.target.value)}
                required
              >
                <option value="">-- Select Problem Target --</option>
                {problems.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Architecture Designs (1:N)</label>
              <div className="checkbox-select-list">
                {architectures.map((arch) => (
                  <label key={arch.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedArchIds.includes(arch.id)}
                      onChange={(e) => handleArchCheckbox(arch.id, e.target.checked)}
                    />
                    {arch.title}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label>Infrastructure Stacks (1:N)</label>
              <div className="checkbox-select-list">
                {infrastructures.map((infra) => (
                  <label key={infra.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedInfraIds.includes(infra.id)}
                      onChange={(e) => handleInfraCheckbox(infra.id, e.target.checked)}
                    />
                    {infra.title}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="submit-btn">Propose Solution Card</button>
          </form>
        </aside>

        <section className="list-panel">
          {loading ? (
            <p className="status-text">Loading solution maps...</p>
          ) : solutions.length === 0 ? (
            <p className="status-text">No solutions mapped yet.</p>
          ) : (
            <div className="cards-grid">
              {solutions.map((s) => (
                <article key={s.id} className="entity-card">
                  <div className="card-header">
                    <h4>{s.title}</h4>
                    <span className="card-timestamp">{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="card-desc">{s.description}</p>
                  
                  <div className="card-relations">
                    {s.problem && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <h5>Addresses Problem</h5>
                        <span className="relation-tag" style={{ color: 'var(--text-primary)' }}>{s.problem.title}</span>
                      </div>
                    )}

                    {s.architectures.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <h5>Architectures Used</h5>
                        <div className="relation-list">
                          {s.architectures.map((a) => (
                            <span key={a.id} className="relation-tag">{a.title}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {s.infrastructures.length > 0 && (
                      <div>
                        <h5>Infrastructure Deployed</h5>
                        <div className="relation-list">
                          {s.infrastructures.map((i) => (
                            <span key={i.id} className="relation-tag">{i.title}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }
  ```
- [ ] Commit Solutions tab:
  ```bash
  git add client/src/components/SolutionsTab.tsx
  git commit -m "feat: implement SolutionsTab linking problems, architectures, and infrastructure"
  ```

---

### Task 4: Integration with Core Shell Layout
**Files:**
- `client/src/App.tsx` (Modify)

- [ ] Modify `client/src/App.tsx` to import and switch between tab components:
  ```tsx
  import { useState } from 'react';
  import './App.css';
  import ProblemsTab from './components/ProblemsTab';
  import SolutionsTab from './components/SolutionsTab';
  import ArchitectureTab from './components/ArchitectureTab';
  import InfrastructureTab from './components/InfrastructureTab';
  import AppsTabPlaceholder from './components/AppsTabPlaceholder'; // Created in next phase

  type Tab = 'problems' | 'solutions' | 'architecture' | 'infrastructure' | 'apps';

  export default function App() {
    const [activeTab, setActiveTab] = useState<Tab>('problems');
    const [searchQuery, setSearchQuery] = useState('');

    const tabs: { id: Tab; label: string }[] = [
      { id: 'problems', label: 'Problems' },
      { id: 'solutions', label: 'Solutions' },
      { id: 'architecture', label: 'Architecture' },
      { id: 'infrastructure', label: 'Infrastructure' },
      { id: 'apps', label: 'Apps' },
    ];

    const handleTabChange = (tabId: Tab) => {
      setActiveTab(tabId);
      setSearchQuery('');
    };

    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo-group">
            <span className="logo-icon">⎔</span>
            <h1>Solutionplex</h1>
            <span className="badge">MVP</span>
          </div>

          <div className="search-group">
            <input
              type="text"
              placeholder={`Search ${tabs.find(t => t.id === activeTab)?.label}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </header>

        <nav className="tab-navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="main-content">
          {activeTab === 'problems' && <ProblemsTab searchQuery={searchQuery} />}
          {activeTab === 'solutions' && <SolutionsTab searchQuery={searchQuery} />}
          {activeTab === 'architecture' && <ArchitectureTab searchQuery={searchQuery} />}
          {activeTab === 'infrastructure' && <InfrastructureTab searchQuery={searchQuery} />}
          {activeTab === 'apps' && <div className="tab-view"><h2>Apps Section</h2><p>Apps tab coming in Phase 04...</p></div>}
        </main>
      </div>
    );
  }
  ```
- [ ] Run client build to verify compilation:
  ```bash
  cd client
  npm run build
  ```
- [ ] Commit shell integration:
  ```bash
  git add client/src/App.tsx
  git commit -m "feat: integrate Problem, Solution, Architecture, and Infrastructure tabs into layout shell"
  ```
