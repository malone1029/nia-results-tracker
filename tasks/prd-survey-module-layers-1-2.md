# PRD: Survey Module — Layers 1-2 (Question Types + Design & Logic)

## Introduction

Expand the NIA Excellence Hub's survey module from a basic 2-type tool (rating + yes/no) into a near-full-featured survey builder — "SurveyMonkey for NIA." This PRD covers the first two foundational layers:

- **Layer 1:** Question Type Expansion — 6 new question types covering every common survey need
- **Layer 2:** Survey Design & Logic — sections, required/optional, skip logic, templates, and custom messaging

Surveys serve both **internal NIA staff** and **external member district contacts**, so the response UI must be polished, mobile-friendly, and self-explanatory without login.

Layers 3-5 (email distribution, analytics dashboards, advanced features) are deferred to a future PRD and will build on this foundation.

## Goals

- Support all common survey question types (rating scales, multiple choice, checkboxes, open text, NPS, matrix grids)
- Allow custom scale labels so surveys feel professional and context-appropriate
- Enable multi-page surveys with logical grouping and flow
- Let survey creators mark questions as required or optional
- Add conditional skip logic ("if answer is X, skip to section Y")
- Provide reusable question templates to speed up survey creation
- Maintain backward compatibility with existing surveys (rating + yes_no continue to work)
- Keep the public response page fast, accessible, and mobile-first
- Update AI integration to understand and suggest all new question types

## User Stories

### US-001: Database Migration for New Question Types

**Description:** As a developer, I need the database schema to support new question types, options, sections, logic rules, and answer formats so all Layer 1-2 features have a solid foundation.

**Acceptance Criteria:**

- [ ] `survey_questions` table updated:
  - `question_type` CHECK expanded to include: `rating`, `yes_no`, `nps`, `multiple_choice`, `checkbox`, `open_text`, `matrix`
  - `options` JSONB column added (stores choice labels, custom scale labels, matrix rows/columns)
  - `is_required` BOOLEAN DEFAULT true
  - `help_text` TEXT (nullable — optional description shown below question)
  - `section_label` TEXT (nullable — groups consecutive questions under a heading)
- [ ] `survey_answers` table updated:
  - `value_json` JSONB column added (for multi-select checkbox answers and matrix row answers)
- [ ] `surveys` table updated:
  - `welcome_message` TEXT (nullable — shown on first page before questions)
  - `thank_you_message` TEXT (nullable — shown after submission instead of default)
- [ ] `survey_templates` table created:
  - `id` BIGSERIAL PRIMARY KEY
  - `name` TEXT NOT NULL
  - `description` TEXT
  - `category` TEXT (e.g., "Employee Engagement", "Member Satisfaction", "Process Effectiveness")
  - `questions` JSONB NOT NULL (array of question objects)
  - `created_by` UUID (FK → auth.users)
  - `is_shared` BOOLEAN DEFAULT false
  - `created_at` TIMESTAMPTZ DEFAULT NOW()
- [ ] All existing surveys and responses continue to work (backward compatible)
- [ ] Migration runs cleanly via `supabase db push`
- [ ] Typecheck passes

---

### US-002: Likert Scale with Custom Labels

**Description:** As a survey creator, I want to define custom rating labels (e.g., "Never / Rarely / Sometimes / Often / Always") so my scales match the question context instead of always using "Strongly Disagree → Strongly Agree."

**Acceptance Criteria:**

- [ ] Survey builder shows "Custom Labels" toggle when question type is "Rating"
- [ ] When enabled, shows editable label inputs for each scale point (default 5)
- [ ] Scale size selector: 3, 4, 5, 7, or 10 points (already have `rating_scale_max`)
- [ ] Custom labels stored in `options` JSONB: `{ "labels": ["Never", "Rarely", "Sometimes", "Often", "Always"] }`
- [ ] Response page renders custom labels below each rating button (or as button text for 3-4 point scales)
- [ ] Results page shows custom labels in distribution bar tooltips
- [ ] Default labels ("Strongly Disagree" → "Strongly Agree") used when no custom labels set
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-003: Multiple Choice (Single Select)

**Description:** As a survey creator, I want to add multiple-choice questions where respondents pick exactly one option from a list, for questions like "What department are you in?" or "How did you hear about this service?"

**Acceptance Criteria:**

- [ ] New question type "Multiple Choice" in builder dropdown
- [ ] Builder shows editable option list (add/remove/reorder, min 2 options)
- [ ] Options stored in `options` JSONB: `{ "choices": ["Option A", "Option B", "Option C"] }`
- [ ] Optional "Other (please specify)" toggle — adds a write-in field
- [ ] Response page renders radio buttons (vertical list on mobile, wrapping row on desktop)
- [ ] Answer stored as `value_numeric` = selected option index (0-based), `value_text` = write-in text if "Other"
- [ ] Results page shows: bar chart with count/percentage per option, "Other" responses listed
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-004: Checkbox (Multi-Select)

**Description:** As a survey creator, I want checkbox questions where respondents can select multiple options, for questions like "Which NIA services have you used? (Select all that apply)"

**Acceptance Criteria:**

- [ ] New question type "Checkbox" in builder dropdown
- [ ] Builder shows same editable option list as multiple choice
- [ ] Optional "Other (please specify)" toggle
- [ ] Response page renders checkboxes (respondent can check 0 to all)
- [ ] Answer stored in `value_json`: `{ "selected": [0, 2, 4] }` (array of selected indices), `value_text` for "Other"
- [ ] `value_numeric` = count of selected options (for metric linking: more selections = higher engagement)
- [ ] Results page shows: horizontal bar per option with count/percentage, sorted by frequency
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-005: Open Text (Short + Long Answer)

**Description:** As a survey creator, I want free-text questions for qualitative feedback, with short answer (one line) and long answer (paragraph) variants.

**Acceptance Criteria:**

- [ ] New question type "Open Text" in builder dropdown
- [ ] Builder shows "Short answer" / "Long answer" toggle (stored in `options` JSONB: `{ "variant": "short" | "long" }`)
- [ ] Optional character limit field (stored in options, enforced on response page)
- [ ] Response page renders: text input for short, textarea (4 rows) for long
- [ ] Answer stored as `value_text` (no `value_numeric`)
- [ ] Cannot be linked to a metric (metric_id dropdown hidden for this type)
- [ ] Results page shows: all text responses listed (same style as current comments section)
- [ ] AI analysis integration: open text responses included in `buildSurveyContext()` as "key themes" (truncated to fit context budget)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-006: Net Promoter Score (NPS)

**Description:** As a survey creator, I want an NPS question (0-10 scale) that auto-calculates the NPS score and shows Detractor/Passive/Promoter breakdown, since NPS is a standard metric NIA leadership already understands.

**Acceptance Criteria:**

- [ ] New question type "NPS" in builder dropdown
- [ ] Builder shows fixed 0-10 scale (no customization needed — NPS is standardized)
- [ ] Response page renders 11 buttons (0-10) with color gradient: red (0-6), yellow (7-8), green (9-10)
- [ ] Labels below: "Not at all likely" (left) and "Extremely likely" (right)
- [ ] Answer stored as `value_numeric` (0-10)
- [ ] Results page shows:
  - NPS score (% Promoters − % Detractors), displayed as large number with +/− sign
  - Stacked bar: Detractors (red) | Passives (yellow) | Promoters (green) with percentages
  - Count per segment
- [ ] Metric auto-entry: when linked to a metric, value = NPS score (−100 to +100)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-007: Matrix / Grid Question

**Description:** As a survey creator, I want matrix questions where multiple related items share the same rating scale (e.g., "Rate each NIA service: [Timeliness, Quality, Communication] × [Poor, Fair, Good, Excellent]"), since these are common in satisfaction surveys.

**Acceptance Criteria:**

- [ ] New question type "Matrix" in builder dropdown
- [ ] Builder shows:
  - Row labels editor (add/remove/reorder, min 2 rows) — these are the items being rated
  - Column labels editor (add/remove/reorder, min 2 columns) — these are the scale points
  - Stored in `options` JSONB: `{ "rows": ["Timeliness", "Quality", "Communication"], "columns": ["Poor", "Fair", "Good", "Excellent"] }`
- [ ] Response page renders as a grid: rows on left, column headers on top, radio buttons at intersections
- [ ] Mobile: each row becomes a separate mini-question (row label as heading, columns as buttons)
- [ ] One answer entry per row: `value_numeric` = selected column index (0-based), `value_json` = `{ "row_index": 0, "row_label": "Timeliness" }`
- [ ] All rows required if question is required
- [ ] Results page shows: per-row average (mapped to column index), mini distribution bar per row
- [ ] Optional metric linking per row (future — not required for this story)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-008: Update Results Aggregation for New Types

**Description:** As a process owner, I want the results view to correctly aggregate and display data for all new question types so I can analyze survey responses regardless of question format.

**Acceptance Criteria:**

- [ ] `/api/surveys/[id]/results` route updated to handle all 7 question types
- [ ] **Multiple Choice:** count per option, percentage, most-selected highlighted
- [ ] **Checkbox:** count per option (respondents can select multiple), percentage of respondents who selected each
- [ ] **Open Text:** all responses collected, displayed as scrollable list
- [ ] **NPS:** NPS score calculated, segment counts returned (detractors/passives/promoters)
- [ ] **Matrix:** per-row average + distribution returned
- [ ] **Rating + Yes/No:** unchanged (existing logic preserved)
- [ ] Previous-wave trend comparison works for: rating, yes_no, nps, matrix rows (skip for open_text, multiple_choice, checkbox — trends don't apply)
- [ ] Typecheck passes

---

### US-009: Update Auto-Entry Generation for New Types

**Description:** As a process owner, I want metric entries to be auto-generated when closing a wave, for question types where numeric aggregation makes sense.

**Acceptance Criteria:**

- [ ] Wave close PATCH route updated for new types:
  - **Rating:** average (unchanged)
  - **Yes/No:** % Yes (unchanged)
  - **NPS:** NPS score (% Promoters − % Detractors)
  - **Multiple Choice:** mode (index of most-selected option) — limited usefulness, metric linking optional
  - **Checkbox:** average number of selections per respondent
  - **Matrix:** average per row (creates one entry per row if metric linked)
  - **Open Text:** no metric entry (skip)
- [ ] Idempotency check updated for matrix (one check per row)
- [ ] Typecheck passes

---

### US-010: Required vs. Optional Questions

**Description:** As a survey creator, I want to mark individual questions as required or optional so respondents aren't forced to answer every question (especially sensitive ones like open text).

**Acceptance Criteria:**

- [ ] Survey builder shows "Required" toggle per question (default: on)
- [ ] Required state stored in `survey_questions.is_required`
- [ ] Response page: required questions show red asterisk (\*) next to question number
- [ ] Submit validation only checks required questions (optional can be skipped)
- [ ] Progress counter: "3 / 5 required answered" (only counts required)
- [ ] Results: response count per question reflects actual answers (may differ between required and optional questions)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-011: Question Help Text

**Description:** As a survey creator, I want to add a brief description or instruction below a question to clarify what I'm asking, especially for complex or sensitive questions.

**Acceptance Criteria:**

- [ ] Survey builder shows optional "Help text" input below each question text field
- [ ] Help text stored in `survey_questions.help_text`
- [ ] Response page renders help text in smaller, muted text below the question
- [ ] Help text is optional — no display if empty
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-012: Survey Sections (Multi-Page)

**Description:** As a survey creator, I want to group questions into labeled sections so long surveys feel organized and respondents can see their progress through distinct topics.

**Acceptance Criteria:**

- [ ] Survey builder shows "Add Section Break" button between questions
- [ ] Section break has an editable label (e.g., "About Your Experience", "Service Quality")
- [ ] Optional section description text
- [ ] Section label stored in `survey_questions.section_label` on the first question of each section
- [ ] Response page renders sections as visual dividers with heading + description
- [ ] Single-page scroll (not paginated) — sections are visual grouping only
- [ ] Progress bar reflects overall progress across all sections
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-013: Custom Welcome & Thank You Messages

**Description:** As a survey creator, I want to customize the welcome text at the top of the survey and the thank-you message after submission, so the survey feels branded and personal rather than generic.

**Acceptance Criteria:**

- [ ] Survey builder shows "Welcome Message" textarea (optional, below description)
- [ ] Survey builder shows "Thank You Message" textarea (optional, at bottom)
- [ ] Stored in `surveys.welcome_message` and `surveys.thank_you_message`
- [ ] Response page: welcome message shown above first question (styled as callout/card)
- [ ] Response page: after submission, shows custom thank-you message (or default "Your response has been recorded" if empty)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-014: Conditional Skip Logic

**Description:** As a survey creator, I want to show or hide questions based on previous answers (e.g., "If you selected 'No' on Q3, skip Q4-Q6"), so respondents only see relevant questions.

**Acceptance Criteria:**

- [ ] Survey builder shows "Add Condition" option per question
- [ ] Condition format: "Show this question only if [Question X] [equals/does not equal/is greater than] [value]"
- [ ] Supported condition sources: rating value, yes/no value, multiple choice selection, NPS score range
- [ ] Conditions stored in `options` JSONB: `{ "condition": { "question_index": 2, "operator": "equals", "value": 0 } }`
- [ ] Response page: conditional questions hidden by default, revealed when condition is met
- [ ] Smooth animation on show/hide (slide down / fade in)
- [ ] Hidden questions excluded from "required" validation
- [ ] Hidden questions submit no answer (no entry in `survey_answers`)
- [ ] Results: conditional questions show "N/A" for respondents who were skipped, response count reflects actual responders
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-015: Question Templates & Bank

**Description:** As a survey creator, I want to save questions as templates and browse a library of pre-built questions so I can quickly assemble surveys from proven questions instead of writing from scratch every time.

**Acceptance Criteria:**

- [ ] Survey builder shows "Browse Templates" button that opens a template picker modal
- [ ] Template picker shows categories: Employee Engagement, Member Satisfaction, Process Effectiveness, Custom
- [ ] Each template shows: name, description, question count, preview of questions
- [ ] "Use Template" button adds all template questions to current survey (appended, not replacing)
- [ ] Individual questions can be saved as templates from the builder ("Save as Template" per question)
- [ ] "Save Survey as Template" button saves entire survey's question set
- [ ] Templates stored in `survey_templates` table
- [ ] Pre-seed 3-5 starter templates:
  - "Process Satisfaction" (5 questions: overall satisfaction, timeliness, quality, communication, recommendation)
  - "Employee Engagement Quick Pulse" (5 questions: job satisfaction, manager support, recognition, growth, recommend workplace)
  - "Service Feedback" (4 questions: ease of use, responsiveness, outcome quality, NPS)
- [ ] Templates are per-user by default, optionally shared (admin can share org-wide)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-016: AI Survey Generation from Process Context

**Description:** As a survey creator, I want to ask the AI to generate a complete survey based on my process's charter and ADLI content, so I get a head start instead of building from scratch.

**Acceptance Criteria:**

- [ ] Survey builder shows "Generate with AI" button (sparkle icon)
- [ ] Clicking it sends process context (charter, ADLI dimensions, linked metrics) to AI chat
- [ ] AI returns a `survey-questions` structured block with 5-8 targeted questions
- [ ] Questions appear in builder as editable draft (creator can modify before saving)
- [ ] AI uses all new question types appropriately (not just rating/yes_no)
- [ ] AI rationale shown per question (collapsible "Why this question?" text)
- [ ] `parseSurveyQuestions` updated to handle new question types + options
- [ ] AI system prompt updated with new question type definitions and when to use each
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

### US-017: Update Survey Builder UI for All New Features

**Description:** As a survey creator, I want the survey builder modal to be reorganized to accommodate all new features without feeling cluttered, since the current modal is simple and adding 6 new question types + sections + logic + templates could make it overwhelming.

**Acceptance Criteria:**

- [ ] Builder reorganized into logical areas:
  - **Header area:** Title, description, welcome message (collapsible)
  - **Questions area:** Scrollable list with drag-to-reorder (or move up/down buttons)
  - **Per question:** Type selector, question text, type-specific options (expand on click), help text, required toggle, metric link, condition (if applicable)
  - **Footer area:** Thank-you message (collapsible), template actions
- [ ] Question type selector shows icons + labels for all 7 types
- [ ] Type-specific options panel: only shows relevant fields (e.g., choices editor for MC, scale labels for rating, row/column editor for matrix)
- [ ] Question cards are collapsible — show question text + type badge when collapsed, full editor when expanded
- [ ] Builder converted from modal to full page (`/surveys/new?processId=N` and `/surveys/[id]/edit`)
- [ ] Mobile-responsive builder (stacked layout on small screens)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

---

## Functional Requirements

- FR-1: Database supports 7 question types: `rating`, `yes_no`, `nps`, `multiple_choice`, `checkbox`, `open_text`, `matrix`
- FR-2: Each question has: text, type, sort order, options (JSONB), is_required flag, help text, section label, optional metric link
- FR-3: Answers stored in appropriate columns: `value_numeric` for single numbers, `value_text` for text, `value_json` for structured data (multi-select, matrix)
- FR-4: Results aggregation handles all 7 types with type-appropriate visualization (averages, distributions, counts, NPS scores, text lists)
- FR-5: Auto-entry generation supports: rating (avg), yes_no (% yes), nps (NPS score), matrix (per-row avg). Skips open_text.
- FR-6: Public response page renders all 7 question types with mobile-optimized layouts
- FR-7: Questions can be marked required or optional; validation only enforces required questions
- FR-8: Questions can have help text displayed below the question on the response page
- FR-9: Questions can be grouped into labeled sections with visual dividers
- FR-10: Questions can have conditional visibility based on previous answers
- FR-11: Surveys can have custom welcome and thank-you messages
- FR-12: Question templates can be saved, browsed, and reused across surveys
- FR-13: AI can generate survey questions using all new types based on process context
- FR-14: Survey builder UI accommodates all features without overwhelming the creator
- FR-15: All existing rating and yes_no surveys continue to function identically (backward compatible)

## Non-Goals (Out of Scope — Deferred to Layers 3-5)

- Email distribution and automated reminders (Layer 3)
- Survey scheduling (auto-open/close on date) (Layer 3)
- QR code generation (Layer 3)
- Respondent tracking and response limits (Layer 3)
- Visual analytics dashboards with charts (Layer 4)
- Cross-round comparison dashboards (Layer 4)
- Export results to PDF/Excel (Layer 4)
- AI-powered open-text theme analysis (Layer 4 — though we include text in AI context)
- Survey templates marketplace (Layer 5)
- Benchmark comparison (Layer 5)
- Real-time response monitoring (Layer 5)
- Answer piping (Layer 5)
- Drag-and-drop question reordering (move up/down buttons sufficient for now)
- Survey logic branching to different pages (single-page scroll with show/hide sufficient)
- File upload question type
- Date/time picker question type
- Ranking/sort question type

## Design Considerations

- **Response page is the #1 priority for polish** — respondents (especially external member districts) judge NIA's professionalism by this page
- **Mobile-first for response page** — many respondents will open survey links on their phones
- **Builder can be desktop-focused** — survey creators are NIA staff on laptops
- **Question type icons** — each type should have a distinct icon for quick visual identification in the builder
- **NPS is visually distinct** — the 0-10 scale with red/yellow/green gradient is an industry standard visual that leadership recognizes
- **Matrix mobile fallback** — grids don't work on phones; decompose into individual rating-style questions on small screens
- **Reuse existing UI components** — `Button`, `Badge`, `Card` from `components/ui/`, NIA color palette

## Technical Considerations

- **Migration must be backward compatible** — ALTER TABLE ADD COLUMN, not recreate. Existing CHECK constraint on `question_type` needs to be dropped and recreated with new values.
- **`options` JSONB is type-specific** — each question type uses different keys:
  - `rating`: `{ "labels": ["Label 1", ...] }` (optional custom labels)
  - `multiple_choice`: `{ "choices": ["A", "B", "C"], "allow_other": true }`
  - `checkbox`: `{ "choices": ["A", "B", "C"], "allow_other": true }`
  - `open_text`: `{ "variant": "short" | "long", "max_length": 500 }`
  - `nps`: `{}` (no options — standardized 0-10)
  - `matrix`: `{ "rows": ["Row 1", ...], "columns": ["Col 1", ...] }`
  - `yes_no`: `{}` (unchanged)
  - Skip logic condition: `{ "condition": { "question_index": N, "operator": "equals" | "not_equals" | "greater_than" | "less_than", "value": any } }`
- **Matrix answers create multiple `survey_answers` rows** — one per row, using `value_json` to identify which row
- **Checkbox answers use `value_json`** — `{ "selected": [0, 2, 4] }` (array of selected option indices)
- **Results aggregation complexity** — matrix and checkbox require different aggregation than simple avg/count. Consider computing results in the API route (not in SQL) for flexibility.
- **AI context budget** — new question types generate more data. Cap survey context at 1500 chars (up from 1000) and prioritize rating/NPS/yes_no results over text responses.
- **Template seed data** — include 3 starter templates in a seed SQL script or in the migration itself

## Success Metrics

- Survey creators can build a survey using any of 7 question types in under 5 minutes
- Respondents can complete a 10-question mixed-type survey on mobile in under 3 minutes
- Existing rating/yes_no surveys continue to work with zero changes needed
- At least 3 reusable templates available immediately after migration
- AI can generate surveys using all 7 question types with appropriate rationale

## Resolved Decisions

1. **Matrix metric linking:** Deferred to Layer 4. For now, matrix questions have no per-row metric linking — the whole matrix is one question.
2. **Conditional logic complexity:** Single conditions only (one condition per question). No AND/OR combinations — covers 90% of use cases, keeps builder UI simple.
3. **Template sharing:** Only admins can share templates org-wide. All users can browse and use shared templates. Users can always create private templates for themselves.
4. **Builder as modal vs. page:** Convert to full page at `/surveys/new` and `/surveys/[id]/edit`. The current modal is too small for 7 question types + sections + logic + templates.
