# Solution Link Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed a "Prototypes" section in the Solution detail view that lets users create a new prototype pre-linked to the solution, link an existing prototype, and remove a linked prototype (Unlink or Delete).

**Architecture:** Frontend-only feature. A new `SolutionPrototypes.tsx` component mirrors `ProblemSolutions.tsx`, embedded in `DetailView` for `component === 'solutions'`. All data operations reuse existing API client methods (`createApp`, `updateApp`, `deleteApp`); no backend changes. Refresh is handled by invalidating `['solutions', solutionId]`.

**Tech Stack:** React 19 + TypeScript (strict), `@tanstack/react-query`, Vite, `oxlint`. Client has **no test runner**, so verification is via `npm run build` (tsc type-check) + `npm run lint` + manual E2E checklist (documented in Task 5).

---

## File Structure

- **Create:** `client/src/components/SolutionPrototypes.tsx` — the embedded prototypes section (list + create modal + link modal + remove control).
- **Modify:** `client/src/components/DetailView.tsx` — import `SolutionPrototypes` and render it in the `solutions` viewer branch, passing `solutionData.apps` and an `onChanged` that invalidates `['solutions', solutionData.id]`.
- **Modify:** `client/src/components/TabStyles.css` — add a small set of styles for the prototypes header actions and the remove (Unlink/Delete) control.

No server files are touched. The existing endpoints already support every operation:
- `POST /api/apps/` with `solution_id` (create, `server/services/apps.py:16`)
- `PUT /api/apps/{id}` with `solution_id` (link; empty string clears → `None`, `server/services/apps.py:104`)
- `DELETE /api/apps/{id}` (delete)
- `SolutionResponse.apps` populated server-side (`server/services/solutions.py:83`)

---

### Task 1: Create the `SolutionPrototypes` component (scaffold, list, create modal)

**Files:**
- Create: `client/src/components/SolutionPrototypes.tsx`

This task delivers the component shell: prop types, the linked list, and the **Create Prototype** modal (prefilled `solution_id`). The Link modal and remove control are added in Tasks 2–3 but the component compiles and is structurally complete with list + create here.

- [ ] **Step 1: Write the component file**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { AppShort, AppPrototype } from '../api/client';
import { CustomSelect } from './CustomSelect';
import './TabStyles.css';

interface SolutionPrototypesProps {
  solutionId: string;
  solutionTitle: string;
  apps: AppShort[];
  onChanged: () => void;
  onNavigate: (path: string) => void;
}

export function SolutionPrototypes({
  solutionId,
  solutionTitle,
  apps,
  onChanged,
  onNavigate,
}: SolutionPrototypesProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [error, setError] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [linkableApps, setLinkableApps] = useState<AppPrototype[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isLinkOpen, setIsLinkOpen] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadLinkable = useCallback(async () => {
    try {
      const all = await api.getApps();
      setLinkableApps(all.filter((a) => a.solution?.id !== solutionId));
    } catch (err: unknown) {
      if (err instanceof Error) setLinkError(`Failed to load prototypes: ${err.message}`);
      else setLinkError('Failed to load prototypes');
    }
  }, [solutionId]);

  useEffect(() => {
    if (isLinkOpen) {
      setSelectedLinkId('');
      setLinkError('');
      loadLinkable();
    }
  }, [isLinkOpen, loadLinkable]);

  const resetCreate = () => {
    setTitle('');
    setDescription('');
    setGithubUrl('');
    setLiveUrl('');
    setError('');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
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
        solution_id: solutionId,
      });
      setIsCreateOpen(false);
      resetCreate();
      onChanged();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to create prototype');
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLinkId) {
      setLinkError('Select a prototype to link.');
      return;
    }
    try {
      await api.updateApp(selectedLinkId, { solution_id: solutionId });
      setIsLinkOpen(false);
      onChanged();
    } catch (err: unknown) {
      if (err instanceof Error) setLinkError(err.message);
      else setLinkError('Failed to link prototype');
    }
  };

  const handleUnlink = async (appId: string) => {
    try {
      await api.updateApp(appId, { solution_id: '' });
      setRemovingId(null);
      onChanged();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  const handleDelete = async (appId: string) => {
    try {
      await api.deleteApp(appId);
      setRemovingId(null);
      onChanged();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  return (
    <div className="solution-prototypes-section" onClick={(e) => e.stopPropagation()}>
      <div className="problem-solutions-header">
        <span className="solution-prototypes-label">Prototypes ({apps.length})</span>
        <div className="solution-prototypes-actions">
          <button
            type="button"
            className="propose-solution-btn"
            onClick={() => {
              resetCreate();
              setIsCreateOpen(true);
            }}
          >
            + Create Prototype
          </button>
          <button
            type="button"
            className="propose-solution-btn"
            onClick={() => setIsLinkOpen(true)}
          >
            + Link Existing
          </button>
        </div>
      </div>

      {apps.length === 0 ? (
        <p className="problem-solutions-empty">No prototypes linked to this solution yet.</p>
      ) : (
        <ul className="problem-solutions-list">
          {apps.map((app) => (
            <li key={app.id} className="problem-solution-item solution-prototype-item">
              <button
                type="button"
                className="problem-solution-link"
                onClick={() => onNavigate(`/apps/${app.id}`)}
              >
                <span className="problem-solution-title">{app.title}</span>
              </button>
              {removingId === app.id ? (
                <div className="prototype-remove-menu">
                  <button
                    type="button"
                    className="prototype-unlink-btn"
                    onClick={() => handleUnlink(app.id)}
                  >
                    Unlink
                  </button>
                  <button
                    type="button"
                    className="prototype-delete-btn"
                    onClick={() => handleDelete(app.id)}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="prototype-cancel-btn"
                    onClick={() => setRemovingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="prototype-remove-trigger"
                  aria-label={`Remove ${app.title}`}
                  onClick={() => setRemovingId(app.id)}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <aside className="creation-panel">
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsCreateOpen(false)}
                aria-label="Close form"
              >
                &times;
              </button>
              <h3>Create Prototype</h3>
              <p className="form-context-note">
                Targeting solution: <strong>{solutionTitle}</strong>
              </p>
              {error && <div className="error-banner">{error}</div>}
              <form onSubmit={handleCreateSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="sp-title">Prototype Name</label>
                  <input
                    id="sp-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Cache Monitor Admin"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="sp-desc">Description</label>
                  <textarea
                    id="sp-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={4}
                    placeholder="Core features and target users..."
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="sp-github">GitHub Repository URL (Required)</label>
                  <input
                    id="sp-github"
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    required
                    placeholder="https://github.com/owner/repo"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="sp-live">Live Deployed URL (Optional)</label>
                  <input
                    id="sp-live"
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
                  Create Prototype Card
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}

      {isLinkOpen && (
        <div className="modal-overlay" onClick={() => setIsLinkOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <aside className="creation-panel">
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsLinkOpen(false)}
                aria-label="Close form"
              >
                &times;
              </button>
              <h3>Link Existing Prototype</h3>
              <p className="form-context-note">
                Targeting solution: <strong>{solutionTitle}</strong>
              </p>
              {linkError && <div className="error-banner">{linkError}</div>}
              <form onSubmit={handleLinkSubmit} className="crud-form">
                <div className="form-field">
                  <label htmlFor="sp-link">Select Prototype</label>
                  <CustomSelect
                    id="sp-link"
                    value={selectedLinkId}
                    onChange={setSelectedLinkId}
                    options={linkableApps.map((a) => ({ value: a.id, label: a.title }))}
                    placeholder="-- Select Prototype --"
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={!selectedLinkId}>
                  Link Prototype
                </button>
              </form>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check the new file in isolation**

Run: `cd client && npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS (the file is self-contained valid TS; `CustomSelect` and `api` types already exist). Note: importing it into `DetailView` happens in Task 3, so a full build before then will not reference it yet — this step confirms the file itself is type-safe.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/SolutionPrototypes.tsx
git commit -m "feat: add SolutionPrototypes component (create + link + remove)"
```

---

### Task 2: Wire `SolutionPrototypes` into `DetailView`

**Files:**
- Modify: `client/src/components/DetailView.tsx`

- [ ] **Step 1: Add the import**

In `DetailView.tsx`, add `SolutionPrototypes` to the existing import line that brings in `ProblemSolutions`:

```tsx
import { ProblemSolutions } from './ProblemSolutions';
import { SolutionPrototypes } from './SolutionPrototypes';
```

- [ ] **Step 2: Render the section in the `solutions` viewer branch**

Inside the `viewer-body` div, immediately after the `component === 'solutions'` Plex Visualizer block (the one ending around the `</div>` that closes the `card-visualizer-section` for solutions), add:

```tsx
{component === 'solutions' && solutionData && (
  <SolutionPrototypes
    solutionId={solutionData.id}
    solutionTitle={solutionData.title}
    apps={solutionData.apps}
    onChanged={() => queryClient.invalidateQueries({ queryKey: ['solutions', solutionData.id] })}
    onNavigate={onNavigate}
  />
)}
```

- [ ] **Step 3: Build the client**

Run: `cd client && npm run build`
Expected: PASS (tsc + vite build succeed with no type errors).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/DetailView.tsx
git commit -m "feat: embed SolutionPrototypes section in Solution detail view"
```

---

### Task 3: Add styles for the prototypes header and remove control

**Files:**
- Modify: `client/src/components/TabStyles.css`

Add the following rules at the end of the file (reusing existing variables/classes; only the new names introduced by the component are defined here).

- [ ] **Step 1: Append styles**

```css
.solution-prototypes-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--border-grid);
  cursor: default;
}

.solution-prototypes-label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-cyan);
}

.solution-prototypes-actions {
  display: flex;
  gap: 0.5rem;
}

.solution-prototype-item {
  border-left: 3px solid var(--accent-cyan);
}

.prototype-remove-trigger {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: transparent;
  border: 1px solid var(--border-grid);
  color: var(--text-muted);
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  cursor: pointer;
  line-height: 1;
  font-size: 0.7rem;
  transition: var(--transition-smooth);
}

.prototype-remove-trigger:hover {
  border-color: var(--accent-problem);
  color: var(--accent-problem);
}

.prototype-remove-menu {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  display: flex;
  gap: 0.35rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-grid);
  padding: 0.3rem;
  border-radius: 4px;
}

.prototype-unlink-btn,
.prototype-delete-btn,
.prototype-cancel-btn {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.25rem 0.45rem;
  cursor: pointer;
  border: 1px solid var(--border-grid);
  background: transparent;
}

.prototype-unlink-btn {
  color: var(--accent-cyan);
  border-color: var(--accent-cyan);
}

.prototype-delete-btn {
  color: var(--accent-problem);
  border-color: var(--accent-problem);
}

.prototype-cancel-btn {
  color: var(--text-muted);
}
```

- [ ] **Step 2: Lint the client**

Run: `cd client && npm run lint`
Expected: PASS (no lint errors in the new CSS; oxlint covers TS/TSX).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/TabStyles.css
git commit -m "style: add styles for SolutionPrototypes section and remove control"
```

---

### Task 4: Final build + lint verification

**Files:** (none new)

- [ ] **Step 1: Full client build**

Run: `cd client && npm run build`
Expected: PASS (tsc -b && vite build complete, exit 0).

- [ ] **Step 2: Lint**

Run: `cd client && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit (only if any fix was needed)**

```bash
git add -A
git commit -m "fix: resolve build/lint issues for SolutionPrototypes feature"
```
(If no fix was required, skip this commit.)

---

### Task 5: Manual E2E verification checklist

**Files:** (none; manual UI check against a running dev stack)

Run the dev servers:
- Server: `cd server && uv run uvicorn main:app --reload --port 8000`
- Client: `cd client && npm run dev`

Then verify each acceptance criterion from the spec:

- [ ] Open a **Solution** detail view → a "Prototypes (N)" section appears below the Plex Visualizer.
- [ ] Click **+ Create Prototype** → modal opens pre-targeting the solution → submit with Title/Description/GitHub URL → new card appears in the list; opening it navigates to the App detail which shows the linked Solution and derived Problem.
- [ ] Click **+ Link Existing** → modal lists only prototypes NOT already linked to this solution → select one and Link → it appears in the list.
- [ ] Click the ✕ on a linked item → menu shows **Unlink / Delete / Cancel** → **Unlink** keeps the app in the Apps tab but removes it from this solution's list → **Delete** removes the app entirely.
- [ ] After every action the list refreshes immediately (no manual reload).
- [ ] `npm run build` and `npm run lint` remain clean.
