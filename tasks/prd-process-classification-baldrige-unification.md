# PRD: Process Classification & Baldrige Connections Unification

## Introduction

The NIA Excellence Hub has two problems:

1. **Confusing Baldrige connections:** A legacy `baldrige_connections` JSONB field (hidden, stale) coexists with the newer `process_question_mappings` junction table (powers Criteria Map but invisible on process pages). Users see "Managed automatically" on process pages with no actual data shown.

2. **Ambiguous process classification:** The `is_key` boolean leaves non-key processes unlabeled — Baldrige examiners expect intentional classification of every process as either "Key" (directly creates value) or "Support" (enables key processes).

This PRD unifies both systems: one source of truth for Baldrige connections visible everywhere, and explicit Key/Support classification with AI assistance.

## Goals

- Every process explicitly classified as Key or Support through AI-assisted review
- Baldrige connections visible on every process page (Overview tab), sourced from `process_question_mappings`
- AI-only mapping from both directions (Criteria Map and process pages), with human confirmation
- Legacy `baldrige_connections` field retired from all UI and scoring
- No manual mapping UI — all connections start as AI suggestions

## User Stories

### US-001: Database migration for process_type

**Description:** As a developer, I need a `process_type` field to replace the boolean `is_key` so processes can be explicitly classified as Key, Support, or Unclassified.

**Acceptance Criteria:**

- [ ] Add `process_type TEXT DEFAULT 'unclassified'` column to `processes` table
- [ ] Valid values: `'key'`, `'support'`, `'unclassified'`
- [ ] All existing processes set to `'unclassified'` (including former `is_key = true`)
- [ ] All references to `is_key` across the codebase updated to use `process_type`
- [ ] Readiness page weighting: `process_type === 'key'` gets 2x (same behavior as before)
- [ ] Process list "Key Only" filter updated to use `process_type === 'key'`
- [ ] Typecheck/lint passes

### US-002: Process Classification review flow

**Description:** As an admin, I want AI to suggest Key or Support for every process so I can review and confirm classifications intentionally rather than guessing.

**Acceptance Criteria:**

- [ ] New API endpoint: POST `/api/processes/classify` — AI analyzes all processes and returns Key/Support suggestion + one-line rationale for each
- [ ] AI considers: process charter, description, Baldrige category, ADLI content
- [ ] Review UI on process list page: table showing process name, AI recommendation, rationale
- [ ] Each row has Accept (use AI suggestion) and Override (flip to the other type) buttons
- [ ] "Accept All" button to bulk-accept all AI suggestions
- [ ] "Save Classifications" button persists all choices to database
- [ ] After saving, processes show their new Key/Support labels
- [ ] Typecheck/lint passes
- [ ] Verify in browser

### US-003: Process edit page classification control

**Description:** As a process owner, I want to see and change my process's Key/Support classification on the edit page so I can update it as the process evolves.

**Acceptance Criteria:**

- [ ] Star toggle replaced with segmented control: "Key" / "Support" buttons
- [ ] Key button uses orange accent, Support button uses gray
- [ ] Helper text explains the Baldrige distinction: "Key processes directly create value for stakeholders. Support processes enable key processes to function."
- [ ] Unclassified processes show a prompt: "Classify this process"
- [ ] Saves to `process_type` column on update
- [ ] Typecheck/lint passes
- [ ] Verify in browser

### US-004: Process list classification display

**Description:** As a user, I want to see Key/Support labels on the process list so I can quickly identify process types.

**Acceptance Criteria:**

- [ ] Key processes: orange star icon (same as current)
- [ ] Support processes: subtle gray "Support" label or gear icon
- [ ] Unclassified processes: muted "Unclassified" label with classify nudge
- [ ] Filter options updated: "All" / "Key" / "Support" / "Unclassified"
- [ ] Criteria Map page shows Key/Support badge next to process names in suggestion cards and mapping rows
- [ ] Typecheck/lint passes
- [ ] Verify in browser

### US-005: Health score uses process_question_mappings

**Description:** As the system, the health score Documentation dimension should check real Baldrige mappings instead of the legacy JSONB field.

**Acceptance Criteria:**

- [ ] `lib/process-health.ts` Documentation dimension: replace `baldrige_connections` check with `process_question_mappings` count
- [ ] Process with 1+ mappings in `process_question_mappings` gets 2 points (same weight as before)
- [ ] Process with 0 mappings gets 0 points for that sub-dimension
- [ ] Health score function receives mapping count as input (fetched alongside other data)
- [ ] Typecheck/lint passes

### US-006: Baldrige Connections card on process detail page

**Description:** As a process owner, I want to see which Baldrige questions my process addresses directly on the process page so I don't have to navigate to the Criteria Map.

**Acceptance Criteria:**

- [ ] New "Baldrige Connections" card in Overview tab, right column (below Quick Info)
- [ ] Connections grouped by Baldrige item (e.g., "6.1 Work Processes — 3 questions")
- [ ] Each item row shows question count and highest coverage level badge (primary/supporting/partial)
- [ ] Click item to expand and see individual questions with coverage badges
- [ ] Empty state: "No Baldrige connections yet" with "Find Connections" CTA button
- [ ] "Manage on Criteria Map" link at bottom of card
- [ ] Data fetched from `process_question_mappings` joined to `baldrige_questions` and `baldrige_items`
- [ ] Typecheck/lint passes
- [ ] Verify in browser

### US-007: Find Baldrige Connections from process page

**Description:** As a process owner, I want to ask AI to find Baldrige connections for my specific process so I can map it without leaving the process page.

**Acceptance Criteria:**

- [ ] "Find Baldrige Connections" button on the Baldrige Connections card
- [ ] New API endpoint: POST `/api/criteria/suggest-for-process` — takes `process_id`, analyzes charter + ADLI + description against all questions, returns suggestions
- [ ] AI returns up to 10 suggestions: `{ question_id, question_code, question_text, item_code, item_name, coverage, rationale }`
- [ ] Suggestion cards appear on the process page with Accept/Dismiss buttons
- [ ] Accepted suggestions write to `process_question_mappings` with `mapped_by: 'ai_confirmed'`
- [ ] After accepting, card refreshes to show updated connections
- [ ] Spinner while AI is analyzing
- [ ] Typecheck/lint passes
- [ ] Verify in browser

### US-008: Remove manual mapping from Criteria Map

**Description:** As an admin, I should only see AI-generated suggestions on the Criteria Map — no manual "pick a process" dropdowns — so all mappings have rationale and consistency.

**Acceptance Criteria:**

- [ ] Remove manual "add mapping" dropdown/form from Criteria Map question detail
- [ ] Keep "Suggest Mappings" per-question button (AI-generated)
- [ ] Keep "AI Scan All" bulk button (AI-generated)
- [ ] Keep Accept/Dismiss buttons on suggestion cards
- [ ] Keep "Remove" button on existing mappings (admin can still unlink)
- [ ] Typecheck/lint passes
- [ ] Verify in browser

### US-009: Process edit page Baldrige Connections view

**Description:** As a process owner, I want to see my Baldrige connections on the edit page (read-only) instead of the current dead-end "Managed automatically" message.

**Acceptance Criteria:**

- [ ] Replace "Managed automatically via AI mapping" info box with read-only grouped connections view (same as detail page card)
- [ ] Shows item-grouped connections with coverage badges
- [ ] "Manage on Criteria Map" link
- [ ] No editing of mappings from the edit page
- [ ] Empty state: "No connections yet — use Find Connections on the process page"
- [ ] Typecheck/lint passes
- [ ] Verify in browser

### US-010: Legacy baldrige_connections cleanup

**Description:** As a developer, I need to retire the legacy `baldrige_connections` JSONB field so there's only one source of truth.

**Acceptance Criteria:**

- [ ] Run `/api/criteria/convert-legacy` one final time to migrate any remaining data
- [ ] Remove `baldrige_connections` from health score calculation in `process-health.ts`
- [ ] Remove `baldrige_connections` reads/writes from process edit page save logic
- [ ] Remove `baldrige_connections` from AI chat context building (if present)
- [ ] Stop fetching `baldrige_connections` in any API route or page query
- [ ] Leave the database column in place (no DROP COLUMN — just stop using it)
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Add `process_type` column to `processes` table (`'key'` / `'support'` / `'unclassified'`, default `'unclassified'`)
- FR-2: AI classification endpoint analyzes process charter, description, category, and ADLI content to suggest Key or Support
- FR-3: Classification review UI shows all processes with AI suggestions and Accept/Override controls
- FR-4: Process edit page shows Key/Support segmented control replacing star toggle
- FR-5: Process list shows classification labels and supports filtering by type
- FR-6: Health score Documentation dimension checks `process_question_mappings` count instead of `baldrige_connections`
- FR-7: Process detail page (Overview tab) shows Baldrige connections grouped by item with expand/collapse
- FR-8: "Find Baldrige Connections" button triggers per-process AI scan against all Baldrige questions
- FR-9: All mapping suggestions show rationale and require human Accept/Dismiss
- FR-10: Criteria Map removes manual mapping UI, keeps AI Scan All and per-question Suggest Mappings
- FR-11: Process edit page shows read-only Baldrige connections view
- FR-12: Legacy `baldrige_connections` field removed from all code paths (health score, edit page, AI context)
- FR-13: Criteria Map and Gap Analysis show Key/Support badges next to process names

## Non-Goals

- No new database tables (reuses existing `process_question_mappings`)
- No changes to the draft/narrative system
- No changes to Asana sync
- No changes to survey system
- No schema deletion of the `baldrige_connections` column (just stop using it)
- No auto-classification without human confirmation

## Technical Considerations

- `process_type` replaces `is_key` in ~15 files across the codebase (process list, dashboard, readiness, edit page, data health, ADLI insights, etc.)
- The per-process AI scan endpoint (`/api/criteria/suggest-for-process`) should reuse the same Claude prompt pattern as the existing `/api/criteria/ai-suggest` but reverse the direction (given process, find questions)
- Rate limiting already exists on AI routes — new endpoints should use `checkRateLimit()`
- The classification review flow is a one-time use feature but should remain accessible for re-classification as processes evolve

## Success Metrics

- Every process has an explicit Key or Support classification (0 unclassified)
- Process pages show Baldrige connections without navigating to Criteria Map
- Health score uses real mapping data instead of stale legacy field
- No references to `baldrige_connections` in any UI code path

## Open Questions

- None — all resolved during brainstorming session
