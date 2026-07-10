# Design: Link / Create Prototypes Inside the Solution Card

**Date:** 2026-07-10
**Status:** Approved (design)
**Feature area:** Frontend — Solution detail view (client only, no backend changes)

## 1. Background

The product (Solutionplex) models a Plex of relationships: Problem → Solution (1:N),
Solution → Architecture/Infrastructure (1:N), and Solution → App/Prototype (1:N).

Today the **Problem detail view** embeds a `ProblemSolutions` component that lets a user
create a new Solution pre-linked to that problem, and lists the linked solutions with
per-item delete. The user wants the equivalent capability inside the **Solution detail
view**: an embedded section to create AND/OR link a prototype (App) to the current
solution, mirroring the Problems → Solutions interaction.

## 2. Goals

- Embed a "Prototypes" section in the Solution detail view.
- Let the user **create** a new prototype pre-linked to the current solution.
- Let the user **link** an existing prototype (already in the Apps tab) to the solution.
- Let the user **remove** a linked prototype, choosing to **Unlink** (keep app) or
  **Delete** (remove app entirely).

## 3. Non-Goals

- No changes to the Apps tab grid, the Solutions tab grid, or the App detail view.
- No new backend endpoints or schema changes — all behavior is covered by existing APIs.
- No changes to the Problems → Solutions relationship behavior.

## 4. Placement

Mirroring `ProblemSolutions`, the new section lives in `DetailView` (`client/src/components/DetailView.tsx`)
in the non-editing viewer area, when `component === 'solutions' && solutionData` is set.
It renders alongside the existing Plex Visualizer section (i.e. immediately after it),
not on the grid cards in the Solutions tab.

## 5. New Component: `SolutionPrototypes.tsx`

A new file `client/src/components/SolutionPrototypes.tsx`, structurally analogous to
`ProblemSolutions.tsx`.

### 5.1 Props

```ts
interface SolutionPrototypesProps {
  solutionId: string;
  solutionTitle: string;
  apps: AppShort[];          // linked prototypes from the solution payload
  onChanged: () => void;     // invalidate ['solutions', solutionId]
  onNavigate: (path: string) => void;
}
```

### 5.2 Linked list

- Renders `apps` as a list of items, each showing title + description preview.
- Each item is clickable → `onNavigate('/apps/' + app.id)`.
- Each item has a remove control that opens a small confirm prompt with two choices:
  - **Unlink**: calls `api.updateApp(app.id, { solution_id: '' })` — clears linkage,
    app remains in the Apps tab. (Empty string is falsy server-side, so `update_app`
    sets `solution_id` to `None`; see `server/services/apps.py:104`.)
  - **Delete**: calls `api.deleteApp(app.id)` — removes the prototype entirely.

### 5.3 Create Prototype

- Button `+ Create Prototype` opens a modal with the same fields used by the App tab
  form (`client/src/components/AppsTab.tsx`): Title, Description, GitHub URL (required),
  Live URL (optional).
- On submit, calls `api.createApp({ title, description, github_url, live_url?, solution_id: solutionId })`.
- The app's Problem is derived automatically server-side from the solution's problem
  (`server/services/apps.py:48`), so it appears correctly in the Apps tab and App detail.

### 5.4 Link Existing Prototype

- Button `+ Link Existing` (or a toggle within the same modal area) opens a selector
  populated from `api.getApps()`.
- Filter out apps whose `solution?.id === solutionId` (already linked).
- Selecting an app calls `api.updateApp(app.id, { solution_id: solutionId })` to attach it.

### 5.5 Refresh

After create / link / unlink / delete, call `onChanged()` which invalidates
`['solutions', solutionId]` so `getSolution` re-fetches and the list updates — same
pattern `ProblemSolutions.onChanged` uses for `['problems', ...]`.

## 6. Backend Reuse (no changes required)

| Need | Existing support |
|------|------------------|
| Create prototype linked to solution | `POST /api/apps/` with `solution_id` — `server/routers/apps.py:20`, `server/services/apps.py:16` |
| Link existing prototype | `PUT /api/apps/{id}` with `solution_id` — `server/services/apps.py:93` |
| Unlink prototype | `PUT /api/apps/{id}` with empty `solution_id` → sets `None` |
| List linked prototypes on solution | `SolutionResponse.apps` populated in `server/services/solutions.py:83` |
| Delete prototype | `DELETE /api/apps/{id}` — `server/routers/apps.py:137` |

## 7. Testing

- Frontend behavior mirrors `ProblemSolutions`; verify the section renders, create flow
  pre-links the solution, link-existing attaches an unlinked app, unlink clears linkage
  while delete removes the card, and the list refreshes after each action.
- Optional: a small unit/component test or manual E2E through the UI.
- Confirm `uv run pyright` stays clean on the client (no type regressions) and the
  dev server runs.

## 8. Acceptance Criteria

1. Opening a Solution detail view shows a "Prototypes (N)" section.
2. "+ Create Prototype" creates an app that is linked to the solution and shows in the list.
3. "+ Link Existing" attaches a previously-unlinked app from the Apps tab.
4. Removing an item prompts Unlink vs Delete and behaves accordingly.
5. The list refreshes immediately after any action.
6. No backend code is modified.
