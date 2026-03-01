# PRD: Phase B2 — Light Editing (Edit Tasks from the Hub)

## Introduction

Phase B1 brought all Asana tasks into the Hub as read-only mirrors. Process owners can now _see_ everything in one place, but they still have to switch to Asana to make changes. Phase B2 closes that gap by letting users edit tasks directly in the Hub — mark them complete, change due dates, reassign them, update titles and descriptions — with changes syncing back to Asana in real-time. This applies to both Asana-origin tasks and Hub-created tasks, giving everyone a consistent editing experience.

## Goals

- Allow process owners to edit any task field (title, description, assignee, due date, status) without leaving the Hub
- Sync all edits back to Asana in real-time for Asana-origin tasks
- Provide quick inline actions (checkbox, date picker) for common changes
- Provide a detail panel for full task editing (all fields)
- Revert local changes on Asana API failure (Asana remains source of truth)
- Give Hub-created tasks the same editing experience as Asana tasks

## User Stories

### US-001: Toggle Task Completion (Inline)

**Description:** As a process owner, I want to click a checkbox on a task card to mark it complete (or reopen it) so I can track progress without opening Asana.

**Acceptance Criteria:**

- [ ] Clicking the circular completion indicator toggles `completed` status
- [ ] Completing a task: sets `completed = true`, `completed_at = now`, `status = 'completed'`
- [ ] Reopening a task: sets `completed = false`, `completed_at = null`, `status = 'active'`
- [ ] For Asana tasks: PATCH sent to Asana API (`PUT /tasks/{gid}` with `{ completed: true/false }`)
- [ ] On Asana API failure: revert checkbox, show error toast "Couldn't update in Asana — please try again"
- [ ] Checkbox shows loading spinner while API call is in-flight
- [ ] Hub-only tasks update locally without Asana call
- [ ] Completed task card visually dims (opacity + strikethrough title)
- [ ] Section completion counter updates immediately (e.g., "Plan — 4/5 complete")
- [ ] Typecheck passes

### US-002: Asana Write-Back API

**Description:** As a developer, I need an API endpoint that pushes task edits to both Supabase and Asana so the Hub and Asana stay in sync.

**Acceptance Criteria:**

- [ ] New `PATCH /api/tasks/[id]` endpoint (or extend existing `/api/tasks` PATCH)
- [ ] Accepts partial updates: `title`, `description`, `assignee_asana_gid`, `due_date`, `completed`
- [ ] For Asana-origin tasks (`origin = 'asana'` and `asana_task_gid` exists): pushes changes to Asana API first, then updates Supabase on success
- [ ] For Hub tasks: updates Supabase only
- [ ] Asana API mapping: `title` → `name`, `description` → `notes`, `due_date` → `due_on`, `completed` → `completed`, `assignee_asana_gid` → `assignee`
- [ ] On Asana API error: returns `{ error: "asana_sync_failed", message: "..." }` with status 502, does NOT update Supabase
- [ ] On Asana API success: updates Supabase with the Asana-confirmed values + refreshes `last_synced_at`
- [ ] Uses `getAsanaToken()` for auth (handles token refresh automatically)
- [ ] Typecheck passes

### US-003: Task Detail Panel

**Description:** As a process owner, I want to click a task card to open a detail panel where I can see and edit all task fields.

**Acceptance Criteria:**

- [ ] Clicking a task card opens a slide-out panel (right side, same pattern as AI chat panel)
- [ ] Panel shows all task fields in organized sections:
  - **Header:** Title (editable text input), completion checkbox, origin badge
  - **Details section:** Assignee (dropdown), Due date (date picker), PDCA section (dropdown), Status badge
  - **Description:** Editable textarea (auto-expanding)
  - **Metadata (read-only):** Created date, Last synced, Source
  - **Footer:** Link to Asana (for Asana tasks), Delete button (Hub tasks only)
- [ ] Close button (X) and click-outside-to-close
- [ ] Escape key closes the panel
- [ ] Panel has dark mode support using CSS custom properties
- [ ] Mobile: panel takes full width as overlay
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Inline Due Date Editing

**Description:** As a process owner, I want to click a due date on a task card to change it quickly without opening the detail panel.

**Acceptance Criteria:**

- [ ] Clicking the due date text on a task card opens a native date picker (`<input type="date">`)
- [ ] Selecting a new date saves immediately (PATCH to API)
- [ ] Clicking "Add due date" on tasks without one opens the same picker
- [ ] Loading indicator while saving
- [ ] On API failure: revert to previous date, show error toast
- [ ] Overdue styling updates immediately when date changes
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Assignee Picker

**Description:** As a process owner, I want to reassign a task to a different team member from a dropdown so I don't have to open Asana.

**Acceptance Criteria:**

- [ ] New `GET /api/asana/workspace-members` endpoint that fetches all users from the NIA Asana workspace
- [ ] Caches workspace members for 10 minutes (avoid repeated API calls)
- [ ] Assignee field in detail panel shows a searchable dropdown with workspace member names
- [ ] Selecting a member saves immediately: updates `assignee_name`, `assignee_asana_gid`, `assignee_email`
- [ ] "Unassign" option clears the assignee
- [ ] For Asana tasks: pushes assignee change to Asana API (`PUT /tasks/{gid}` with `{ assignee: gid }`)
- [ ] On API failure: revert selection, show error toast
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Inline Title and Description Editing

**Description:** As a process owner, I want to edit a task's title and description in the detail panel so I can clarify or update task details.

**Acceptance Criteria:**

- [ ] Title field in detail panel is an editable text input (auto-saves on blur or Enter)
- [ ] Description field is an auto-expanding textarea (auto-saves on blur)
- [ ] Debounced save: waits 500ms after typing stops before sending PATCH
- [ ] Unsaved changes indicator (subtle "Saving..." text near the field)
- [ ] For Asana tasks: pushes `name` and `notes` changes to Asana API
- [ ] On API failure: revert field value, show error toast
- [ ] Empty title prevented: if user clears title, revert to previous value
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Optimistic UI with Revert

**Description:** As a user, I want changes to feel instant even though they sync to Asana, so the Hub feels fast and responsive.

**Acceptance Criteria:**

- [ ] All edits apply optimistically to the local state immediately
- [ ] Loading indicator shown on the specific field being edited (not full-page spinner)
- [ ] On API success: local state confirmed, loading indicator removed
- [ ] On API failure: local state reverted to pre-edit value, error toast shown with message
- [ ] Error toast includes "Retry" button that re-attempts the same edit
- [ ] Toast auto-dismisses after 5 seconds if not interacted with
- [ ] Multiple concurrent edits handled correctly (each field independent)
- [ ] Typecheck passes

### US-008: Delete Hub Tasks

**Description:** As a process owner, I want to delete Hub-created tasks that are no longer relevant, but I should not be able to delete Asana tasks from the Hub.

**Acceptance Criteria:**

- [ ] Delete button visible only for Hub-origin tasks (`origin = 'hub_ai'` or `'hub_manual'`)
- [ ] Delete button NOT shown for Asana-origin tasks (show "Manage in Asana" link instead)
- [ ] Confirmation dialog before deletion: "Delete this task? This cannot be undone."
- [ ] After deletion: panel closes, task removed from list
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Clicking the completion indicator on any task card toggles its completed status and syncs to Asana (if Asana-origin)
- FR-2: All Asana-origin task edits must push to Asana API first; Supabase is only updated on Asana success
- FR-3: On Asana API failure, revert the local change and display an error toast with a retry option
- FR-4: Clicking a task card opens a slide-out detail panel with all editable fields
- FR-5: Assignee dropdown fetches and caches all NIA workspace members from Asana
- FR-6: Title and description edits auto-save with 500ms debounce
- FR-7: Due date changes save immediately on selection
- FR-8: Hub-created tasks can be edited and deleted; Asana tasks can be edited but not deleted from Hub
- FR-9: All edits are optimistic (instant UI update) with revert-on-failure
- FR-10: Detail panel has dark mode support, mobile responsiveness, and keyboard navigation (Escape to close)

## Non-Goals (Out of Scope)

- **No task creation** — that's Phase B3
- **No drag-and-drop reordering** — tasks stay in their Asana section order
- **No moving tasks between sections** — section is determined by Asana
- **No subtask creation or deletion** — manage subtask hierarchy in Asana
- **No bulk editing** — edit one task at a time
- **No real-time collaboration** — if two people edit the same task, last write wins
- **No offline support** — edits require network connection
- **No task comments** — comments stay in Asana

## Design Considerations

- **Detail panel** should match the existing AI chat panel pattern (slide-out from right, same width, backdrop blur on mobile)
- **Inline editing** uses native HTML inputs for simplicity and accessibility: `<input type="date">` for dates, standard `<input>` for titles
- **Assignee dropdown** should be searchable (type to filter) since the workspace may have 20+ members
- **Origin badge** stays read-only — users can see where a task came from but can't change it
- **Asana link** — for Asana tasks, include a small external-link icon that opens the task in Asana (already exists in B1)
- **Reuse existing components:** Button, Badge, Input from `components/ui/`
- **Color tokens:** Use `bg-card`, `border`, `text-foreground` for dark mode compatibility

## Technical Considerations

- **Asana API for task updates:** `PUT https://app.asana.com/api/1.0/tasks/{gid}` with JSON body. Fields: `name`, `notes`, `completed`, `due_on`, `assignee` (GID or null)
- **Asana API for workspace members:** `GET /workspaces/{workspace_gid}/users?opt_fields=name,email`
- **Token management:** `getAsanaToken(userId)` already handles refresh — reuse in the write-back endpoint
- **Optimistic updates:** Use React `useState` for local task state, revert via saved snapshot on error
- **Debounce:** Use `setTimeout` + `clearTimeout` pattern for title/description saves (no need for a library)
- **Race conditions:** Each edit should carry a version counter or timestamp; discard stale responses
- **Error boundary:** Wrap Asana API calls in try/catch; surface user-friendly error messages

## Success Metrics

- Process owners can complete a task from the Hub in under 2 seconds (one click)
- Edits appear in Asana within 3 seconds of saving in the Hub
- Zero data loss — failed syncs always revert, never leave orphaned state
- Process owners spend less time switching between Hub and Asana

## Open Questions

- Should we add an "activity log" showing recent edits to a task? (Probably B3 or later)
- Should the detail panel show subtasks inline, or just link to the parent? (Start with link to parent for subtasks)
- Should we notify other Hub users when a task is edited? (Not for B2 — no real-time collab yet)
