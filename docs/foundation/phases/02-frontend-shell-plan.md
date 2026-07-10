# Phase 2: Frontend Shell Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the Vite React TypeScript client project, establish the CSS custom properties-based dark theme, set up the layout shell with tab state and active search inputs, and create the base API client.

**Architecture:** A standalone React single-page app containing an API client module for standard fetch HTTP calls to the backend, dynamic state-based routing for tab modules, and centralized CSS styling.

**Tech Stack:** React 18, Vite, TypeScript, Vanilla CSS (custom properties).

---

### Task 1: Scaffold Vite Client Project
**Files:**
- `client/` (Create folder and scaffold files)

- [ ] Create `client/` directory and initialize using Vite React TS template:
  ```bash
  npm create vite@latest client -- --template react-ts
  ```
- [ ] Install dependencies inside `client/`:
  ```bash
  cd client
  npm install
  ```
- [ ] Verify the development environment starts and builds successfully:
  ```bash
  npm run build
  ```
- [ ] Commit scaffolding:
  ```bash
  git add client/
  git commit -m "chore: scaffold Vite React TypeScript client"
  ```

---

### Task 2: Create CSS Premium Dark Design System
**Files:**
- `client/index.html` (Modify)
- `client/src/index.css` (Modify)

- [ ] Modify `client/index.html` to load the Google Font `Inter` in the `<head>`:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ```
- [ ] Load and follow the `frontend-design` skill by using `view_file` on `C:\Users\Peter\.gemini\skills\frontend-design\SKILL.md` before proceeding to implement the stylesheet.
- [ ] Write the global design tokens and styles in `client/src/index.css` based on a refined Slate/Graphite dark theme. Do NOT use standard bright cyan/synthwave colors. Use subtle borders, rich dark fills, smooth transitions, and high-fidelity typography.
  ```css
  :root {
    --bg-primary: #090d16;
    --bg-secondary: #111827;
    --bg-tertiary: #1f2937;
    --border-subtle: #242f41;
    --border-hover: #374151;
    --border-focus: #3b82f6;
    
    --text-primary: #f3f4f6;
    --text-secondary: #9ca3af;
    --text-muted: #6b7280;
    
    --accent-blue: #3b82f6;
    --accent-blue-hover: #2563eb;
    --accent-green: #10b981;
    --accent-danger: #ef4444;
    
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --transition-smooth: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-sans);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  input, select, textarea, button {
    font-family: inherit;
    color: inherit;
  }

  /* Custom styling for focus states */
  *:focus-visible {
    outline: 2px solid var(--border-focus);
    outline-offset: 2px;
  }
  ```
- [ ] Commit CSS tokens and rules:
  ```bash
  git add client/index.html client/src/index.css
  git commit -m "style: establish premium slate dark theme variables and base css styling"
  ```

---

### Task 3: Base API Client Module
**Files:**
- `client/src/api/client.ts` (Create)

- [ ] Create API response types and generic fetch client in `client/src/api/client.ts`. Define type structures mapped directly to backend schemas:
  ```typescript
  export interface ProblemShort {
    id: string;
    title: string;
  }

  export interface SolutionShort {
    id: string;
    title: string;
  }

  export interface ArchitectureShort {
    id: string;
    title: string;
  }

  export interface InfrastructureShort {
    id: string;
    title: string;
  }

  export interface Problem {
    id: string;
    title: string;
    description: string;
    solutions: SolutionShort[];
    created_at: string;
    updated_at: string;
  }

  export interface Architecture {
    id: string;
    title: string;
    description: string;
    created_at: string;
    updated_at: string;
  }

  export interface Infrastructure {
    id: string;
    title: string;
    description: string;
    created_at: string;
    updated_at: string;
  }

  export interface Solution {
    id: string;
    title: string;
    description: string;
    problem: ProblemShort | null;
    architectures: ArchitectureShort[];
    infrastructures: InfrastructureShort[];
    created_at: string;
    updated_at: string;
  }

  export interface AppPrototype {
    id: string;
    title: string;
    description: string;
    github_url: string;
    live_url?: string;
    problem: ProblemShort | null;
    created_at: string;
    updated_at: string;
  }

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(errorMsg || `API request failed with status ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  export const api = {
    // Problem endpoints
    getProblems: (q?: string) => request<Problem[]>(`/api/problems/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    createProblem: (data: { title: string; description: string }) => 
      request<Problem>('/api/problems/', { method: 'POST', body: JSON.stringify(data) }),

    // Architecture endpoints
    getArchitectures: (q?: string) => request<Architecture[]>(`/api/architectures/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    createArchitecture: (data: { title: string; description: string }) => 
      request<Architecture>('/api/architectures/', { method: 'POST', body: JSON.stringify(data) }),

    // Infrastructure endpoints
    getInfrastructures: (q?: string) => request<Infrastructure[]>(`/api/infrastructures/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    createInfrastructure: (data: { title: string; description: string }) => 
      request<Infrastructure>('/api/infrastructures/', { method: 'POST', body: JSON.stringify(data) }),

    // Solution endpoints
    getSolutions: (q?: string) => request<Solution[]>(`/api/solutions/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    createSolution: (data: { title: string; description: string; problem_id: string; architecture_ids: string[]; infrastructure_ids: string[] }) => 
      request<Solution>('/api/solutions/', { method: 'POST', body: JSON.stringify(data) }),

    // App endpoints
    getApps: (q?: string) => request<AppPrototype[]>(`/api/apps/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    createApp: (data: { title: string; description: string; github_url: string; live_url?: string; problem_id: string }) => 
      request<AppPrototype>('/api/apps/', { method: 'POST', body: JSON.stringify(data) }),
    getReadme: (githubUrl: string) => request<{ readme_content: string }>(`/api/apps/readme?github_url=${encodeURIComponent(githubUrl)}`),
  };
  ```
- [ ] Commit API module:
  ```bash
  git add client/src/api/client.ts
  git commit -m "feat: implement frontend API client wrapper with types"
  ```

---

### Task 4: Layout Shell and Tab Control Interface
**Files:**
- `client/src/App.tsx` (Modify)

- [ ] Load and follow the `frontend-design` skill by using `view_file` on `C:\Users\Peter\.gemini\skills\frontend-design\SKILL.md` before implementing the shell component.
- [ ] Replace `client/src/App.tsx` with layout containing logo header, active tab state, scoped search input, and skeleton sections for each tab view:
  ```tsx
  import { useState } from 'react';
  import './App.css';

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
      setSearchQuery(''); // Reset search when switching tabs
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
          {activeTab === 'problems' && <div className="tab-view"><h2>Problems Section</h2><p>Pending implementation...</p></div>}
          {activeTab === 'solutions' && <div className="tab-view"><h2>Solutions Section</h2><p>Pending implementation...</p></div>}
          {activeTab === 'architecture' && <div className="tab-view"><h2>Architecture Section</h2><p>Pending implementation...</p></div>}
          {activeTab === 'infrastructure' && <div className="tab-view"><h2>Infrastructure Section</h2><p>Pending implementation...</p></div>}
          {activeTab === 'apps' && <div className="tab-view"><h2>Apps Section</h2><p>Pending implementation...</p></div>}
        </main>
      </div>
    );
  }
  ```
- [ ] Create `client/src/App.css` to style the shell container, headers, and tabs:
  ```css
  .app-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 1.5rem;
  }

  .logo-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .logo-icon {
    font-size: 1.75rem;
    color: var(--accent-blue);
  }

  .logo-group h1 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.025em;
  }

  .badge {
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
  }

  .search-group {
    flex: 0 1 350px;
  }

  .search-input {
    width: 100%;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    transition: var(--transition-smooth);
  }

  .search-input:focus {
    border-color: var(--border-focus);
    background-color: var(--bg-primary);
  }

  .tab-navigation {
    display: flex;
    gap: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 2rem;
  }

  .tab-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.75rem 1.25rem;
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-secondary);
    border-radius: var(--radius-md);
    transition: var(--transition-smooth);
  }

  .tab-btn:hover {
    color: var(--text-primary);
    background-color: var(--bg-secondary);
  }

  .tab-btn.active {
    color: var(--text-primary);
    background-color: var(--bg-tertiary);
    box-shadow: inset 0 -2px 0 var(--accent-blue);
  }

  .main-content {
    flex-grow: 1;
  }

  .tab-view {
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  ```
- [ ] Run client build to verify compilation:
  ```bash
  cd client
  npm run build
  ```
- [ ] Commit layout changes:
  ```bash
  git add client/src/App.tsx client/src/App.css
  git commit -m "feat: design layout shell, tab navigation, and search input layout"
  ```
