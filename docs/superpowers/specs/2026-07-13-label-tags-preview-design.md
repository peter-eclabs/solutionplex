# Design: Label Tags Preview on Solutions & Apps Cards

**Date:** 2026-07-13  
**Status:** Approved (design)  
**Feature area:** Backend (app arch/infra ownership) + Frontend (card preview, Plex)

## 1. Background

Solution rows nested under a Problem already show Architecture (purple) and Infrastructure
(orange) chips. Apps cards do not. When creating an App without linking a Solution, the
UI already collects Architecture/Infrastructure multi-selects and sends
`architecture_ids` / `infrastructure_ids`, but the backend `AppCreate` schema and
`create_app` service drop those fields.

Users need a consistent **label preview** on:

- Nested **Solution** rows under Problems
- **Apps** grid cards
- **Plex Visualizer** when an App is the center node

Architecture and Infrastructure **entity cards** stay unchanged.

## 2. Goals

1. Persist Architecture/Infrastructure IDs on Apps when created without a Solution.
2. **Effective labels:**
   - App **linked** to a Solution → inherit that Solution’s architectures/infrastructures.
   - App **unlinked** → use the App’s own stored IDs.
   - While linked, keep the App’s own IDs in the database (for restore on unlink).
3. Shared single-row chip preview with **`+n more`** overflow so card height/width stay fixed.
4. Replace list-card description previews with a **Created on:** date line on Solution rows and Apps cards.
5. Wire effective arch/infra into Plex for App-centered graphs.

## 3. Non-Goals

- Free-form tag/label entity (PRD post-MVP “Tags”).
- Label chips on Architecture or Infrastructure entity cards.
- Changing Solution create/edit forms (already assign arch/infra).
- Showing full description on list cards (detail view remains the place for full body).

## 4. Data model & API

### 4.1 App document (MongoDB)

Add optional arrays (default empty):

- `architecture_ids: ObjectId[]`
- `infrastructure_ids: ObjectId[]`

### 4.2 Schemas (`server/schemas/models.py`)

**AppCreate / AppUpdate**

- `architecture_ids: List[str] = []` (update: optional)
- `infrastructure_ids: List[str] = []` (update: optional)

**AppResponse**

- `architectures: List[ArchitectureShort] = []` — **effective** resolved list
- `infrastructures: List[InfrastructureShort] = []` — **effective** resolved list

### 4.3 Service rules (`server/services/apps.py`)

**Create / update**

- Validate each architecture_id / infrastructure_id exists (same pattern as solutions).
- Persist ObjectIds on the app document when provided.
- Linking/unlinking via `solution_id` must **not** clear or overwrite own
  `architecture_ids` / `infrastructure_ids` unless the client explicitly updates those fields.

**Populate (`populate_app`)**

```
if app.solution_id resolves to a solution:
  effective_arch = solution.architecture_ids
  effective_infra = solution.infrastructure_ids
else:
  effective_arch = app.architecture_ids
  effective_infra = app.infrastructure_ids
```

Resolve to short `{ id, code, title }` lists on the response (same shape as Solution).

### 4.4 Cascade on Architecture / Infrastructure delete

When an Architecture or Infrastructure is deleted, `$pull` its id from:

- Solutions (existing)
- **Apps** (new) — `apps_col` documents’ `architecture_ids` / `infrastructure_ids`

### 4.5 Client types (`client/src/api/client.ts`)

Extend `AppPrototype` with:

```ts
architectures: ArchitectureShort[];
infrastructures: InfrastructureShort[];
```

`createApp` / `updateApp` already accept optional `architecture_ids` /
`infrastructure_ids` — keep them; they will work once the backend accepts them.

## 5. UI: `LabelPreview`

### 5.1 Component

New file: `client/src/components/LabelPreview.tsx`

```ts
interface LabelPreviewProps {
  architectures: { id: string; title: string }[];
  infrastructures: { id: string; title: string }[];
  className?: string;
}
```

### 5.2 Behavior

- Order: all architectures first (`.tag-arch`), then infrastructures (`.tag-infra`).
- **Single non-wrapping row**, fixed height (~1.45rem).
- Use `ResizeObserver` (or measure on mount + resize) against the container width.
- Show as many full chips as fit; if any remain hidden, reserve space for a trailing
  chip: `+n more` (muted style).
- Zero labels → render `null` (no empty spacer).
- Must not expand entity-card height beyond the existing fixed card window.

### 5.3 Created-on line

On **Solution nested rows** and **Apps grid cards**, replace the italic description
preview with:

```
Created on: 13 July 2026
```

- Source: `created_at` ISO string from the API.
- Format: day + month name + year (e.g. `en-GB` long date without weekday).
- Place under the title; `LabelPreview` sits under the date line.

## 6. Surfaces

| Surface | Change |
|---------|--------|
| `ProblemSolutions` nested solution rows | Date line + `LabelPreview` (replace wrapping tags) |
| `AppsTab` entity cards | Date line + `LabelPreview` under title |
| `PlexVisualizer` when `component === 'apps'` | Outer nodes for effective arch/infra (1 direct node or category node with items), same pattern as solution center view |
| Architecture / Infrastructure tabs | No change |

## 7. Plex Visualizer (apps center)

When the center node is an App:

- Keep existing problem/solution outer nodes when present.
- Always add architecture and infrastructure outer items from the **effective**
  `app.architectures` / `app.infrastructures` when non-empty, using the existing
  “1 → direct node, N → category node” pattern and gradients (`grad-sol-arch`,
  `grad-sol-infra` or app-specific equivalents already in CSS).

Effective lists ensure linked apps show the solution’s stacks without client-side joins.

## 8. Edge cases

| Case | Behavior |
|------|----------|
| No labels | No chip row |
| Many long titles | Few chips + `+n more` |
| Container resize | Remeasure; chip count updates |
| Linked app with own IDs still in DB | UI shows solution labels only |
| Unlink | UI falls back to own labels |
| Delete arch/infra referenced only by app | IDs pulled from apps; chips update after refresh |
| Empty `created_at` (should not happen) | Omit date line or show fallback “—” |

## 9. Testing

**Backend (pytest)**

1. Create app with `architecture_ids` + `infrastructure_ids`, no `solution_id` → stored and populated on GET/list.
2. Create app with `solution_id` → response architectures/infrastructures match the solution’s, even if app body also sent own IDs.
3. Update app `solution_id` to empty → effective labels revert to own IDs (own IDs preserved).
4. Delete architecture → apps no longer reference that id.

**Frontend**

- Prefer a small pure helper for “how many chips fit” if extracted; otherwise visual verification of overflow and date formatting.
- Run existing client lint/typecheck if configured.

## 10. Files (expected touch list)

**Backend**

- `server/schemas/models.py`
- `server/services/apps.py`
- `server/services/architectures.py` (pull from apps)
- `server/services/infrastructures.py` (pull from apps)
- `server/tests/test_routers.py` (or dedicated app label tests)

**Frontend**

- `client/src/api/client.ts`
- `client/src/components/LabelPreview.tsx` (new)
- `client/src/components/AppsTab.tsx`
- `client/src/components/ProblemSolutions.tsx`
- `client/src/components/PlexVisualizer.tsx`
- `client/src/components/TabStyles.css`

## 11. Success criteria

- Solution rows and Apps cards show a fixed single-row label preview with `+n more` when needed.
- Card fixed window size does not grow when many labels exist.
- Apps linked to solutions inherit solution labels; unlinked apps show creation-time labels.
- Created-on date replaces description preview on those two card types.
- App-centered Plex shows effective architecture and infrastructure relationships.
- Architecture and Infrastructure entity cards remain without label previews.
- Backend tests for persistence and inheritance pass; `uv run pyright` / `uv run pytest` clean for touched server code.
