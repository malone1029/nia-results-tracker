# PRD: AI Process Builder + Smart Asana Sync

## Introduction

Transform the AI coach from a text-improvement tool into a **process builder** that generates actionable tasks across PDCA sections (Plan, Execute, Evaluate, Improve). Today, AI suggestions only update ADLI text and drop a single task into Asana's Improve section. In reality, most suggestions require operational work across multiple sections — training programs need planning AND execution, surveys need design AND evaluation.

This feature makes the AI generate concrete tasks that land in the correct Asana sections, so team members can assign owners, set due dates, and track progress. The ADLI assessment remains — but now it creates proof-tasks that demonstrate maturity in action, not just in documentation.

**The core principle:** ADLI text is the strategy. Asana tasks are the execution. You need both.

## Goals

- AI suggestions generate **multiple actionable tasks** mapped to PDCA sections (Plan, Execute, Evaluate, Improve)
- AI can **interview users** about their process steps and generate tasks from the conversation
- AI still **updates process text** (charter, ADLI sections) when applying suggestions
- A **task review screen** lets users see all proposed tasks by PDCA section before exporting
- **Export to Asana** places tasks in the correct sections, ready for assignees and due dates
- Each task preserves its **ADLI dimension** context so users know which aspect of maturity it supports
- ADLI assessment and scoring **remain unchanged** — this builds on top of them

## User Stories

### US-001: Enhanced AI Suggestion Format with Tasks

**Description:** As a process owner, I want AI suggestions to include concrete tasks so I know exactly what actions to take, not just what text to change.

**Acceptance Criteria:**

- [ ] AI system prompt updated to generate tasks alongside content improvements
- [ ] Each suggestion includes a `tasks` array with 1-5 tasks
- [ ] Each task has: `title`, `description`, `pdcaSection` (plan/execute/evaluate/improve), `adliDimension` (approach/deployment/learning/integration)
- [ ] AI maps ADLI improvements to appropriate PDCA sections using the mapping logic (see FR-2)
- [ ] Backward-compatible: suggestions without tasks still work (old format)
- [ ] Structured output uses a new `coach-suggestions` format that includes tasks
- [ ] Typecheck/lint passes

### US-002: Task Preview in Suggestion Cards

**Description:** As a process owner, I want to see what tasks will be created before I apply a suggestion, so I understand the work involved.

**Acceptance Criteria:**

- [ ] Each CoachSuggestionCard shows the proposed tasks below the "why it matters" section
- [ ] Tasks display their PDCA section as a colored badge (Plan=blue, Execute=green, Evaluate=amber, Improve=purple)
- [ ] Tasks display their ADLI dimension as a subtle label
- [ ] If no tasks in a suggestion, card looks the same as today (backward-compatible)
- [ ] Typecheck/lint passes

### US-003: Pending Tasks Table and API

**Description:** As a developer, I need to store proposed tasks in the database so they persist across sessions and can be reviewed before export.

**Acceptance Criteria:**

- [ ] New `process_tasks` table with columns: id, process_id, title, description, pdca_section, adli_dimension, source, source_detail, status (pending/exported), asana_task_gid, asana_task_url, created_at
- [ ] SQL migration file created (migration-011)
- [ ] RLS policies: authenticated users can CRUD
- [ ] New API route `/api/tasks` with GET (by processId), POST (create), PATCH (update), DELETE
- [ ] GET returns tasks grouped by pdca_section
- [ ] Typecheck/lint passes

### US-004: Smart Apply with Task Queuing

**Description:** As a process owner, when I click "Apply This" on a suggestion, I want the process text updated AND the proposed tasks queued for review — not immediately pushed to Asana.

**Acceptance Criteria:**

- [ ] "Apply This" still updates process field content (unchanged behavior)
- [ ] "Apply This" still creates improvement history record (unchanged behavior)
- [ ] "Apply This" now also inserts tasks from the suggestion into `process_tasks` table with status "pending"
- [ ] Tasks are NOT immediately sent to Asana (removed from apply endpoint)
- [ ] Chat success message updated: "Applied! X tasks queued for review." instead of Asana-specific message
- [ ] Suggestion cards are removed from pending list after apply (unchanged behavior)
- [ ] `onProcessUpdated` callback still fires (unchanged behavior)
- [ ] Typecheck/lint passes

### US-005: Task Review Screen

**Description:** As a process owner, I want to review all pending tasks grouped by PDCA section before exporting to Asana, so I can edit or remove tasks that don't fit.

**Acceptance Criteria:**

- [ ] New **tab** on the process detail page (alongside existing content tabs)
- [ ] Shows pending tasks grouped into 4 columns/sections: Plan, Execute, Evaluate, Improve
- [ ] Each task card shows: title, description, ADLI dimension badge, source (AI suggestion vs interview)
- [ ] User can delete a task (removes from `process_tasks`)
- [ ] User can edit a task's title and description inline
- [ ] User can drag or move a task to a different PDCA section
- [ ] Shows count of pending tasks as a badge on the review button
- [ ] Empty state when no pending tasks: "No tasks queued. Use the AI coach to generate improvement tasks."
- [ ] "Export All to Asana" button at the top (see US-007)
- [ ] Typecheck/lint passes

### US-006: AI Process Step Interview

**Description:** As a process owner, I want the AI to ask me questions about my process steps and generate Plan/Execute/Evaluate tasks from my answers, so the AI helps me build out my operational task list.

**Acceptance Criteria:**

- [ ] New quick action button in AI chat: "Build Task List" (alongside existing Analyze/Coach/Interview buttons)
- [ ] AI enters interview mode: asks about key steps, who does what, how success is measured, review cadence
- [ ] After 3-5 exchanges, AI generates a batch of tasks with PDCA section assignments
- [ ] Tasks are presented using a new structured block (e.g., ` ```proposed-tasks` ` `)
- [ ] User sees task cards in the chat with "Queue All" and "Queue" (individual) buttons
- [ ] Queued tasks are inserted into `process_tasks` table
- [ ] AI also updates process text (charter, ADLI sections) based on interview answers
- [ ] Typecheck/lint passes

### US-007: Export Pending Tasks to Asana

**Description:** As a process owner, I want to export all pending tasks to Asana in the correct PDCA sections, so my team can assign owners and due dates.

**Acceptance Criteria:**

- [ ] "Export to Asana" button on the task review screen
- [ ] If process is not linked to Asana: prompts to link/create (reuses existing export dialog logic)
- [ ] Creates tasks in the correct PDCA section (Plan/Execute/Evaluate/Improve) based on `pdca_section` field
- [ ] Task name format: `[ADLI: Learning] Design quarterly survey` (includes ADLI dimension)
- [ ] Task notes include: description + "View process: {url}"
- [ ] After successful export, updates `process_tasks` records: status → "exported", stores asana_task_gid and asana_task_url
- [ ] Shows success summary: "Exported X tasks to Asana (Y Plan, Z Execute, ...)"
- [ ] Exported tasks still visible on review screen but marked as "exported" (greyed out, with Asana link icon)
- [ ] Non-blocking: if individual task creation fails, others still proceed
- [ ] Typecheck/lint passes

### US-008: ADLI-to-PDCA Mapping Logic

**Description:** As a developer, I need clear mapping rules so the AI consistently places tasks in the right PDCA sections.

**Acceptance Criteria:**

- [ ] Mapping rules defined in the AI system prompt (see FR-2 for full mapping)
- [ ] AI can override default mapping when context demands it (e.g., "training" could be Plan or Execute depending on context)
- [ ] AI can split a single improvement into multiple tasks across sections (e.g., "Create training" → Plan: design training + Execute: deliver training)
- [ ] Mapping documented in system prompt with examples
- [ ] Typecheck/lint passes

## Functional Requirements

- **FR-1:** New `process_tasks` table stores pending and exported tasks with PDCA section, ADLI dimension, Asana link, and status
- **FR-2:** ADLI-to-PDCA mapping rules for the AI:
  - **Approach** improvements → primarily **Plan** (design/document the method) + sometimes **Execute** (implement the method)
  - **Deployment** improvements → primarily **Execute** (roll out, train, communicate) + sometimes **Plan** (design the rollout)
  - **Learning** improvements → primarily **Evaluate** (measure, survey, review) + sometimes **Plan** (design the measurement)
  - **Integration** improvements → primarily **Plan** (align with strategy, connect to other processes) + sometimes **Evaluate** (assess alignment)
  - **General/Charter** improvements → AI determines best section based on task nature
- **FR-3:** AI system prompt includes the mapping rules and examples so suggestions consistently generate well-placed tasks
- **FR-4:** `/api/ai/apply` endpoint inserts tasks into `process_tasks` instead of directly creating Asana tasks
- **FR-5:** `/api/tasks` CRUD endpoint for managing pending tasks
- **FR-6:** Task review UI shows tasks in 4 PDCA columns with edit/delete/move capabilities
- **FR-7:** Export endpoint reads from `process_tasks` where status = "pending", creates Asana tasks in correct sections, marks as "exported"
- **FR-8:** AI interview mode generates `proposed-tasks` structured blocks that can be queued individually or in bulk
- **FR-9:** Suggestion cards in the chat panel show task previews (title + PDCA badge) below the existing content
- **FR-10:** "Apply This" success message reflects task queuing: "Applied! 3 tasks queued for review (1 Plan, 1 Execute, 1 Evaluate)"
- **FR-11:** Task count badge shown on the review button/section header so users know tasks are waiting
- **FR-12:** Exported tasks retain Asana link (gid + url) for future reference and deduplication

## Non-Goals (Out of Scope)

- **No assignee selection in the Hub** — assignees and due dates are set in Asana (4A)
- **No real-time sync back from Asana** — tasks are exported one-way; status updates happen in Asana
- **No drag-and-drop task reordering within a section** — just move between sections
- **No AI-generated timelines or schedules** — AI suggests tasks, humans set dates
- **No changes to ADLI scoring** — assessment and scoring remain exactly as they are
- **No changes to the existing Asana export dialog** — the 3-option dialog (sync/link/create) is reused
- **No automatic re-export** — user explicitly triggers export each time

## Design Considerations

- **Task review screen:** Inline on the process page as a new tab or collapsible section, NOT a separate page. Keeps context close to the process.
- **PDCA section colors:** Use consistent colors across the app:
  - Plan: `nia-grey-blue` (#55787c)
  - Execute: `nia-green` (#b1bd37)
  - Evaluate: `nia-orange` (#f79935)
  - Improve: `nia-dark` (#2d3436)
- **Task cards:** Minimal — title, description preview, PDCA badge, ADLI label. No heavy UI.
- **Reuse existing components:** Suggestion cards, Asana export dialog, improvement cards for visual consistency

## Technical Considerations

- **Migration-011:** New `process_tasks` table. Keep it simple — no foreign keys to improvements (tasks can come from interviews too)
- **AI structured output:** Extend `coach-suggestions` format to include `tasks` array. Handle backward compatibility (suggestions without tasks still work)
- **New structured block:** `proposed-tasks` for interview-generated tasks (separate from coach-suggestions since they don't update process text)
- **Export endpoint changes:** The existing `/api/asana/export` handles project creation and section management. The new task export can extend this or be a separate endpoint (`/api/tasks/export`)
- **Non-blocking pattern:** Continue the pattern where Asana failures don't block Hub operations
- **Stale task cleanup:** Tasks with status "pending" older than 30 days could be auto-cleaned (future consideration, not in scope)

## Implementation Order

Build in this sequence (each layer builds on the previous):

1. **Layer 1 (Foundation):** US-003 (process_tasks table + API) → US-008 (mapping logic)
2. **Layer 2 (AI Changes):** US-001 (enhanced suggestion format) → US-002 (task preview in cards)
3. **Layer 3 (Apply Flow):** US-004 (smart apply with task queuing)
4. **Layer 4 (Review):** US-005 (task review screen)
5. **Layer 5 (Interview):** US-006 (AI process step interview)
6. **Layer 6 (Export):** US-007 (export pending tasks to Asana)

## Success Metrics

- Process owners can go from "empty process" to "fully documented with actionable Asana tasks" in a single AI session
- AI suggestions generate an average of 2-3 tasks each, spread across at least 2 PDCA sections
- Users export tasks to Asana within the same session (not abandoning the review screen)
- Reduction in "empty" Asana sections — tasks now appear in Plan, Execute, and Evaluate (not just Improve)

## Resolved Decisions

1. **Task review screen = tab** on the process detail page (alongside existing content)
2. **"Apply All" queues all tasks** from all suggestions at once
3. **Re-export uses stale-check pattern:** On re-export, check each exported task's `asana_task_gid` against Asana. If deleted (404), re-create. If still exists, skip. Same pattern as current improvement backfilling — safe to run repeatedly.
4. **Exported tasks do NOT appear in improvement history.** Improvement history tracks meaningful process maturity changes (ADLI text updates). Task review tracks operational work items. These are different concerns and stay separate.

## Future Considerations (Out of Scope)

- **Sync status button (Level B):** Check all exported tasks, show report ("12 in Asana, 2 deleted"), offer to re-add deleted ones
- **Two-way sync (Level C):** Task completion in Asana updates status in the Hub via webhooks/polling — separate feature entirely
