# PRD: Excellence Builder Integration

## Introduction

Connect process documentation to Baldrige Excellence Builder (EB) questions via AI-powered mapping, transform the Baldrige Connections section on process pages into a read-only AI-populated summary, and add application narrative drafting for a 25-page submission.

The NIA Excellence Hub already has the full Baldrige framework (98 questions) in the database, a criteria map page, AI-assisted mapping, gap analysis, and AI chat. This feature adds the simpler Excellence Builder questions as a tier, automates process-to-question mapping via AI (so process owners never need Baldrige knowledge), and creates a draft editor for application narratives.

### Background

NIA's team is learning the Baldrige framework. Process owners maintain their process documentation (charter, ADLI, metrics) but don't know which framework questions their processes answer. Previously, a multi-agent Obsidian workflow handled this — one agent documented processes, another connected them to Baldrige questions and drafted application narratives. This PRD replicates that workflow inside the Hub, with AI replacing the "Application Writing Agent."

### Three-Step Flow

1. **Process owners** maintain process pages (charter, ADLI, metrics) — zero Baldrige knowledge required
2. **AI maps** processes to Excellence Builder questions, admin reviews — automated via scanning
3. **AI drafts** application narratives from mapped processes — admin edits and exports

## Goals

- Seed ~100 Excellence Builder questions into the existing `baldrige_questions` table with a `tier` column to distinguish from full framework questions
- Automate process-to-EB-question mapping via AI (process owners do zero Baldrige work)
- Replace the editable Baldrige Connections section on process pages with a read-only summary of AI-generated mappings from `process_question_mappings`
- Convert legacy Obsidian-imported `baldrige_connections` JSONB content into structured mappings, then hide the old section
- Build a narrative draft editor where AI generates application text per Baldrige item using ADLI structure (categories 1-6) and LeTCI structure (category 7)
- Export application drafts to Word (.docx) with support for figures and diagrams

## User Stories

### US-001: Add `tier` column to `baldrige_questions` table

**Description:** As a developer, I need to distinguish Excellence Builder questions from full framework questions so the system can filter by application tier.

**Acceptance Criteria:**
- [ ] Migration adds `tier TEXT NOT NULL DEFAULT 'full'` column to `baldrige_questions`
- [ ] `tier` has CHECK constraint: `tier IN ('excellence_builder', 'full')`
- [ ] Existing 98 questions remain with `tier = 'full'`
- [ ] Typecheck/lint passes

### US-002: Seed Excellence Builder questions

**Description:** As an admin, I need the ~100 Excellence Builder questions in the database so AI can map processes to them.

**Acceptance Criteria:**
- [ ] SQL seed script inserts all EB questions from the 2023-2024 Excellence Builder PDF
- [ ] Each question linked to correct `baldrige_items` row via matching `item_code` (P.1, P.2, 1.1-7.5)
- [ ] All EB questions have `tier = 'excellence_builder'`
- [ ] `question_code` follows pattern like `EB-1.1a(1)` to avoid conflicts with existing full framework codes
- [ ] Script is idempotent (`ON CONFLICT DO NOTHING`)
- [ ] Typecheck/lint passes

### US-003: AI process-to-EB mapping scan

**Description:** As an admin, I want AI to automatically scan all processes and suggest which EB questions each process helps answer, so I don't have to manually map them.

**Acceptance Criteria:**
- [ ] New API endpoint `/api/criteria/eb-scan` scans all processes against EB questions
- [ ] AI reads each process's charter, ADLI content, and linked metrics to determine relevance
- [ ] Returns suggestions with confidence level and rationale per process-question pair
- [ ] Suggestions stored as `mapped_by = 'ai_suggested'` in `process_question_mappings`
- [ ] Admin can review, accept, or dismiss suggestions on the criteria map page
- [ ] Respects existing mappings (doesn't duplicate)
- [ ] Uses `maxDuration = 120` for serverless timeout
- [ ] Typecheck/lint passes

### US-004: Tier filter on Criteria Map page

**Description:** As an admin, I want to filter the criteria map by question tier (Excellence Builder / Full Framework / Both) so I can focus on the 25-page application first.

**Acceptance Criteria:**
- [ ] Toggle/tabs at top of criteria map page: "Excellence Builder" | "Full Framework" | "All"
- [ ] Default view is "Excellence Builder" (the simpler tier)
- [ ] Coverage percentages recalculate per tier
- [ ] AI Scan All button respects active tier filter
- [ ] Gap analysis page also supports tier filter
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Transform Baldrige Connections section to read-only

**Description:** As a process owner, I want the Baldrige Connections section on my process page to automatically show which EB questions my process answers, without me needing any Baldrige knowledge.

**Acceptance Criteria:**
- [ ] Process detail page: "Baldrige Connections" section replaced with "Excellence Builder Connections"
- [ ] Section is read-only — no edit fields, no ListEditor, no TextAreaFields
- [ ] Fetches mappings from `process_question_mappings` filtered by this process's ID
- [ ] Shows each mapped question with: question code, area label, coverage badge (primary/supporting/partial)
- [ ] Groups by Baldrige category for readability
- [ ] Empty state: "No connections yet — an admin can run AI mapping from the Criteria Map page" with link to `/criteria`
- [ ] Process edit page: Baldrige Connections section removed entirely (replaced with info card: "Managed automatically via AI mapping")
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Convert legacy Baldrige Connections content

**Description:** As a developer, I need to convert existing `baldrige_connections` JSONB content (from Obsidian imports) into structured `process_question_mappings` rows so legacy data isn't lost.

**Acceptance Criteria:**
- [ ] One-time conversion script (or API endpoint) reads all processes with non-null `baldrige_connections`
- [ ] AI reads the `questions_addressed` array and `evidence_by_dimension` text to identify matching EB questions
- [ ] Creates `process_question_mappings` rows with `mapped_by = 'ai_confirmed'`
- [ ] Logs any questions that couldn't be matched (for manual review)
- [ ] After conversion, legacy content preserved in JSONB but hidden from UI
- [ ] Typecheck/lint passes

### US-007: `baldrige_drafts` table for application narratives

**Description:** As a developer, I need a database table to store narrative drafts per Baldrige item so admins can build the application incrementally.

**Acceptance Criteria:**
- [ ] Migration creates `baldrige_drafts` table with columns: `id`, `item_id` (FK to baldrige_items), `tier` (excellence_builder/full), `narrative_text`, `figures` (JSONB array), `word_count`, `status` (draft/review/final), `last_ai_generated_at`, `last_edited_at`, `created_at`, `updated_at`
- [ ] Unique constraint on `(item_id, tier)` — one draft per item per tier
- [ ] RLS: all authenticated users can read, admins can write
- [ ] Typecheck/lint passes

### US-008: Narrative draft editor page

**Description:** As an admin, I want a page where I can view and edit AI-generated narrative drafts for each Baldrige item, organized by category.

**Acceptance Criteria:**
- [ ] New page at `/application` (admin-only via `AdminGuard`)
- [ ] Sidebar link in "Application" nav group (book icon)
- [ ] Page shows all 19 Baldrige items organized by category accordion
- [ ] Each item card shows: item code, item name, point value, draft status badge, word count
- [ ] Click item to open draft editor with rich text area
- [ ] Item detail view shows: list of mapped processes (from `process_question_mappings`), the EB questions this item covers, and the narrative text editor
- [ ] Draft auto-saves on blur or after 3-second debounce
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-009: AI narrative generation per item

**Description:** As an admin, I want AI to generate a narrative draft for a Baldrige item by reading all processes mapped to it, so I have a starting point for the application.

**Acceptance Criteria:**
- [ ] "Generate Draft" button on each item's editor view
- [ ] AI reads all processes mapped to this item (charter, ADLI, metrics, scores)
- [ ] For categories 1-6: generates narrative following ADLI structure (Approach, Deployment, Learning, Integration)
- [ ] For category 7 (Results): generates narrative following LeTCI structure (Levels, Trends, Comparisons, Integration)
- [ ] Draft includes section headers matching ADLI/LeTCI dimensions
- [ ] AI identifies gaps: "No process addresses [specific question]" callouts
- [ ] Respects approximate word count target per item (total budget ~20,000 words for 25 pages, distributed by point value)
- [ ] Generated text saved to `baldrige_drafts` table with `last_ai_generated_at` timestamp
- [ ] "Regenerate" button overwrites AI text but preserves manual edits via confirmation dialog
- [ ] Uses streaming for real-time display
- [ ] Typecheck/lint passes

### US-010: Export application to Word (.docx)

**Description:** As an admin, I want to export the complete application as a Word document so I can submit it or share with reviewers.

**Acceptance Criteria:**
- [ ] "Export to Word" button on the `/application` page
- [ ] Generates .docx with: title page, table of contents, organizational profile (P.1, P.2), category sections (1-7) with item narratives
- [ ] Each item section includes: item title, point value, narrative text
- [ ] Figures/images referenced in `baldrige_drafts.figures` JSONB are embedded in the document
- [ ] Word count summary per category shown in table of contents
- [ ] Uses `docx` npm package (or similar) for generation
- [ ] Download triggers immediately in browser
- [ ] Typecheck/lint passes

### US-011: Figure management for drafts

**Description:** As an admin, I want to upload figures (charts, diagrams, screenshots) and attach them to specific narrative sections so the application includes visual evidence.

**Acceptance Criteria:**
- [ ] Each item's draft editor has a "Figures" section below the narrative
- [ ] Upload button accepts images (PNG, JPG, SVG) and PDFs
- [ ] Uploaded figures stored via existing `/api/ai/files` infrastructure (or new endpoint)
- [ ] Each figure has: file reference, caption text, figure number (auto-incremented per item)
- [ ] Figures appear inline in the narrative where referenced (using `[Figure X.Y]` markers)
- [ ] Drag to reorder figures
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Add `tier` column to `baldrige_questions` with values `excellence_builder` and `full`
- FR-2: Seed all Excellence Builder questions linked to existing `baldrige_items` via `item_code`
- FR-3: AI scan endpoint reads process content and suggests EB question mappings with confidence scores
- FR-4: Criteria map page supports tier filtering with recalculated coverage
- FR-5: Process detail page shows read-only EB connections from `process_question_mappings` (not from `baldrige_connections` JSONB)
- FR-6: Process edit page replaces Baldrige Connections editor with informational card
- FR-7: Legacy `baldrige_connections` JSONB content converted to structured mappings via AI
- FR-8: `baldrige_drafts` table stores narrative text, figures, word count, and status per item
- FR-9: AI generates ADLI-structured narratives (categories 1-6) and LeTCI-structured narratives (category 7)
- FR-10: Word export produces .docx with title page, TOC, all category narratives, and embedded figures
- FR-11: Figure upload, captioning, ordering, and inline reference markers per narrative section

## Non-Goals

- No full framework application drafting (only Excellence Builder tier for now)
- No PDF export (Word only — PDF can be generated from Word)
- No collaborative editing or version history on narratives (single admin edits)
- No automatic chart pulling from the Hub's metric visualizations (manual figure upload for now)
- No scoring or self-assessment against the narratives
- No public-facing submission portal
- Process owners never interact with Baldrige mapping or narrative features

## Design Considerations

- Reuse existing `AdminGuard` component for all application-related pages
- Reuse existing criteria map infrastructure (API routes, mapping CRUD)
- The read-only EB Connections section on process pages should be visually consistent with the existing ADLI Radar and Process Map sections (info display, not edit fields)
- Narrative editor should feel like a focused writing tool — minimal UI, large text area, word count visible
- Tier toggle on criteria map should feel like switching between "beginner" and "advanced" views

## Technical Considerations

- `baldrige_questions.question_code` is UNIQUE — EB questions need distinct codes (e.g., `EB-1.1a(1)`)
- AI scan for EB mapping can reuse patterns from `/api/criteria/ai-scan` (batch processing, progress updates)
- Word generation: `docx` npm package is well-maintained and supports images, tables, and custom styling
- Narrative word budget: 25 pages x ~800 words/page = ~20,000 words total, distributed proportionally by point value (e.g., a 120-point item gets ~2,400 words, a 40-point item gets ~800 words)
- ADLI structure for process items: Approach (how), Deployment (where/who), Learning (how measured/improved), Integration (how connected)
- LeTCI structure for results items: Levels (current performance), Trends (direction over time), Comparisons (vs. benchmarks), Integration (connection to strategy)
- Streaming for AI narrative generation (same pattern as `/api/ai/chat`)

## Success Metrics

- AI maps at least 80% of processes to relevant EB questions without manual intervention
- Admin can generate a complete first-draft application in under 2 hours
- Process owners see their Baldrige connections without needing to know the framework
- Word export produces a submission-ready document structure

## Resolved Questions

- **Narrative editor format:** Markdown — AI already generates Markdown, and the docx export library can convert it to styled Word content
- **Organizational Profile page budget:** 5 pages for P.1 + P.2 — user already has a draft to import/revise
- **Auto-pull process maps as figures:** Not now — manual figure upload only for v1
