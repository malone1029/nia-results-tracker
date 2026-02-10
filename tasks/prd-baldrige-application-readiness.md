# PRD: Baldrige Application Readiness (Phase 3)

## Introduction

Bring Baldrige criteria intelligence into the NIA Excellence Hub so that Jon (admin) can systematically map every Baldrige criteria question to the process(es) that answer it, identify gaps where no process exists, create new processes to fill those gaps, and generate draft application narratives from mapped processes.

The Baldrige Excellence Framework (2023-2024 Business/Nonprofit) has 17 items across Categories P, 1-7, each containing sub-items and detailed questions. The answer to every Baldrige process question (Categories 1-6) is a process — this feature ensures every question has a well-documented process answer and provides AI assistance throughout.

**Target:** 25-page Illinois Lincoln Award application, Fall 2026.

## Goals

- Store all Baldrige criteria questions (2023-2024 Business/Nonprofit, full criteria — not Excellence Builder) in the database with their hierarchical structure
- Enable AI-assisted mapping of processes to specific Baldrige sub-questions
- Show gap analysis: which questions have no process mapped, which have weak coverage
- When a gap exists, help the user either find an existing process or create a new one with AI guidance
- Generate draft narrative text per Baldrige item from the mapped processes' ADLI content
- Restrict all Phase 3 features to admin users via a role system
- Import existing mappings from the Obsidian vault as a starting point

## User Stories

### Layer 0: Role System

#### US-001: User roles table and middleware
**Description:** As a developer, I need a role system so that certain features can be restricted to admin users only.

**Acceptance Criteria:**
- [ ] Create `user_roles` table with columns: `id`, `auth_id` (FK to Supabase auth.users), `email` (text), `role` (text: 'admin' | 'member', default 'member'), `created_at`
- [ ] Seed Jon's email (`jon.malone@thenia.org`) as `admin` role
- [ ] Create `/api/auth/role` GET endpoint that returns the current user's role
- [ ] Add RLS policy: users can only read their own role row
- [ ] Create `lib/use-role.ts` client hook: fetches role once, caches in state, exposes `isAdmin` boolean
- [ ] SQL migration file created (`migration-014-user-roles.sql`)
- [ ] Typecheck passes

#### US-002: Admin-only sidebar navigation
**Description:** As an admin, I want to see Phase 3 pages in the sidebar. As a member, I should not see them.

**Acceptance Criteria:**
- [ ] Sidebar conditionally renders "Application" section (with sub-links) only when `isAdmin` is true
- [ ] Application section contains links: "Criteria Map" (`/criteria`), "Gap Analysis" (`/criteria/gaps`)
- [ ] Non-admin users see no change to their sidebar
- [ ] Direct URL access to `/criteria` or `/criteria/gaps` by non-admin redirects to `/`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### Layer 1: Baldrige Criteria Question Bank

#### US-003: Criteria database schema
**Description:** As a developer, I need database tables to store the Baldrige criteria hierarchy so that questions can be mapped to processes.

**Acceptance Criteria:**
- [ ] Create `baldrige_items` table: `id` (serial PK), `item_code` (text, unique — e.g., "1.1", "P.1"), `item_name` (text), `category_number` (int — 0 for P, 1-7), `category_name` (text), `item_type` (text: 'process' | 'results' | 'profile'), `points` (int), `sort_order` (int)
- [ ] Create `baldrige_questions` table: `id` (serial PK), `item_id` (FK to baldrige_items), `question_code` (text, unique — e.g., "1.1a(1)", "P.1b(2)"), `area_label` (text — e.g., "Mission, Vision, and Values"), `question_text` (text — the full question), `question_type` (text: 'context' | 'process' | 'results'), `sort_order` (int)
- [ ] Create `process_question_mappings` table: `id` (serial PK), `process_id` (FK to processes), `question_id` (FK to baldrige_questions), `coverage` (text: 'primary' | 'supporting' | 'partial'), `notes` (text, nullable), `mapped_by` (text: 'manual' | 'ai_suggested' | 'ai_confirmed'), `created_at` (timestamptz)
- [ ] RLS policies: all tables require `auth.uid() IS NOT NULL` for read; write restricted to admin role
- [ ] SQL migration file created (`migration-015-baldrige-criteria.sql`)
- [ ] Typecheck passes

#### US-004: Seed full criteria questions
**Description:** As a developer, I need to populate the criteria tables with all 2023-2024 Baldrige Business/Nonprofit questions.

**Acceptance Criteria:**
- [ ] Create seed SQL script (`supabase/seed-baldrige-criteria.sql`) that inserts all items and questions
- [ ] Organizational Profile: P.1 (5 sub-questions), P.2 (3 sub-questions)
- [ ] Category 1 Leadership: 1.1 (7 sub-questions across a/b/c), 1.2 (8 sub-questions across a/b/c)
- [ ] Category 2 Strategy: 2.1 (6 sub-questions across a/b), 2.2 (7 sub-questions across a/b)
- [ ] Category 3 Customers: 3.1 (4 sub-questions across a/b), 3.2 (5 sub-questions across a/b)
- [ ] Category 4 Measurement: 4.1 (4 sub-questions across a/b), 4.2 (6 sub-questions across a/b/c)
- [ ] Category 5 Workforce: 5.1 (6 sub-questions across a/b), 5.2 (8 sub-questions across a/b/c)
- [ ] Category 6 Operations: 6.1 (6 sub-questions across a/b), 6.2 (6 sub-questions across a/b/c)
- [ ] Category 7 Results: 7.1 (4 sub-questions across a/b/c), 7.2 (2 sub-questions), 7.3 (4 sub-questions), 7.4 (5 sub-questions), 7.5 (3 sub-questions)
- [ ] Each question includes the FULL question text from the 2023-2024 framework (not the abbreviated Excellence Builder version)
- [ ] Point values match the framework: P (0), 1.1 (70), 1.2 (45), 2.1 (40), 2.2 (45), 3.1 (40), 3.2 (45), 4.1 (45), 4.2 (45), 5.1 (40), 5.2 (45), 6.1 (45), 6.2 (40), 7.1 (120), 7.2 (80), 7.3 (80), 7.4 (80), 7.5 (90)
- [ ] Script uses `ON CONFLICT DO NOTHING` for idempotency
- [ ] Script runs successfully in Supabase SQL Editor

### Layer 2: Criteria Map Page (Admin-Only)

#### US-005: Criteria Map overview page
**Description:** As an admin, I want to see all Baldrige criteria items organized by category with coverage status so I can understand where I stand.

**Acceptance Criteria:**
- [ ] New page at `/criteria` (admin-only)
- [ ] Page title: "Baldrige Criteria Map"
- [ ] Shows all 7 categories (+ Org Profile) as collapsible sections
- [ ] Each category shows: category name, total points, coverage percentage (questions with at least one primary mapping / total questions)
- [ ] Each item within a category shows: item code, item name, points, coverage bar (colored: green = all mapped, yellow = partial, red = none)
- [ ] Clicking an item expands to show all sub-questions with their mapping status
- [ ] Each sub-question shows: question code, truncated question text, mapped process badges (clickable links to process detail), coverage level indicator
- [ ] Overall summary at top: "X of Y questions mapped (Z%)" with total points covered
- [ ] Fetches from `/api/criteria` endpoint
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-006: Criteria API endpoints
**Description:** As a developer, I need API endpoints to read criteria data and manage mappings.

**Acceptance Criteria:**
- [ ] `GET /api/criteria` — returns all items, questions, and their mappings (with process names) in a nested structure
- [ ] `POST /api/criteria/mappings` — create a mapping (process_id, question_id, coverage, notes, mapped_by). Admin-only.
- [ ] `DELETE /api/criteria/mappings/[id]` — remove a mapping. Admin-only.
- [ ] `PATCH /api/criteria/mappings/[id]` — update coverage or notes. Admin-only.
- [ ] All endpoints use `createSupabaseServer()` for authenticated queries
- [ ] Admin check: verify user role before write operations
- [ ] Typecheck passes

### Layer 3: AI-Assisted Mapping

#### US-007: AI mapping suggestions for a question
**Description:** As an admin, I want AI to analyze my processes and suggest which ones answer a specific Baldrige question, so I don't have to manually review every process.

**Acceptance Criteria:**
- [ ] "Suggest Mappings" button on each unmapped or partially-mapped question in the Criteria Map
- [ ] Clicking triggers `POST /api/criteria/ai-suggest` with the question_id
- [ ] API reads the question text + all processes (name, description, charter summary, ADLI summary, baldrige_category, baldrige_item) and asks Claude to suggest 1-5 processes that answer the question
- [ ] AI returns structured JSON: `[{ process_id, process_name, coverage: "primary"|"supporting"|"partial", rationale }]`
- [ ] Suggestions displayed as cards below the question with: process name, coverage level badge, rationale text, "Accept" and "Dismiss" buttons
- [ ] "Accept" creates a `process_question_mappings` row with `mapped_by: 'ai_confirmed'`
- [ ] "Dismiss" hides the suggestion (no database write)
- [ ] If AI finds no matching process, shows "No existing process covers this question" with a "Create Process" CTA
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-008: AI bulk mapping scan
**Description:** As an admin, I want AI to scan ALL unmapped questions and suggest mappings in bulk, so I can quickly bootstrap the criteria map.

**Acceptance Criteria:**
- [ ] "AI Scan All" button on the Criteria Map page header (admin-only)
- [ ] Shows confirmation: "This will analyze X unmapped questions against Y processes. This may take a few minutes."
- [ ] Triggers `POST /api/criteria/ai-scan` which processes questions in batches (5 at a time to manage token limits)
- [ ] Progress indicator shows "Scanning question X of Y..."
- [ ] Results page shows: questions with suggestions (grouped by category), questions with no match
- [ ] Each suggestion has "Accept" / "Dismiss" buttons (same as US-007)
- [ ] "Accept All" button to confirm all suggestions at once
- [ ] Suggestions saved with `mapped_by: 'ai_suggested'` until confirmed
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### Layer 4: Gap Analysis

#### US-009: Gap Analysis page
**Description:** As an admin, I want a focused view of Baldrige questions that have NO process mapped, so I can prioritize what to work on next.

**Acceptance Criteria:**
- [ ] New page at `/criteria/gaps` (admin-only)
- [ ] Page title: "Application Gaps"
- [ ] Groups unmapped questions by category, sorted by point value (highest first)
- [ ] Each gap shows: question code, question text (full), category, points at stake
- [ ] Summary at top: "X questions unmapped across Y categories — Z points at risk"
- [ ] Priority tags: "Critical" (Category 3 — zero coverage), "Important" (< 50% category coverage), "Strengthen" (> 50% but not complete)
- [ ] Two action buttons per gap:
  - "Find Existing Process" — opens a search modal listing all processes, with AI-suggested matches highlighted at top
  - "Create New Process" — navigates to `/processes/new` with `?baldrige_question_id=X` pre-filling the Baldrige category and triggering AI context about the question
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-010: Process creation with Baldrige question context
**Description:** As an admin, when I create a process from a gap, I want the AI to know which Baldrige question I'm trying to answer so it can guide me effectively.

**Acceptance Criteria:**
- [ ] When `/processes/new` receives `?baldrige_question_id=X` query param:
  - Auto-selects the correct Baldrige category
  - Shows a blue info banner: "This process is being created to address Baldrige question X.Xa(N): [question text]"
  - Sets `baldrige_item` field to the item code
- [ ] When `/processes/new/ai` receives the same param:
  - Passes the Baldrige question text into the AI creation context
  - AI greeting references the specific question: "I'll help you design a process that addresses [question text]..."
- [ ] After process is created, automatically creates a `process_question_mappings` row with `coverage: 'primary'` and `mapped_by: 'manual'`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### Layer 5: Basic Narrative Drafting

#### US-011: Draft narrative per Baldrige item
**Description:** As an admin, I want AI to generate a draft application narrative for a Baldrige item using the mapped processes' ADLI content, so I have a starting point for the application.

**Acceptance Criteria:**
- [ ] "Draft Narrative" button on each item in the Criteria Map (only when at least 1 question is mapped)
- [ ] Triggers `POST /api/criteria/draft` with the item_id
- [ ] API gathers: all mapped processes for the item's questions, their charter content, ADLI content (approach/deployment/learning/integration), linked metrics with trends, and the full question text
- [ ] AI generates a narrative that:
  - Addresses each sub-question in order
  - References specific NIA processes by name
  - Uses ADLI structure (Approach, Deployment, Learning, Integration)
  - Stays within estimated page budget (word count guidance in prompt)
  - Uses concrete evidence from the process documentation
  - Identifies where evidence is thin with `[GAP: ...]` markers
- [ ] Narrative displayed in a full-width panel with markdown rendering
- [ ] "Save Draft" button stores the narrative in a new `baldrige_drafts` table: `id`, `item_id` (FK to baldrige_items), `content` (text), `version` (int, auto-increment), `word_count` (int), `created_at`
- [ ] "Regenerate" button creates a new version (preserves previous)
- [ ] Word count displayed with page estimate (assuming ~500 words/page)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-012: Draft management and versioning
**Description:** As an admin, I want to view, compare, and edit draft narratives so I can refine the application over time.

**Acceptance Criteria:**
- [ ] Each Baldrige item in the Criteria Map shows draft status: "No Draft", "Draft v1", "Draft v3", etc.
- [ ] Clicking the draft badge opens a panel showing the latest draft with markdown rendering
- [ ] Version selector dropdown to view previous versions
- [ ] "Edit" button switches to a textarea for manual editing
- [ ] "Save" creates a new version (manual edits are preserved as versions too)
- [ ] `GET /api/criteria/drafts?item_id=X` returns all versions for an item
- [ ] `POST /api/criteria/drafts` creates a new draft version
- [ ] `GET /api/criteria/drafts/[id]` returns a specific draft
- [ ] Page budget summary on Criteria Map: total word count across all drafts, estimated pages, vs. 25-page target
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Create `user_roles` table with `role` enum ('admin' | 'member'), seeded with Jon as admin
- FR-2: Create `useRole()` client hook that returns `{ role, isAdmin, loading }`
- FR-3: Sidebar renders "Application" section only for admin users
- FR-4: Admin-only pages (`/criteria`, `/criteria/gaps`) redirect non-admins to `/`
- FR-5: Create `baldrige_items` table with 19 rows (P.1, P.2, 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 7.3, 7.4, 7.5)
- FR-6: Create `baldrige_questions` table with ~90 rows covering all sub-questions from the full criteria
- FR-7: Create `process_question_mappings` junction table linking processes to questions with coverage level
- FR-8: Criteria Map page shows nested hierarchy: Category → Item → Question → Mapped Processes
- FR-9: Coverage percentages computed at item and category level
- FR-10: AI mapping suggestions use Claude to compare process content against question text
- FR-11: AI bulk scan processes all unmapped questions in batches of 5
- FR-12: Gap Analysis page shows unmapped questions sorted by point value
- FR-13: "Create Process" from a gap pre-fills Baldrige context and auto-maps on creation
- FR-14: AI narrative drafting gathers all mapped process ADLI content and generates per-item narratives
- FR-15: Draft versioning preserves all previous versions
- FR-16: Page budget tracking computes total word count vs. 25-page target (~12,500 words)
- FR-17: All write operations on criteria/mappings/drafts tables restricted to admin role
- FR-18: Create `baldrige_drafts` table for storing versioned narrative drafts per item

## Non-Goals (Out of Scope)

- Full application formatting/export (Word document, PDF) — future enhancement
- Organizational Profile (P.1, P.2) narrative drafting — different structure than process items
- Category 7 Results narrative drafting — requires chart/table generation, different from process narratives
- Collaborative editing (multiple users editing drafts simultaneously)
- Examiner feedback tracking or scoring simulation
- Importing existing draft narratives from the Obsidian vault (can be done manually via copy-paste)
- Automatic criteria version updates (2025-2026 framework) — questions are editable but not auto-updated

## Design Considerations

- **Criteria Map layout:** Use a tree/accordion structure similar to the readiness page's category breakdown. Each level is collapsible. Color-coding: green (fully mapped), yellow (partially mapped), red (unmapped), gray (no processes in this category).
- **Reuse existing components:** `Card`, `Badge`, `Button`, `Select` from `components/ui/`. `HealthRing` can be repurposed for coverage rings. `MarkdownContent` for rendering draft narratives.
- **Mobile:** Criteria Map should be usable on mobile but is primarily a desktop tool. Use responsive cards that stack on small screens.
- **AI chat integration:** The AI coach on each process detail page should proactively suggest Baldrige question mappings during coaching sessions (e.g., "This process addresses Baldrige question 1.1a(1) — Vision and Values"). This is the PRIMARY way mappings get created — users work through processes naturally and the AI tags them. The Criteria Map page's "Suggest Mappings" and "AI Scan All" are SECONDARY tools for bulk bootstrapping. Dedicated API endpoints for batch operations; structured output blocks for inline suggestions.

## Technical Considerations

- **AI token management:** Bulk scan (US-008) needs batching. Each batch sends ~5 questions + truncated process summaries (~200 chars each for ~20 processes). Estimate ~2K tokens per batch input.
- **AI narrative drafting:** A single item may have 5-8 mapped processes. Sending full ADLI content (1500 chars each × 4 dimensions × 5 processes = 30K chars) approaches token limits. Truncate to most relevant sections or summarize.
- **Existing `baldrige_item` field:** The `processes` table already has a `baldrige_item` text field (e.g., "1.1a"). This should be used as a hint for AI mapping but is NOT the same as the new `process_question_mappings` table — the existing field maps one process to one item, the new table maps many processes to many questions.
- **Supabase RLS for admin:** Write policies on new tables should check `(SELECT role FROM user_roles WHERE auth_id = auth.uid()) = 'admin'`. Read policies can allow all authenticated users (the data isn't secret, just the pages are hidden).
- **Migration ordering:** Migration 014 (user_roles) must run before migration 015 (baldrige criteria) because RLS policies on criteria tables reference user_roles.
- **Vercel timeout:** AI drafting and bulk scan may take >10 seconds. Use streaming for drafts (reuse existing streaming pattern from `/api/ai/chat`). For bulk scan, use a polling pattern: start scan → return job ID → client polls for progress.

## Success Metrics

- All ~90 Baldrige sub-questions stored in the database with full question text
- AI can suggest at least 1 process for 70%+ of questions in categories with documented processes (Cat 1, 2, 5, 6)
- Gap analysis correctly identifies Category 3 as the critical gap (zero process coverage)
- Draft narratives reference specific NIA processes by name and use ADLI structure
- Admin-only access works: team members see no Phase 3 features
- Page budget tracking shows total estimated pages vs. 25-page target

## Resolved Questions

1. **Roles:** Just admin/member — keep it simple. Two roles is enough.
2. **Auto-migrate old `baldrige_item` values:** No. Start fresh. The AI coach on each process page should suggest Baldrige question links as users work through processes — mappings are created naturally within the process workflow, not just from the Criteria Map page. The existing `baldrige_item` field is ignored for mapping purposes.
3. **Category 7 (Results):** Show metric coverage — for Cat 7 questions, display which metrics exist vs. what the question asks for, rather than mapping processes.
4. **Narrative style:** Structured sections (one labeled section per sub-question). A flowing narrative "polish" feature can be added later.
5. **2025-2026 framework:** A new seed script will suffice — no admin UI needed for editing questions.

## Open Questions

1. (None remaining — all resolved)
