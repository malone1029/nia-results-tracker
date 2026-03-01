# PRD: Full Task Creation + Drag-and-Drop Reordering (Phase B3)

## Introduction

Process owners currently rely on two paths to get tasks into the Hub: AI suggestions (`hub_ai`) or Asana imports (`asana`). There's no way to manually create a task directly in the Hub. Phase B3 adds a "New Task" creation flow — a full form where users fill in title, description, PDCA section, assignee, and due date — plus drag-and-drop reordering so tasks can be rearranged within and between sections. Newly created tasks sync to Asana immediately using the write-back infrastructure built in B2.

## Goals

- Let process owners create tasks directly in the Hub without needing Asana
- Provide both a global "New Task" button and per-section "+ Add task" buttons for fast access
- Immediately sync new tasks to Asana on creation (if the process is linked to an Asana project)
- Allow drag-and-drop reordering of tasks within and between PDCA sections
- Keep the UI consistent with the existing task detail panel and review panel patterns

## User Stories

### US-001: New Task Form (Global Button)

**Description:** As a process owner, I want to click a "New Task" button at the top of the task review panel so that I can create a new task with all relevant fields.

**Acceptance Criteria:**

- [ ] A "New Task" button appears at the top of the task review panel (next to the header area)
- [ ] Clicking it opens a creation form (slide-out panel, reusing the detail panel pattern)
- [ ] Form fields: Title (required), Description (optional), PDCA Section (required, dropdown with Plan/Execute/Evaluate/Improve), Assignee (optional, uses existing AssigneePicker), Due Date (optional, date picker)
- [ ] PDCA Section defaults to "Plan" but can be changed
- [ ] Title is validated — cannot be empty or whitespace-only
- [ ] "Create" button is disabled until title is filled in
- [ ] Form shows a loading state ("Creating...") while the API call is in flight
- [ ] On success: form closes, new task appears in the correct section, success toast shows
- [ ] On failure: error toast with message, form stays open so user can retry
- [ ] Typecheck passes (`npx tsc --noEmit`)
- [ ] Verify in browser using dev-browser skill

### US-002: Per-Section Add Button

**Description:** As a process owner, I want a small "+ Add task" button at the bottom of each PDCA section so that I can quickly create a task pre-assigned to that section.

**Acceptance Criteria:**

- [ ] Each section in the task review panel shows a subtle "+ Add task" link/button at the bottom
- [ ] Clicking it opens the same creation form as the global button, but with PDCA Section pre-selected to match the clicked section
- [ ] The pre-selected PDCA section can still be changed in the form
- [ ] For Asana-origin sections (e.g., "Plan" from Asana), the new task is created with `pdca_section` matching the section's PDCA equivalent
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Asana Sync on Creation

**Description:** As a process owner, I want newly created tasks to automatically appear in Asana so that my team sees them without a manual export step.

**Acceptance Criteria:**

- [ ] When a process has an `asana_project_gid` (linked to Asana), new tasks are pushed to Asana immediately after Supabase insert
- [ ] The task is created in the correct PDCA section in the Asana project (using `POST /sections/{sectionGid}/addTask`)
- [ ] If an assignee with an Asana GID is set, the Asana task is assigned to them
- [ ] If a due date is set, the Asana task has `due_on` populated
- [ ] The returned `asana_task_gid` and `asana_task_url` are saved back to Supabase
- [ ] If the process is NOT linked to Asana, the task is created in Supabase only (no error — just no Asana sync)
- [ ] If Asana sync fails, the Supabase task is still created (it becomes a Hub-only task), and a warning toast tells the user "Task created but Asana sync failed. You can export it later."
- [ ] Typecheck passes

### US-004: Create Task API Enhancement

**Description:** As a developer, I need the task creation API to support all fields needed for manual creation and return the full task object.

**Acceptance Criteria:**

- [ ] `POST /api/tasks` accepts additional fields: `assignee_name`, `assignee_email`, `assignee_asana_gid`, `due_date`
- [ ] Origin is set to `hub_manual` and source to `user_created` for manually created tasks
- [ ] Status is set to `active` (skipping `pending` review — manual tasks are immediately active)
- [ ] The API returns the full created task object (not just `{ ids, count }`) so the UI can add it to state without a refetch
- [ ] Authentication is enforced (401 for unauthenticated requests)
- [ ] Rate limiting is applied (reuse the per-user rate limiter from `PATCH /api/tasks/[id]`)
- [ ] Typecheck passes

### US-005: Sort Order Column (Database Migration)

**Description:** As a developer, I need a `sort_order` column on `process_tasks` so that drag-and-drop reordering persists.

**Acceptance Criteria:**

- [ ] A new `sort_order` integer column is added to `process_tasks` (default 0, not null)
- [ ] Existing tasks get `sort_order` populated based on their current `created_at` order (earlier = lower number)
- [ ] The GET `/api/tasks` endpoint orders by `sort_order ASC, created_at ASC` (sort_order takes priority, created_at as tiebreaker)
- [ ] The `ProcessTask` TypeScript type is updated to include `sort_order: number`
- [ ] Migration runs successfully against the Supabase database
- [ ] Typecheck passes

### US-006: Drag-and-Drop Reordering Within a Section

**Description:** As a process owner, I want to drag tasks up and down within a section to prioritize them.

**Acceptance Criteria:**

- [ ] Install `@dnd-kit/core` and `@dnd-kit/sortable` as dependencies
- [ ] Each task card has a visible drag handle (grip icon on the left side)
- [ ] Dragging a task within its section reorders it visually with smooth animation
- [ ] On drop: the new order is saved via API call (updates `sort_order` for affected tasks)
- [ ] Optimistic update: the new order shows immediately, reverts on failure
- [ ] Works on both desktop (mouse) and mobile (touch)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Drag-and-Drop Between Sections (PDCA Move)

**Description:** As a process owner, I want to drag a task from one PDCA section to another so that I can reclassify it as my process evolves.

**Acceptance Criteria:**

- [ ] A task can be dragged from one section and dropped into a different section
- [ ] The drop target section highlights when a task is dragged over it
- [ ] On drop: the task's `pdca_section` is updated to match the target section
- [ ] On drop: `sort_order` values are recalculated for the target section
- [ ] For Asana-origin tasks: the task is moved to the corresponding Asana section via `POST /sections/{sectionGid}/addTask`
- [ ] `PATCH /api/tasks/[id]` is extended to accept `pdca_section` changes (currently not supported)
- [ ] If the Asana section move fails, the task reverts to its original section with an error toast
- [ ] Optimistic update with revert on failure
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Reorder API Endpoint

**Description:** As a developer, I need an API endpoint that accepts a batch of sort order updates efficiently.

**Acceptance Criteria:**

- [ ] New endpoint: `PATCH /api/tasks/reorder` (or similar)
- [ ] Accepts `{ updates: [{ id: number, sort_order: number, pdca_section?: string }] }`
- [ ] Updates all specified tasks in a single database call (batch update)
- [ ] For tasks that changed `pdca_section` and are Asana-origin: moves them to the new Asana section
- [ ] Authentication and rate limiting enforced
- [ ] Returns `{ success: true }` on success
- [ ] Typecheck passes

## Functional Requirements

- FR-1: A "New Task" button appears in the task review panel header, visible on all screen sizes
- FR-2: Each PDCA section displays a "+ Add task" button at its bottom
- FR-3: The creation form is a slide-out panel matching the existing task detail panel style
- FR-4: Created tasks use `origin: "hub_manual"`, `source: "user_created"`, `status: "active"`
- FR-5: If the process is linked to Asana, new tasks sync immediately — created in the correct PDCA section with assignee and due date
- FR-6: If Asana sync fails on creation, the Hub task is kept and a warning toast appears
- FR-7: A `sort_order` column on `process_tasks` persists task ordering
- FR-8: `@dnd-kit` powers drag-and-drop with drag handles, drop zones, and smooth animations
- FR-9: Moving a task between sections updates its `pdca_section` (and Asana section for Asana-origin tasks)
- FR-10: The `PATCH /api/tasks/[id]` endpoint accepts `pdca_section` as an updatable field
- FR-11: A batch reorder endpoint updates multiple `sort_order` values in one call

## Non-Goals

- No task templates (deferred — keep B3 focused on manual creation)
- No recurring/repeating tasks
- No subtask creation (subtasks are imported from Asana only)
- No bulk task creation (one task at a time)
- No drag-and-drop from external sources (e.g., dragging text into the panel)
- No reordering of Asana subtasks within their parent

## Design Considerations

- **Creation form** reuses the slide-out panel pattern from `task-detail-panel.tsx` — same width, animation, backdrop
- **Drag handle** should be a 6-dot grip icon (⠿) to the left of the task card, only visible on hover (desktop) or always visible (mobile)
- **Drop zone indicator** should be a horizontal line with the section's PDCA color when dragging between sections
- **Per-section "+ Add task"** should be subtle (text-muted color, small font) to avoid cluttering the section
- **PDCA section selector** in the creation form should use colored badges matching the existing PDCA color scheme from `lib/pdca.ts`
- Reuse existing components: `AssigneePicker`, `Toast`, date input pattern from task-detail-panel

## Technical Considerations

- **`@dnd-kit`** over alternatives: tree-shakeable, accessibility-first, works with React 19 / Next.js 16, supports both sortable (within section) and droppable (between sections). Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **Sort order strategy:** Use gap-based numbering (e.g., 1000, 2000, 3000) so inserts between items don't require renumbering all rows. When gaps run out, renumber the whole section
- **Asana section movement:** Uses `POST /sections/{sectionGid}/addTask` (already proven in `export/route.ts`). This _moves_ the task — Asana removes it from the old section automatically
- **Migration backfill:** Set `sort_order = ROW_NUMBER() OVER (PARTITION BY process_id, pdca_section ORDER BY created_at) * 1000` so existing tasks get spaced-out sort orders
- **Batch reorder:** Use Supabase `upsert` or individual updates in a loop (Supabase doesn't support `UPDATE ... FROM VALUES` natively). At ~20 tasks per process, a loop is fine
- **`buildSections()`** in `task-review-panel.tsx` currently uses `sortTasks()` which sorts by completion and due date — this needs to change to `sort_order` as the primary sort key
- **Existing PATCH endpoint** at `/api/tasks/[id]` does not accept `pdca_section` — needs to be extended with validation against `PDCA_SECTION_VALUES`
- **Asana section GID lookup:** The process's linked Asana project has PDCA sections. We need to look up the target section GID when moving tasks. Can reuse the section lookup pattern from `export/route.ts` or cache section GIDs on the process

## Success Metrics

- Process owners can create a task in under 10 seconds (title + section + create)
- New tasks appear in Asana within 3 seconds of creation
- Tasks can be reordered with drag-and-drop on both desktop and mobile
- No regression in existing task editing or completion toggle functionality

## Open Questions

- Should empty PDCA sections be shown with just the "+ Add task" button, or hidden until they have tasks? (Recommendation: show them so users can add tasks to any section)
- When dragging between sections, should the task keep its Asana section name or update it? (Recommendation: update `asana_section_name` to match the new PDCA section label)
