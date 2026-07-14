# Phase 4 — Frontend Protection & Conditional UI

**Objective:** Use the `useRole` hook to conditionally hide (not just disable) all mutation UI elements (create, edit, delete, link, unlink) for users with the `Reader` role. Ensure that if a 403 occurs anyway, the UI gracefully handles it via the existing toast/error banners rather than crashing.

**Depends on:** Phase 3 (Frontend Auth) must be complete to provide the `useRole()` hook.

---

## Files to Modify

All modifications rely on injecting `const { canWrite } = useRole();` and conditionally rendering the UI elements.

| File | Change |
|------|--------|
| `client/src/components/DeleteButton.tsx` | Return `null` if `!canWrite` |
| `client/src/components/ProblemsTab.tsx` | Hide the "+ Create Problem Card" trigger if `!canWrite` |
| `client/src/components/ArchitectureTab.tsx` | Hide the "+ Create Architecture Card" trigger if `!canWrite` |
| `client/src/components/InfrastructureTab.tsx` | Hide the "+ Create Infrastructure Card" trigger if `!canWrite` |
| `client/src/components/AppsTab.tsx` | Hide the "+ Create App Card" trigger if `!canWrite` |
| `client/src/components/ProblemSolutions.tsx` | Hide the "+ Propose Solution" button and `<DeleteButton>` if `!canWrite` |
| `client/src/components/SolutionPrototypes.tsx` | Hide "+ Create Prototype", "+ Link Existing", "Unlink", "Delete", and `prototype-remove-trigger` if `!canWrite` |
| `client/src/components/DetailView.tsx` | Hide the Edit button in the header if `!canWrite`. Return `null` from the edit panel rendering if `!canWrite`. |

---

## Step-by-Step Implementation

### Step 1 — `client/src/components/DeleteButton.tsx` (MODIFY)

```diff
 import { useState, useRef, useEffect } from 'react';
 import { createPortal } from 'react-dom';
 import './DeleteButton.css';
+import { useRole } from '../auth/useRole';

 export function DeleteButton({
   entityLabel,
   onDelete,
   onDeleted,
 }: {
   entityLabel: string;
   onDelete: () => Promise<void>;
   onDeleted: () => void;
 }) {
+  const { canWrite } = useRole();
   const [isConfirming, setIsConfirming] = useState(false);
   // ...

+  if (!canWrite) {
+    return null;
+  }

   return (
     <>
       <button
```

### Step 2 — `client/src/components/ProblemsTab.tsx` (MODIFY)

```diff
 import { CharCounter } from './CharCounter';
 import { formatCreatedOn } from './formatCreatedOn';
 import './TabStyles.css';
+import { useRole } from '../auth/useRole';

 export function ProblemsTab({ searchQuery, onCardClick }: ProblemsTabProps) {
   const queryClient = useQueryClient();
+  const { canWrite } = useRole();
   const [title, setTitle] = useState('');

   // ...

           <div className="cards-grid">
+            {canWrite && (
               <article
                 className="entity-card add-card-trigger btn-problem"
                 onClick={() => setIsFormOpen(true)}
                 role="button"
                 tabIndex={0}
                 // ...
               >
                 <div className="add-card-content">
                   <span className="add-icon">+</span>
                   <span className="add-text">Create Problem Card</span>
                 </div>
               </article>
+            )}

             {problems.map((p) => (
```

*Repeat the exact same logic (adding `{canWrite && (...)` around the `add-card-trigger` article) for:*
- `client/src/components/ArchitectureTab.tsx`
- `client/src/components/InfrastructureTab.tsx`
- `client/src/components/AppsTab.tsx`

*(No need to detail the identical diffs here; the implementer will apply the pattern.)*

### Step 3 — `client/src/components/ProblemSolutions.tsx` (MODIFY)

```diff
 import { CharCounter } from './CharCounter';
 import { formatCreatedOn } from './formatCreatedOn';
 import './TabStyles.css';
+import { useRole } from '../auth/useRole';

 export function ProblemSolutions({
   problemId,
   problemTitle,
   solutions,
   onChanged,
   onNavigate,
 }: ProblemSolutionsProps) {
+  const { canWrite } = useRole();
   const [title, setTitle] = useState('');

   // ...

       <div className="problem-solutions-header">
         <span className="problem-solutions-label">
           Solutions ({solutions.length})
         </span>
+        {canWrite && (
           <button
             type="button"
             className="propose-solution-btn"
             onClick={openForm}
           >
             + Propose Solution
           </button>
+        )}
       </div>

       {solutions.length === 0 ? (
         <p className="problem-solutions-empty">
           No solutions proposed yet for this problem.
         </p>
       ) : (
         <ul className="problem-solutions-list">
           {solutions.map((s) => (
             <li key={s.id} className="problem-solution-item">
-              <DeleteButton
-                entityLabel="Solution"
-                onDelete={() => api.deleteSolution(s.id)}
-                onDeleted={onChanged}
-              />
+              {canWrite && (
+                <DeleteButton
+                  entityLabel="Solution"
+                  onDelete={() => api.deleteSolution(s.id)}
+                  onDeleted={onChanged}
+                />
+              )}
               <button
```

### Step 4 — `client/src/components/SolutionPrototypes.tsx` (MODIFY)

```diff
 import { CreateAppModal } from './CreateAppModal';
 import { useToast } from './ToastContext';
 import { formatCreatedOn } from './formatCreatedOn';
 import './TabStyles.css';
+import { useRole } from '../auth/useRole';

 export function SolutionPrototypes({
   solutionId,
   solutionTitle,
   apps,
   onChanged,
   onNavigate,
 }: SolutionPrototypesProps) {
+  const { canWrite } = useRole();
   const { showToast } = useToast();

   // ...

       <div className="problem-solutions-header">
         <span className="solution-prototypes-label">Prototypes ({apps.length})</span>
-        <div className="solution-prototypes-actions">
-          <button
-            type="button"
-            className="propose-solution-btn"
-            onClick={() => setIsCreateOpen(true)}
-          >
-            + Create Prototype
-          </button>
-          <button
-            type="button"
-            className="propose-solution-btn"
-            onClick={() => setIsLinkOpen(true)}
-          >
-            + Link Existing
-          </button>
-        </div>
+        {canWrite && (
+          <div className="solution-prototypes-actions">
+            <button
+              type="button"
+              className="propose-solution-btn"
+              onClick={() => setIsCreateOpen(true)}
+            >
+              + Create Prototype
+            </button>
+            <button
+              type="button"
+              className="propose-solution-btn"
+              onClick={() => setIsLinkOpen(true)}
+            >
+              + Link Existing
+            </button>
+          </div>
+        )}
       </div>

   // ...
   
               {removingId === app.id ? (
                 <div className="prototype-remove-menu">
                   <button
                     type="button"
                     // ...
                   >
                     Unlink
                   </button>
                   <button
                     // ...
                   >
                     Delete
                   </button>
                   <button
                     // ...
                   >
                     Cancel
                   </button>
                 </div>
-              ) : (
+              ) : canWrite ? (
                 <button
                   type="button"
                   className="prototype-remove-trigger"
                   aria-label={`Remove ${app.title}`}
                   onClick={(e) => {
                     e.stopPropagation();
                     setRemovingId(app.id);
                   }}
                 >
                   ✕
                 </button>
-              )}
+              ) : null}
```

### Step 5 — `client/src/components/DetailView.tsx` (MODIFY)

Hide the "Edit" button in the header. If the edit panel is somehow activated (e.g. by manipulating state), it should render nothing.

```diff
 import { LabelPreview } from './LabelPreview';
 import { MultiSelect } from './MultiSelect';
 import './DetailView.css';
+import { useRole } from '../auth/useRole';

 export function DetailView({
   entityType,
   entityId,
   onClose,
   onNavigate,
 }: DetailViewProps) {
   const queryClient = useQueryClient();
+  const { canWrite } = useRole();
   const { showToast } = useToast();
   const [isEditing, setIsEditing] = useState(false);

   // ...
   
         <div className="detail-header-actions">
-          {!isEditing && (
+          {!isEditing && canWrite && (
             <button
               type="button"
               className="detail-edit-btn"
               onClick={() => setIsEditing(true)}
             >
               Edit
             </button>
           )}
           <button
             type="button"
             className="detail-close-btn"
             onClick={onClose}
             aria-label="Close view"
           >
             ✕
           </button>
         </div>
       </header>

   // ... further down, guard the edit panel itself just in case
   
       {isEditing ? (
-        <form onSubmit={handleUpdate} className="detail-edit-form">
+        canWrite ? (
+          <form onSubmit={handleUpdate} className="detail-edit-form">
+            {/* form contents */}
+          </form>
+        ) : null
       ) : (
```

---

## 403 API Error Handling

The existing components wrap API calls in `try/catch` blocks and set `error` state (or show a toast) if `err.message` is populated. 

Because `request()` throws `new Error(await response.text())`, a FastAPI 403 response (which looks like `{"detail": "Role 'reader' lacks clearance..."}`) will be stringified as the error message. 

Since all mutation UI is hidden for readers, a 403 should theoretically never occur in the wild. But if a user circumvents the UI (e.g., via dev tools) and sends a mutation, the server will correctly block it (403), the `request()` function will throw, and the existing `catch (err: unknown)` blocks will display the server's detail message in the error banner or toast. No UI crash will occur.

---

## Verification

```bash
cd client
npm run build   # Ensure all components compile with strict types
npm run lint    # oxlint
```

### Manual Testing
1. Login as a user with `role: "reader"`.
2. Visit the Problems tab — the "+ Create Problem Card" tile should be gone.
3. Click a Problem card — the "Edit" button and "Delete" button should be gone.
4. Open a Problem detail view — the "+ Propose Solution" button should be gone.
5. Open a Solution detail view — the "+ Create Prototype" and "+ Link Existing" buttons should be gone, as well as the '✕' icon next to prototypes.
6. Login as an `admin` or `superadmin`.
7. Verify all mutation UI controls are visible and functional.
