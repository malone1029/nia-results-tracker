# PRD: Deep Asana Task Integration (Phase B1)

## Introduction

Bring all Asana project tasks into the NIA Excellence Hub so that process owners see a **single, unified task list** — Asana tasks alongside AI-generated suggestions — all in one place. The Hub becomes the authoritative task list; Asana stays in sync as the downstream execution tool.

This solves three critical problems:

1. **AI is flying blind** — the coach can't see Asana tasks, so it incorrectly tells users they need tasks when tasks already exist
2. **Health scores lie** — they only check "do tasks exist?" (3 pts), not whether tasks are complete, assigned, or on time
3. **Two tools, two places** — teammates have to check both the Hub and Asana to get the full picture

### Strategy Context

This is the first phase of a multi-phase migration:

- **B1 (this PRD):** Import Asana tasks, unified display, push-back sync, smarter scoring
- **B2 (future):** Light editing — mark complete, change due dates, reassign directly in Hub
- **B3 (future):** Full task creation in Hub with templates and repeating tasks
- **A (future):** Full task management — Asana becomes optional

## Goals

- Import ALL tasks (not just ADLI docs) from linked Asana projects into the Hub
- Display a unified task list: Asana tasks + AI suggestions + manually created tasks
- Sync on page load so data stays fresh without manual effort
- Push new Hub-created tasks back to Asana so both systems match
- Upgrade health scoring to reward task execution quality (assignees, due dates, on-time completion)
- Give the AI coach full visibility into real tasks for accurate assessments

## User Stories

### US-001: Extend task database schema

**Description:** As a developer, I need the database to store imported Asana task data (assignee, due date, completion status, section) alongside Hub-created tasks, so all tasks live in one unified table.

**Acceptance Criteria:**

- [ ] Migration adds new columns to `process_tasks`:
  - `origin` TEXT: `'asana'` | `'hub_ai'` | `'hub_manual'` (where this task came from)
  - `assignee_name` TEXT (nullable)
  - `assignee_email` TEXT (nullable — for matching to Hub `user_roles`)
  - `assignee_asana_gid` TEXT (nullable)
  - `due_date` DATE (nullable)
  - `completed` BOOLEAN DEFAULT FALSE
  - `completed_at` TIMESTAMPTZ (nullable)
  - `asana_section_name` TEXT (nullable — which Asana section it belongs to)
  - `asana_section_gid` TEXT (nullable)
  - `parent_asana_gid` TEXT (nullable — if this is a subtask, the parent task GID)
  - `is_subtask` BOOLEAN DEFAULT FALSE
  - `last_synced_at` TIMESTAMPTZ (nullable — when this task was last refreshed from Asana)
- [ ] Existing `process_tasks` rows get `origin = 'hub_ai'` as default (backfill)
- [ ] Existing `source` column is preserved (keeps AI source tracking). New `origin` column tracks _where_ the task lives, not _how_ it was created
- [ ] `status` CHECK constraint updated to allow `'pending'` | `'active'` | `'completed'` | `'exported'` (add `'active'` and `'completed'`)
- [ ] Add index on `(process_id, origin)` for fast filtering
- [ ] Add index on `asana_task_gid` for upsert lookups during sync
- [ ] RLS policy matches existing `process_tasks` policy (authenticated users only)
- [ ] Update `ProcessTask` interface in `lib/types.ts` with all new fields
- [ ] Typecheck passes

---

### US-002: Asana task fetch API

**Description:** As the system, I need an API route that fetches ALL tasks from a linked Asana project (including subtasks and descriptions) and upserts them into `process_tasks`, so the Hub always has fresh task data.

**Acceptance Criteria:**

- [ ] New API route: `POST /api/asana/sync-tasks`
- [ ] Accepts `{ processId: number }` in request body
- [ ] Looks up `asana_project_gid` from the process record
- [ ] Returns 400 if process has no linked Asana project
- [ ] Fetches all sections → all tasks → subtasks for each task using existing `asanaFetch()` helper
- [ ] For each Asana task, extracts: `gid`, `name`, `notes`, `completed`, `assignee.name`, `assignee.email`, `due_on`, `permalink_url`, section name/gid, parent task gid (if subtask)
- [ ] Fetches assignee email via Asana user endpoint (for matching to Hub `user_roles` by email)
- [ ] Upserts into `process_tasks` using `asana_task_gid` as the match key:
  - If task exists in DB: update `title`, `assignee_name`, `assignee_email`, `due_date`, `completed`, `completed_at`, `asana_section_name`, `last_synced_at`
  - If task is new: insert with `origin = 'asana'`, `status = 'active'` (or `'completed'` if completed in Asana)
  - If task exists in DB but no longer in Asana: **delete it from the Hub** (clean removal — if it's gone from Asana, it's gone from the Hub)
- [ ] Skips ADLI documentation tasks (`[ADLI: Approach]`, etc.) — these are managed separately by the existing system
- [ ] Only deletes Asana-origin tasks (`origin = 'asana'`). Hub-created tasks are never auto-deleted by sync.
- [ ] Returns summary: `{ imported: number, updated: number, removed: number, total: number }`
- [ ] Handles Asana API pagination (projects can have 100+ tasks)
- [ ] Handles Asana API rate limiting (429 responses) with retry
- [ ] Typecheck passes

---

### US-003: Automatic sync on page load

**Description:** As a process owner, when I open a process that's linked to Asana, I want the task list to automatically refresh from Asana so I always see up-to-date information without clicking anything.

**Acceptance Criteria:**

- [ ] On the process detail page, when `asana_project_gid` exists, trigger `POST /api/asana/sync-tasks` in the background
- [ ] Show cached/stored tasks immediately (no loading spinner blocking the page)
- [ ] After sync completes, refresh the task list to show any changes
- [ ] Show subtle "Last synced: X minutes ago" timestamp in the task panel header
- [ ] If sync fails (Asana token expired, API error), show a non-blocking warning: "Couldn't refresh from Asana. Showing cached data."
- [ ] If Asana token is expired, show a "Reconnect Asana" link (to `/settings`)
- [ ] Don't trigger sync if the last sync was less than 2 minutes ago (avoid hammering Asana API on rapid page reloads)
- [ ] Typecheck passes

---

### US-004: Unified task list UI

**Description:** As a process owner, I want the Tasks tab to show ALL my tasks — imported Asana tasks and Hub-created tasks — in one unified list, so I have a single view of everything I need to do.

**Acceptance Criteria:**

- [ ] Replace current `TaskReviewPanel` with a new unified task view
- [ ] Tasks organized by Asana section (if available) or PDCA section (for Hub-created tasks)
- [ ] Each task card shows:
  - Title
  - Assignee name (or "Unassigned" in muted text). If `assignee_email` matches a Hub `user_roles` entry, show their Hub display name
  - Due date (or "No due date" in muted text)
  - Completion status (checkbox or checkmark icon, read-only for now)
  - Origin badge: small label showing "Asana" (teal) or "AI Suggestion" (orange) or "Manual" (gray)
  - Overdue indicator: if `due_date < today` and `completed = false`, show due date in red
- [ ] Subtasks appear indented under their parent task (slightly smaller card, left margin) — no expand/collapse needed in B1
- [ ] Completed tasks are visually dimmed (reduced opacity) and appear at the bottom of each section
- [ ] Section headers show task count and completion ratio (e.g., "Plan — 3/5 complete")
- [ ] Asana tasks link to their Asana permalink (small external link icon)
- [ ] Empty state: "Link this process to an Asana project to import tasks, or use the AI coach to generate improvement suggestions."
- [ ] Mobile-responsive: cards stack vertically on small screens
- [ ] Respects dark mode theme
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-005: AI suggestion cards (visual distinction)

**Description:** As a process owner, I want AI-generated task suggestions to be clearly distinguishable from my real Asana tasks, so I can review them before they become part of my task list.

**Acceptance Criteria:**

- [ ] Hub-created tasks with `origin = 'hub_ai'` and `status = 'pending'` appear in a visually distinct style:
  - Dashed border or light orange/amber background tint
  - "AI Suggestion" badge
  - Source detail shown (e.g., "From: Add quarterly review cadence")
- [ ] Each suggestion card has two action buttons:
  - "Keep" (checkmark) — changes status from `pending` to `active`, marks it for Asana sync
  - "Dismiss" (X) — deletes the task from the Hub
- [ ] Suggestions appear in their own "Suggested Tasks" section at the top of the task list, above the regular sections
- [ ] Count of pending suggestions shown in section header: "AI Suggestions — 4 to review"
- [ ] After approving or dismissing all suggestions, the section collapses/hides
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-006: Push-to-Asana sync

**Description:** As a process owner, after reviewing AI suggestions and making edits, I want to sync my task list back to Asana so that Asana matches what's in the Hub.

**Acceptance Criteria:**

- [ ] "Sync to Asana" button in the task panel header (replaces current "Export to Asana")
- [ ] Sync creates new Asana tasks for any Hub-created tasks with `status = 'active'` and `origin != 'asana'` that don't yet have an `asana_task_gid`
- [ ] New tasks are created in the matching PDCA section in Asana (reuse existing section-mapping logic)
- [ ] After creation, stores `asana_task_gid` and `asana_task_url` on the process_task row
- [ ] If a task was deleted in the Hub (user dismissed it), and it was originally from Asana (`origin = 'asana'`): do NOT delete it from Asana (read-only in B1). Show a note: "Deleted Hub-only. Still exists in Asana."
- [ ] Sync summary shows: "Created X tasks in Asana. Y tasks already synced."
- [ ] Button is disabled if there are no unsynced tasks
- [ ] Button shows loading spinner during sync
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-007: Enhanced health scoring — Execution quality

**Description:** As a process owner, I want my process health score to reflect how well my team is executing tasks — not just whether tasks exist, but whether they have assignees, due dates, and are being completed on time.

**Acceptance Criteria:**

- [ ] Restructure the **Operations** dimension from 15 points to 20 points to add Execution scoring:
  - **Linked to Asana** (3 pts): `asana_project_gid` exists
  - **Status: Approved** (2 pts): process status is `approved`
  - **Tasks have assignees** (4 pts): percentage of active tasks with assignees × 4
  - **Tasks have due dates** (4 pts): percentage of active tasks with due dates × 4
  - **Task completion rate** (4 pts): percentage of total tasks completed × 4
  - **No overdue tasks** (3 pts): 3 if zero overdue, 1 if < 20% overdue, 0 if ≥ 20% overdue
- [ ] Rebalance total to 100 pts by reducing **Maturity** from 25 to 20 points
- [ ] Update `lib/process-health.ts` with new scoring logic
- [ ] Update `lib/fetch-health-data.ts` to query new task fields (assignee, due_date, completed)
- [ ] Health ring and health card show updated scores
- [ ] "Next actions" recommendations include task-related suggestions:
  - "5 tasks have no assignee" → "Assign owners to your tasks"
  - "3 tasks are overdue" → "Review overdue tasks"
  - "8 tasks have no due date" → "Add due dates to your tasks"
- [ ] Typecheck passes

---

### US-008: AI coach task context

**Description:** As a process owner using the AI coach, I want the coach to see my actual Asana tasks so it gives accurate, relevant advice instead of suggesting tasks I already have.

**Acceptance Criteria:**

- [ ] When the AI chat is opened for a process, include synced task data in the system prompt context
- [ ] Task context includes: title, assignee, due date, completion status, section, and description (truncated to first 200 chars per task to manage token usage)
- [ ] AI coach no longer suggests "you need improvement tasks" when tasks already exist
- [ ] AI coach can reference specific existing tasks by name: "I see your 'Quarterly review' task is overdue — consider updating the timeline"
- [ ] If task context exceeds 3000 tokens, summarize: include full details for incomplete/overdue tasks, just titles for completed tasks
- [ ] Typecheck passes

---

### US-009: Manual sync button

**Description:** As a process owner, I want a "Refresh from Asana" button so I can manually trigger a sync when I know tasks have changed, without waiting for the next page load.

**Acceptance Criteria:**

- [ ] "Refresh" button (sync icon) next to the "Last synced" timestamp in the task panel
- [ ] Clicking triggers `POST /api/asana/sync-tasks` and refreshes the task list
- [ ] Button shows spinning animation during sync
- [ ] Disabled for 10 seconds after a sync completes (prevent spam)
- [ ] Success toast: "Synced X tasks from Asana"
- [ ] Error toast if sync fails
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-010: Bulk sync enable for admin

**Description:** As an admin, I want to trigger a task sync for all Asana-linked processes at once, so I don't have to open each process individually to import tasks.

**Acceptance Criteria:**

- [ ] New admin action on `/settings` page: "Sync All Asana Tasks" button
- [ ] Queries all processes where `asana_project_gid IS NOT NULL`
- [ ] Runs `POST /api/asana/sync-tasks` for each process sequentially (to respect Asana rate limits)
- [ ] Shows progress: "Syncing process 3 of 12..."
- [ ] Summary when complete: "Synced 12 processes. 87 tasks imported, 23 updated."
- [ ] Admin-only (uses `AdminGuard` or role check)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: The `process_tasks` table must support tasks from three origins: Asana import, AI suggestion, and manual Hub creation
- FR-2: Asana tasks are imported with: title, description, assignee name, due date, completion status, section, subtask hierarchy, and permalink
- FR-3: Sync occurs automatically on page load (if last sync > 2 minutes ago) and can be triggered manually
- FR-4: ADLI documentation tasks (`[ADLI: Approach]`, etc.) are excluded from import — they are managed by the existing ADLI system
- FR-5: The unified task list replaces the current `TaskReviewPanel`, showing all tasks regardless of origin
- FR-6: AI suggestion tasks are visually distinct and require explicit approval ("Keep") before syncing to Asana
- FR-7: "Sync to Asana" pushes approved Hub-created tasks to the linked Asana project
- FR-8: Health scoring rewards processes with assigned tasks (4 pts), dated tasks (4 pts), completed tasks (4 pts), and no overdue tasks (3 pts)
- FR-9: The AI coach receives task context (titles, status, assignees, due dates) so it can give accurate assessments
- FR-10: Bulk admin sync enables task import for all linked processes in one action
- FR-11: All new fields and UI respect dark mode theming
- FR-12: All API routes require authentication (existing Supabase auth middleware)

## Non-Goals (Out of Scope for B1)

- **Editing Asana tasks from Hub** — no changing titles, descriptions, assignees, or due dates in Hub (that's B2)
- **Marking tasks complete in Hub** — completion status is read-only, synced from Asana (that's B2)
- **Creating tasks directly in Hub** without AI — manual task creation stays as-is (that's B3)
- **Task templates or repeating tasks** — not in scope (that's Phase A)
- **Deleting Asana tasks from Hub** — users can dismiss Hub suggestions, but Asana-origin tasks are read-only
- **Real-time webhooks** — sync is on-demand (page load + manual), not push-based
- **Subtask editing or creation** — subtasks are displayed but not editable
- **Custom fields from Asana** — only standard fields (title, assignee, due date, status) are imported
- **Multi-project processes** — one process links to one Asana project (existing constraint)

## Design Considerations

- **Reuse existing components:** Task cards should extend the current card pattern, not replace it from scratch. Add origin badges and new fields to existing styles.
- **Section organization:** Use Asana's original section names as headers. If a section name matches a PDCA section (case-insensitive: "Plan", "Execute", "Evaluate", "Improve"), apply PDCA color coding automatically. Custom-named sections get a neutral style. Hub-created tasks (AI suggestions) use PDCA sections since that's how the AI generates them.
- **Subtask display:** Subtasks appear indented under their parent task — slightly smaller card with left margin. No expand/collapse mechanics in B1; always visible.
- **Color coding:** Use existing NIA brand colors — teal badge for Asana-origin, orange for AI suggestions, gray for manual.
- **Progressive disclosure:** Completed tasks are collapsed/dimmed by default. Overdue tasks are visually prominent (red due date text).
- **Dark mode:** All new UI must use CSS custom properties (`var(--card)`, `var(--border)`, etc.) — not hardcoded colors.

## Technical Considerations

- **Asana API rate limits:** Asana allows ~150 requests/minute. Bulk sync (US-010) must be sequential with delays. Individual process syncs should batch task fetches.
- **Token management:** Existing `getAsanaToken()` in `lib/asana.ts` handles OAuth token refresh. Sync routes should use this.
- **Pagination:** Asana API returns max 100 items per request. Sync must handle `next_page` pagination for projects with many tasks.
- **Database upserts:** Use Supabase `upsert()` with `asana_task_gid` as the conflict key for efficient sync.
- **AI token budget:** Task context for the AI coach should be capped at ~3000 tokens. Summarize large task lists.
- **Migration safety:** New columns use `ALTER TABLE ADD COLUMN` with defaults — no data loss, no downtime.
- **Existing `process_tasks` rows:** Backfill `origin = 'hub_ai'` for rows where `source IN ('ai_suggestion', 'ai_interview')` and `origin = 'hub_manual'` for `source = 'user_created'`.
- **Assignee email fetching:** Asana's task endpoint returns `assignee.name` but not email by default. Use `opt_fields=assignee.email` or fetch user details separately. Cache user GID→email mappings per workspace to reduce API calls.

## Success Metrics

- Process owners see all their Asana tasks in the Hub without leaving the app
- AI coach gives accurate task-related advice (no more "you need tasks" when tasks exist in Asana)
- Health scores reflect real execution quality — processes with complete, on-time, assigned tasks score higher
- Sync completes in under 5 seconds for a typical process (< 50 tasks)
- Bulk sync handles 20 processes without timeout or rate limit errors
- At least 80% of linked processes have synced task data within one week of launch

## Resolved Decisions

1. **Deleted Asana tasks → Clean removal.** If a task is deleted in Asana between syncs, delete it from the Hub too. Only Asana-origin tasks are auto-deleted; Hub-created tasks are never removed by sync.
2. **Assignee matching → Match by email.** Store assignee email from Asana and match to Hub `user_roles` table by email. This enables richer features (e.g., "My Tasks" filtering) in future phases. Cache Asana user GID→email mappings per workspace.
3. **Section mapping → Keep Asana names, PDCA color matching.** Display Asana's original section names as headers. If a name matches a PDCA section (case-insensitive), apply PDCA color coding. Custom sections get neutral styling. AI-generated tasks use PDCA sections.
4. **Subtask display → Indented under parent.** Subtasks appear as slightly smaller, left-indented cards beneath their parent task. No expand/collapse in B1.
5. **Conflict resolution (B2 future) → Hub wins.** When B2 adds editing, the Hub is authoritative. Sync pulls Asana changes into Hub, user edits in Hub, push overwrites Asana. Last Hub state always wins.
