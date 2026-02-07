# PRD: NIA Excellence Hub (Phase 1)

## Introduction

Rename and transform the NIA Results Tracker into a unified "NIA Excellence Hub" by adding process documentation and management capabilities. Currently, NIA's 14+ organizational processes live as markdown files in an Obsidian vault, metrics live in the Results Tracker (Supabase), and AI-guided process improvement lives in a separate Process Builder app. This creates fragmentation — three tools, no single source of truth.

Phase 1 combines process documentation with the existing metrics tracker into one app. Users can create, edit, and manage process documents directly in the app, link them to existing metrics and key requirements, and see at a glance which Baldrige categories have gaps. This lays the foundation for AI-guided improvement (Phase 2) and application readiness tracking (Phase 3).

**What this is NOT:** This phase does not include AI features, team collaboration/auth, or Asana import/export. Those come in later phases.

## Goals

- Provide a single web app where NIA processes are documented, tracked, and linked to performance metrics
- Support two documentation tiers: Quick capture (simple) and Full ADLI template (comprehensive Baldrige framework)
- Enable a clear status workflow (Draft → Approved) matching NIA's existing process
- Visualize Baldrige category coverage so gaps (like Category 3 - Customers) are immediately obvious
- Migrate existing process documents from the Obsidian vault into the database
- Maintain all existing Results Tracker functionality — nothing breaks

## Phases Overview

| Phase | Focus | Key Features |
|-------|-------|-------------|
| **1 (this PRD)** | Core process management | CRUD, Quick/Full templates, status workflow, metrics linking, inventory dashboard, Obsidian import |
| **2 (future)** | AI + collaboration | AI-guided process improvement, team review with auth, Asana XLSX import/export, comments |
| **3 (future)** | Application readiness | Lincoln Award readiness view, handoff criteria tracking, category completeness scoring |

---

## User Stories

### US-001: Extend process database schema

**Description:** As a developer, I need to extend the existing `processes` table with fields for process documentation so that the app can store full process details in Supabase.

**Acceptance Criteria:**
- [ ] Add new columns to the existing `processes` table via Supabase SQL migration:
  - `status` (text, default 'draft') — one of: 'draft', 'ready_for_review', 'in_review', 'revisions_needed', 'approved'
  - `template_type` (text, default 'quick') — one of: 'quick', 'full'
  - `owner` (text, nullable) — person responsible for the process
  - `reviewer` (text, nullable) — person who reviews/approves
  - `charter` (jsonb, nullable) — `{purpose, scope_includes, scope_excludes, stakeholders, mission_alignment}`
  - `basic_steps` (jsonb, nullable) — array of step strings (Quick template)
  - `participants` (jsonb, nullable) — array of role/name strings (Quick template)
  - `metrics_summary` (text, nullable) — "How do we know it's working?" (Quick template)
  - `connections` (text, nullable) — "What does this connect to?" (Quick template)
  - `adli_approach` (jsonb, nullable) — Approach dimension details
  - `adli_deployment` (jsonb, nullable) — Deployment dimension details
  - `adli_learning` (jsonb, nullable) — Learning dimension details
  - `adli_integration` (jsonb, nullable) — Integration dimension details
  - `workflow` (jsonb, nullable) — `{inputs, steps[], outputs, quality_controls}`
  - `baldrige_connections` (jsonb, nullable) — `{questions_addressed[], evidence_by_dimension}`
  - `updated_at` (timestamptz, default now())
- [ ] Create `process_requirements` junction table linking processes to key_requirements (many-to-many)
- [ ] Create `process_history` table: `id`, `process_id` (FK), `version` (text), `change_description` (text), `changed_at` (timestamptz)
- [ ] Add RLS policies matching existing pattern (public read/write)
- [ ] Update `lib/types.ts` with new TypeScript interfaces
- [ ] Existing processes data and metrics relationships are preserved (no data loss)
- [ ] Existing process rows are auto-tagged with `template_type = 'quick'` and `status = 'draft'`
- [ ] Typecheck passes

---

### US-002: Rename app to NIA Excellence Hub

**Description:** As a user, I want the app to be called "NIA Excellence Hub" instead of "NIA Results Tracker" so the name reflects its expanded purpose.

**Acceptance Criteria:**
- [ ] Update the page title/metadata (HTML `<title>`, Open Graph tags if any) to "NIA Excellence Hub"
- [ ] Update the header text in `layout.tsx` to "NIA Excellence Hub"
- [ ] Update any references to "Results Tracker" in the UI to "Excellence Hub"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-003: Add Processes section to navigation

**Description:** As a user, I want to see a "Processes" link in the navigation so I can access process management alongside the existing metrics features.

**Acceptance Criteria:**
- [ ] Add "Processes" link to the nav bar (between "Key Requirements" and "Categories")
- [ ] Links to `/processes` route
- [ ] Active state styling matches existing nav pattern (orange text when active)
- [ ] Works on both desktop and mobile nav
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-004: Process inventory list page

**Description:** As a user, I want to see all my processes in a list so I can quickly find and manage them.

**Acceptance Criteria:**
- [ ] Page at `/processes` shows all processes from the database
- [ ] Each process row shows: name, Baldrige category, status badge, template type (Quick/Full), owner
- [ ] Status badges use colored indicators matching the existing workflow:
  - Draft = red/muted
  - Ready for Review = orange
  - In Review = yellow
  - Revisions Needed = purple
  - Approved = green
- [ ] Filter by Baldrige category (dropdown: All, 1-Leadership, 2-Strategy, etc.)
- [ ] Filter by status (dropdown: All, Draft, Ready for Review, etc.)
- [ ] "Create New Process" button at the top
- [ ] Clicking a process name navigates to its detail page (`/processes/[id]`)
- [ ] Empty state message when no processes exist yet
- [ ] Follows existing UI patterns (white cards, orange left border on sections)
- [ ] Mobile-responsive (stacked cards on small screens)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-005: Baldrige coverage summary on process list

**Description:** As a user, I want to see which Baldrige categories have processes and which have gaps, so I know where to focus my effort.

**Acceptance Criteria:**
- [ ] At the top of the `/processes` page, show a 6-cell grid (one per Baldrige category 1-6)
- [ ] Each cell shows: category name, number of processes, number approved
- [ ] Color coding: green if at least 1 approved process, yellow if processes exist but none approved, red if zero processes
- [ ] Categories 3 (Customers) and 4 (Measurement) should show red since they currently have zero processes
- [ ] Clicking a category cell filters the list below to that category
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-006: Create new process (Quick template)

**Description:** As a user, I want to create a new process using the Quick template so I can capture the basics without getting overwhelmed by the full ADLI framework.

**Acceptance Criteria:**
- [ ] "Create New Process" button on `/processes` navigates to `/processes/new`
- [ ] Form fields:
  - Process name (required, text input)
  - Baldrige category (required, dropdown of categories 1-6)
  - Baldrige item (optional, text input — e.g., "1.1a")
  - Owner (optional, text input)
  - Description: "What is this process?" (textarea)
  - Basic steps: "How do we do it?" (add/remove/reorder list of text inputs)
  - Participants: "Who's involved?" (add/remove list of text inputs)
  - Metrics summary: "How do we know it's working?" (textarea)
  - Connections: "What does this connect to?" (textarea)
- [ ] Saves to database with `template_type = 'quick'` and `status = 'draft'`
- [ ] After save, redirects to the process detail page
- [ ] Validation: process name is required, category is required
- [ ] Cancel button returns to process list
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-007: Process detail page

**Description:** As a user, I want to view a single process with all its details so I can read and understand the full documentation.

**Acceptance Criteria:**
- [ ] Page at `/processes/[id]` shows the full process document
- [ ] Header section shows: process name, status badge, template type, Baldrige category & item, owner, reviewer
- [ ] "Edit" button navigates to edit mode
- [ ] "Back to Processes" link returns to the list
- [ ] **Quick template** displays: description, basic steps (numbered list), participants, metrics summary, connections
- [ ] **Full template** displays all Quick fields plus: charter section, ADLI sections (Approach, Deployment, Learning, Integration), workflow section, Baldrige connections
- [ ] Sections that are empty/null show "Not yet documented" in muted text
- [ ] Shows linked metrics (from existing `metrics` table where `process_id` matches) with latest values
- [ ] Shows linked key requirements (from `process_requirements` junction table)
- [ ] Shows process history/changelog if any entries exist
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-008: Edit process

**Description:** As a user, I want to edit any field of a process so I can improve the documentation over time.

**Acceptance Criteria:**
- [ ] "Edit" button on process detail page navigates to `/processes/[id]/edit`
- [ ] Pre-populates all form fields with current values
- [ ] Same form layout as create, but with additional fields visible based on template type
- [ ] Can change status via a dropdown (follows the workflow order but allows any transition for now)
- [ ] Can change template type from Quick to Full (one-way — see US-009)
- [ ] Save button updates the database and redirects to detail page
- [ ] Cancel button returns to detail page without saving
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-009: Upgrade process from Quick to Full ADLI template

**Description:** As a user, I want to upgrade a Quick process to the Full ADLI template so I can add comprehensive documentation as the process matures.

**Acceptance Criteria:**
- [ ] On the edit page for a Quick-template process, show an "Upgrade to Full Template" button
- [ ] Clicking it reveals the additional Full template sections: Charter, ADLI (4 sections), Workflow, Baldrige Connections
- [ ] Existing Quick template data is preserved (description, steps, participants, etc.)
- [ ] The `template_type` field updates to 'full' on save
- [ ] This is a one-way upgrade — Full templates cannot be downgraded to Quick
- [ ] Confirmation prompt before upgrading: "This will add ADLI framework sections to this process. Continue?"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-010: ADLI section editors

**Description:** As a user, I want structured editors for each ADLI section so I can document my process using the Baldrige framework without needing to know the JSON structure.

**Acceptance Criteria:**
- [ ] Each ADLI section (Approach, Deployment, Learning, Integration) has its own collapsible card on the edit page
- [ ] **Approach** fields: evidence_base (textarea), key_steps (add/remove list), tools_used (add/remove list), key_requirements (textarea)
- [ ] **Deployment** fields: teams (add/remove list), communication_plan (textarea), training_approach (textarea), consistency_mechanisms (textarea)
- [ ] **Learning** fields: metrics (add/remove list), evaluation_methods (textarea), review_frequency (text input), improvement_process (textarea)
- [ ] **Integration** fields: strategic_goals (add/remove list), mission_connection (textarea), related_processes (add/remove list), standards_alignment (textarea)
- [ ] Sections start collapsed, expand on click (matching existing UI pattern)
- [ ] Each section shows a completion indicator (e.g., "3 of 4 fields filled")
- [ ] Data saves as structured JSONB to the corresponding `adli_*` column
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-011: Link processes to key requirements

**Description:** As a user, I want to link processes to key requirements so I can see which stakeholder needs each process addresses.

**Acceptance Criteria:**
- [ ] On the process detail/edit page, show a "Linked Key Requirements" section
- [ ] Displays currently linked requirements with stakeholder group and requirement name
- [ ] "Link Requirement" button opens a picker showing all key requirements from the database
- [ ] Can select multiple requirements to link at once
- [ ] Can remove a linked requirement
- [ ] Links are stored in the `process_requirements` junction table
- [ ] On the Key Requirements page (existing), show which processes are linked to each requirement
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-012: Status workflow controls

**Description:** As a user, I want to change a process's status with clear visual feedback so I can track where each process is in the review pipeline.

**Acceptance Criteria:**
- [ ] On the process detail page, show the status workflow as a horizontal stepper/progress bar:
  Draft → Ready for Review → In Review → Revisions Needed → Approved
- [ ] Current status is highlighted; completed statuses are filled
- [ ] "Advance Status" button moves to the next logical status
- [ ] "Revisions Needed" button available during "In Review" status (sends back)
- [ ] Status change updates the database immediately
- [ ] Status change is recorded in `process_history` table with timestamp
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-013: Charter section editor

**Description:** As a user, I want to fill out the Charter section for a Full-template process so I can document the process's purpose and scope.

**Acceptance Criteria:**
- [ ] Charter section appears as a collapsible card on the edit page (Full template only)
- [ ] Fields: purpose (textarea), scope_includes (textarea), scope_excludes (textarea), stakeholders (add/remove list), mission_alignment (textarea)
- [ ] Data saves as structured JSONB to the `charter` column
- [ ] Displays nicely on the detail page with field labels
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-014: Workflow section editor

**Description:** As a user, I want to document the detailed workflow for a Full-template process so I can capture inputs, steps, outputs, and quality controls.

**Acceptance Criteria:**
- [ ] Workflow section appears as a collapsible card on the edit page (Full template only)
- [ ] Fields:
  - Inputs (add/remove list of text items)
  - Steps (add/remove/reorder list, each step has: responsible (text), action (textarea), output (text), timing (text))
  - Outputs (add/remove list of text items)
  - Quality controls (add/remove list of text items)
- [ ] Data saves as structured JSONB to the `workflow` column
- [ ] Detail page displays workflow as a clean numbered step list with role/timing info
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-015: Import processes from Obsidian vault

**Description:** As a user, I want to import my existing process documents from the Obsidian vault so I don't have to re-enter everything manually.

**Acceptance Criteria:**
- [ ] Admin page or script at `/processes/import` (doesn't need to be pretty — one-time use)
- [ ] Upload or paste markdown content from an Obsidian process document
- [ ] Parser extracts: process name, category, status, charter fields, ADLI sections, workflow steps, Baldrige Connections (questions addressed, evidence by ADLI dimension)
- [ ] Shows a preview of parsed data before saving
- [ ] "Import" button saves to database
- [ ] Handles both Quick and Full template formats (detects based on content)
- [ ] Can import multiple files in sequence
- [ ] Imported processes appear in the process list with correct category assignment
- [ ] If a process with the same name already exists in that category, show a warning (don't silently overwrite)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-016: Delete process

**Description:** As a user, I want to delete a process I created by mistake so I can keep my process list clean.

**Acceptance Criteria:**
- [ ] "Delete" button on process detail page (styled as destructive/red)
- [ ] Confirmation dialog: "Are you sure you want to delete [process name]? This cannot be undone."
- [ ] Deleting a process also removes its `process_requirements` links and `process_history` entries (cascade)
- [ ] Does NOT delete linked metrics (metrics remain, just lose the process_id link)
- [ ] After deletion, redirects to process list
- [ ] Typecheck passes

---

## Functional Requirements

- FR-1: Rename app from "NIA Results Tracker" to "NIA Excellence Hub" (titles, header, metadata)
- FR-2: Extend the existing `processes` table with documentation fields (status, template_type, owner, reviewer, charter, ADLI sections, workflow, etc.)
- FR-3: Create `process_requirements` junction table (processes ↔ key_requirements, many-to-many)
- FR-4: Create `process_history` table for tracking status changes and edits
- FR-5: Display processes in a filterable list at `/processes` with status badges and category indicators
- FR-6: Show Baldrige category coverage grid highlighting gaps (zero-process categories in red)
- FR-7: Support two template tiers: Quick (5 simple fields) and Full (Quick + Charter + ADLI + Workflow + Baldrige Connections)
- FR-8: Allow one-way upgrade from Quick → Full template
- FR-9: Provide structured form editors for each ADLI dimension (Approach, Deployment, Learning, Integration)
- FR-10: Provide structured form editors for Charter and Workflow sections
- FR-11: Support the 5-stage status workflow: Draft → Ready for Review → In Review → Revisions Needed → Approved
- FR-12: Link processes to existing key requirements via junction table
- FR-13: Display linked metrics on process detail pages (using existing `metrics.process_id` relationship)
- FR-14: Record status changes and edits in process history
- FR-15: Import process documents from Obsidian markdown format (including Baldrige Connections)
- FR-16: All existing Results Tracker pages and functionality remain unchanged

## Non-Goals (Out of Scope for Phase 1)

- **No AI features** — AI-guided process improvement, ADLI gap analysis, and chat-based development are Phase 2
- **No user authentication** — No login, roles, or team accounts. Single-user access like the current app
- **No Asana import/export** — XLSX import/export from the Process Builder is Phase 2
- **No comments or review threads** — Team collaboration features are Phase 2
- **No application readiness view** — Lincoln Award readiness tracking is Phase 3
- **No real-time notifications** — No alerts when status changes or reviews are needed
- **No process versioning/diffing** — History tracks what changed, but no side-by-side comparison
- **No drag-and-drop reordering** — Simple add/remove lists for steps, not drag-and-drop

## Design Considerations

- **Reuse existing UI patterns:** White cards with orange left border (`border-l-4 border-[#f79935]`), collapsible sections, NIA brand colors
- **Mobile-first:** All new pages need the dual-layout pattern (table on desktop, stacked cards on mobile) matching existing pages
- **NIA brand colors:** `#324a4d` (dark teal primary), `#55787c` (medium teal), `#b1bd37` (green/success), `#f79935` (orange/accent), `#dc2626` (red/alert)
- **Status badge colors:** Draft=#9ca3af (gray), Ready for Review=#f79935 (orange), In Review=#eab308 (yellow), Revisions Needed=#a855f7 (purple), Approved=#b1bd37 (NIA green)
- **ADLI section cards** should feel similar to the existing collapsible metric cards — familiar, not a new pattern
- **Form interactions:** Keep forms simple. Text inputs, textareas, and add/remove lists. No rich text editors, no drag-and-drop, no WYSIWYG

## Technical Considerations

- **Database:** Extend existing Supabase schema. Use ALTER TABLE for new columns on `processes`. JSONB for complex nested data (charter, ADLI sections, workflow) — this avoids an explosion of related tables while keeping data queryable
- **Existing `processes` table already has data** — migration must be non-destructive. New columns should all be nullable or have sensible defaults
- **Existing `metrics.process_id`** already links metrics to processes — no new junction table needed for that relationship
- **File structure:** New pages go in `app/processes/`, new components in `app/processes/components/` (or shared `components/` if reusable)
- **No new dependencies required** — this is standard Next.js + Supabase CRUD
- **RLS policies** must be added for new tables, matching the existing "public read/write" pattern

## Success Metrics

- All 14+ existing Obsidian process documents successfully imported into the database
- User can create a new Quick process in under 2 minutes
- Baldrige coverage grid immediately shows Category 3 and 4 gaps in red
- Existing Results Tracker pages work identically (no regressions)
- Process detail page loads linked metrics from the existing database

## Resolved Questions

1. **App rename:** Rename to "NIA Excellence Hub" in Phase 1. Update page titles, header, and metadata.
2. **Obsidian import includes Baldrige Connections:** Yes — import the Baldrige Connections section (questions addressed, evidence by ADLI dimension). This data is essential for Phase 3 application writing features.
3. **Existing process rows:** Auto-tag existing rows with `template_type = 'quick'` and `status = 'draft'` during migration so they appear properly in the new process list and are ready to be fleshed out.
