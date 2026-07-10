# Phase 4: Apps Tab Integration Plan
> 
**Goal:** Implement the Apps Tab UI in React allowing users to link functional prototypes to problems, lazy-load READMEs via the backend's GitHub API relay, and open live URLs.

**Architecture:** Frontend component makes API requests to the `/api/apps/` router. It supports lazy-loading of README documentation for specific apps to preserve GitHub API rate limits and optimize rendering speeds.

**Tech Stack:** React 18, TypeScript, Vanilla CSS.

---

### Task 1: Create AppsTab Component with Lazy README Loading
**Files:**
- `client/src/components/AppsTab.tsx` (Create)

- [x] Load and follow the `frontend-design` skill by using `view_file` on `C:\Users\Peter\..gemini\skills\frontend-design\SKILL.md` before implementing the component.
- [x] Create `client/src/components/AppsTab.tsx` featuring problem linking, URL validation, and a lazy-loading accordion/button for README contents. If a Live URL is provided, display a prominent "Launch App ↗" call-to-action button:
  ```tsx
  import { useState, useEffect } from 'react';
  import { api, AppPrototype, Problem } from '../api/client';

  interface Props {
    searchQuery: string;
  }

  export default function AppsTab({ searchQuery }: Props) {
    const [apps, setApps] = useState<AppPrototype[]>([]);
    const [problems, setProblems] = useState<Problem[]>([]);
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [githubUrl, setGithubUrl] = useState('');
    const [liveUrl, setLiveUrl] = useState('');
    const [selectedProblemId, setSelectedProblemId] = useState('');
    
    const [expandedReadmeAppId, setExpandedReadmeAppId] = useState<string | null>(null);
    const [readmeContent, setReadmeContent] = useState<string>('');
    const [readmeLoading, setReadmeLoading] = useState(false);
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const loadProblems = async () => {
      try {
        const pData = await api.getProblems();
        setProblems(pData);
      } catch (err: any) {
        setError('Failed to populate problems dropdown');
      }
    };

    const loadApps = async () => {
      try {
        setLoading(true);
        const data = await api.getApps(searchQuery);
        setApps(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load app cards');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      loadProblems();
    }, []);

    useEffect(() => {
      loadApps();
    }, [searchQuery]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title || !description || !githubUrl || !selectedProblemId) {
        setError('Title, Description, GitHub URL, and Problem Target are required fields.');
        return;
      }
      try {
        await api.createApp({
          title,
          description,
          github_url: githubUrl,
          live_url: liveUrl || undefined,
          problem_id: selectedProblemId,
        });
        setTitle('');
        setDescription('');
        setGithubUrl('');
        setLiveUrl('');
        setSelectedProblemId('');
        setError('');
        loadApps();
      } catch (err: any) {
        setError(err.message || 'Failed to add App card');
      }
    };

    const handleToggleReadme = async (appId: string, url: string) => {
      if (expandedReadmeAppId === appId) {
        // Collapse
        setExpandedReadmeAppId(null);
        setReadmeContent('');
        return;
      }

      try {
        setReadmeLoading(true);
        setExpandedReadmeAppId(appId);
        setReadmeContent('Fetching repository README documentation...');
        
        const data = await api.getReadme(url);
        setReadmeContent(data.readme_content);
      } catch (err: any) {
        setReadmeContent(err.message || 'Failed to retrieve README from GitHub API. Verify URL and token.');
      } finally {
        setReadmeLoading(false);
      }
    };

    return (
      <div className="tab-split-container">
        <aside className="creation-panel">
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
              <label htmlFor="app-problem">Problem Statement (1:1)</label>
              <select
                id="app-problem"
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

            <button type="submit" className="submit-btn">Create App Card</button>
          </form>
        </aside>

        <section className="list-panel">
          {loading ? (
            <p className="status-text">Loading app prototype mappings...</p>
          ) : apps.length === 0 ? (
            <p className="status-text">No apps mapped yet.</p>
          ) : (
            <div className="cards-grid">
              {apps.map((app) => (
                <article key={app.id} className="entity-card">
                  <div className="card-header">
                    <div>
                      <h4>{app.title}</h4>
                      {app.problem && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <span className="relation-tag solution-tag">For: {app.problem.title}</span>
                        </div>
                      )}
                    </div>
                    <span className="card-timestamp">{new Date(app.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="card-desc">{app.description}</p>
                  
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                    <button
                      onClick={() => handleToggleReadme(app.id, app.github_url)}
                      className="submit-btn"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
                    >
                      {expandedReadmeAppId === app.id ? 'Hide README' : 'Show README'}
                    </button>
                    {app.live_url && (
                      <a
                        href={app.live_url}
                        target="_blank"
                        rel="noreferrer"
                        className="submit-btn"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'var(--accent-blue)' }}
                      >
                        Launch App ↗
                      </a>
                    )}
                  </div>

                  {expandedReadmeAppId === app.id && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                      <h5>README.md Documentation</h5>
                      <pre style={{
                        marginTop: '0.5rem',
                        padding: '1rem',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.825rem',
                        fontFamily: 'monospace',
                        color: 'var(--text-secondary)'
                      }}>
                        {readmeContent}
                      </pre>
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
- [x] Commit AppsTab component:
  ```bash
  git add client/src/components/AppsTab.tsx
  git commit -m "feat: implement AppsTab component with README lazy loading and action items"
  ```

---

### Task 2: Mount Apps Tab into Core Page Layout
**Files:**
- `client/src/App.tsx` (Modify)

- [x] Modify `client/src/App.tsx` to replace the apps placeholder with the actual component:
  ```tsx
  // Insert import at the top
  import AppsTab from './components/AppsTab';
  
  // Replace the placeholder condition in main-content:
  // {activeTab === 'apps' && <div className="tab-view">...</div>}
  // With:
  // {activeTab === 'apps' && <AppsTab searchQuery={searchQuery} />}
  ```
- [x] Verify compiling and building without errors:
  ```bash
  cd client
  npm run build
  ```
- [x] Commit changes:
  ```bash
  git add client/src/App.tsx
  git commit -m "feat: link AppsTab page within core client routing shell"
  ```
