# PRD: Process Surveys

## Introduction

Process owners in the NIA Excellence Hub need evidence that their processes work. Surveys are one of the best ways to gather this evidence — stakeholder feedback directly measures process effectiveness. Today, collecting survey data requires a 6-step manual workflow: create a survey in Google Forms, deploy it, export to Google Sheets, summarize the data, hand-enter results into Hub metrics, and link metrics to processes. This friction means surveys are underused and the Learning dimension of ADLI stays weak.

This feature adds built-in micro-surveys directly to the Excellence Hub. Process owners create short surveys (3-7 questions) from their process page, the AI helps design questions based on the charter and ADLI sections, respondents answer via a shareable link, and results automatically flow into the existing metrics system. Surveys are reusable across improvement cycles (waves) for trend comparison.

## Goals

- Eliminate the manual workflow for survey-based measurement (6 steps → 1 click to deploy)
- Connect survey results directly to process metrics with zero manual data entry
- Enable reusable survey templates that can be redeployed each improvement cycle
- Help process owners design effective survey questions with AI coaching
- Keep surveys short (3-7 questions) to avoid respondent fatigue
- Support both authenticated (@thenia.org) and public (anonymous link) survey modes

## User Stories

### US-001: Survey Database Schema

**Description:** As a developer, I need database tables to store surveys, questions, deployment waves, and responses so that all survey data persists and connects to the existing metrics system.

**Acceptance Criteria:**

- [ ] `surveys` table created with: id, process_id (FK), title, description, is_public (boolean), is_anonymous (boolean), created_by, created_at, updated_at
- [ ] `survey_questions` table created with: id, survey_id (FK), question_text, question_type (rating/yes_no), sort_order, rating_scale_max (default 5), metric_id (FK nullable — links to metrics table when creator chooses)
- [ ] `survey_waves` table created with: id, survey_id (FK), wave_number, status (draft/open/closed), share_token (unique, for public URL), opened_at, closed_at, response_count (cached)
- [ ] `survey_responses` table created with: id, wave_id (FK), respondent_email (nullable — null when anonymous), submitted_at
- [ ] `survey_answers` table created with: id, response_id (FK), question_id (FK), value_numeric (for ratings/yes_no), value_text (nullable — for optional comments)
- [ ] RLS policies: authenticated users can read surveys/questions/waves for their processes; public responses allowed via share_token check; admin can read all
- [ ] Foreign key from `surveys.process_id` to `processes.id` with CASCADE delete
- [ ] Unique constraint on `survey_waves.share_token`
- [ ] Migration file created and runs cleanly

### US-002: Survey CRUD API

**Description:** As a process owner, I need API endpoints to create, read, update, and delete surveys and their questions so the frontend can manage surveys.

**Acceptance Criteria:**

- [ ] `GET /api/surveys?processId=N` returns all surveys for a process with question count and latest wave status
- [ ] `POST /api/surveys` creates a survey with questions in a single request (accepts `{ processId, title, description, isPublic, isAnonymous, questions: [...] }`)
- [ ] `PATCH /api/surveys/[id]` updates survey title, description, settings, and questions (full replace of questions array)
- [ ] `DELETE /api/surveys/[id]` deletes survey and all related data (waves, responses, answers)
- [ ] All routes require authentication and verify the user has access to the process
- [ ] Validation: survey must have 1-10 questions, each question must have text and valid type

### US-003: Survey Builder UI

**Description:** As a process owner, I want to create a survey from my process page so I can start measuring process effectiveness without leaving the Hub.

**Acceptance Criteria:**

- [ ] "Create Survey" button appears in the Metrics section of the process detail page
- [ ] Clicking opens a slide-out panel or modal with the survey builder form
- [ ] Builder includes: title, description, public/authenticated toggle, anonymous/identified toggle
- [ ] Question editor: add/remove/reorder questions, choose type (Rating 1-5 or Yes/No), edit question text
- [ ] Each question has an optional "Link to Metric" dropdown — shows existing unlinked metrics for this process, plus "Create New Metric" option
- [ ] "Create New Metric" inline: enter metric name, unit auto-set based on question type (score for rating, % for yes/no), cadence defaults to match survey intent
- [ ] Preview mode shows what respondents will see
- [ ] Save creates the survey via `POST /api/surveys`
- [ ] Maximum 10 questions enforced in UI with helper text encouraging 3-7

### US-004: AI Survey Design Assistant

**Description:** As a process owner, I want the AI to suggest survey questions based on my process documentation so I don't have to start from scratch.

**Acceptance Criteria:**

- [ ] "Suggest Questions with AI" button in the survey builder
- [ ] Calls the existing `/api/ai/chat` endpoint with a specific prompt that includes the process charter, ADLI sections, and existing metrics
- [ ] AI returns a structured `survey-questions` block with 3-5 suggested questions, each with: question text, question type, and rationale for why this question measures process effectiveness
- [ ] Suggested questions appear as cards in the builder — user can accept (adds to survey), edit, or dismiss each one
- [ ] AI suggestions respect grounding rules — questions reference actual process content, not invented details
- [ ] System prompt addition for the AI: instructions on how to design effective survey questions (short, specific, measurable, tied to ADLI dimensions)

### US-005: Wave Deployment

**Description:** As a process owner, I want to deploy my survey and get a shareable link so respondents can fill it out.

**Acceptance Criteria:**

- [ ] `POST /api/surveys/[id]/waves` creates a new wave with status "open" and generates a unique share_token (URL-safe, 12 characters)
- [ ] Returns the shareable URL: `/survey/respond/[share_token]`
- [ ] "Deploy Survey" button on the survey card (process detail page) creates a wave and shows the link
- [ ] Copy-to-clipboard button for the share link
- [ ] Wave number auto-increments (Wave 1, Wave 2, etc.)
- [ ] `PATCH /api/surveys/[id]/waves/[waveId]` can close a wave (status → "closed")
- [ ] Only one wave can be open at a time per survey — deploying a new wave auto-closes the previous one
- [ ] Survey card on process page shows: wave status (open/closed), response count, share link if open

### US-006: Public Survey Response Page

**Description:** As a survey respondent, I want to answer the survey via a simple link without needing to log in so I can give feedback quickly.

**Acceptance Criteria:**

- [ ] `/survey/respond/[token]` page is excluded from auth middleware (public access)
- [ ] Page loads survey title, description, and questions from the share_token
- [ ] Rating questions render as a row of selectable numbers (1-5) with labels at endpoints (e.g., "Strongly Disagree" to "Strongly Agree")
- [ ] Yes/No questions render as two large buttons
- [ ] Optional comment field at the bottom: "Any additional comments?" (stored as value_text on a special "comments" question or separate field)
- [ ] Submit button validates all questions answered, then `POST /api/surveys/respond` saves the response
- [ ] Success page: "Thank you for your feedback!" with NIA branding
- [ ] If wave is closed or token is invalid, show a friendly "This survey is no longer accepting responses" message
- [ ] If survey requires authentication (is_public = false), redirect to login first
- [ ] Mobile-responsive design — most respondents will answer on their phone
- [ ] No back button / no editing after submit (one submission per visit)
- [ ] `survey_waves.response_count` incremented on each submission

### US-007: Auto-Generate Metric Entries from Survey Results

**Description:** As a process owner, when I close a survey wave, I want the results to automatically become metric data points so my process metrics stay current without manual entry.

**Acceptance Criteria:**

- [ ] When a wave is closed (`PATCH .../waves/[id]` with status "closed"), trigger metric entry generation
- [ ] For each question linked to a metric (`survey_questions.metric_id IS NOT NULL`):
  - Rating questions: compute the average score across all responses → create an `entries` row with value = average, date = wave closed date, note_analysis = "Survey: [survey title], Wave [N], [response_count] responses"
  - Yes/No questions: compute the percentage of "Yes" responses → create an `entries` row with value = percentage, unit should be "%"
- [ ] If the metric doesn't exist yet (creator chose "Create New Metric" during setup), create it now and link via `metric_processes`
- [ ] Skip questions with no metric link (they're still stored as raw data, just not auto-entered)
- [ ] Entry creation is idempotent — closing a wave twice doesn't create duplicate entries (check for existing entry with matching date + note pattern)
- [ ] Return a summary: "3 metrics updated from 24 responses"

### US-008: Survey Results View

**Description:** As a process owner, I want to see survey results on my process page so I can understand stakeholder feedback at a glance.

**Acceptance Criteria:**

- [ ] Survey card on process detail page expands to show results when a wave has responses
- [ ] Per-question results: average rating (with bar chart showing distribution) or Yes/No percentage (with pie or bar)
- [ ] Overall response count and response rate context (if known)
- [ ] Comments section: list of text responses (anonymized if survey is anonymous)
- [ ] If multiple waves exist, show the latest wave results by default with a wave selector dropdown
- [ ] Wave comparison: when 2+ waves exist, show trend arrows per question (up/down/flat vs. previous wave)
- [ ] "Redeploy Survey" button creates a new wave from the same template
- [ ] Link to full results detail (could be a modal or expandable section)

### US-009: Survey Context in AI Coaching

**Description:** As a process owner using the AI coach, I want the AI to reference my survey results when analyzing my process so its recommendations are grounded in real feedback.

**Acceptance Criteria:**

- [ ] `buildProcessContext()` in `/api/ai/chat/route.ts` includes a new "Survey Results" section
- [ ] Section includes: survey title, latest wave results (per-question averages), response count, trend vs. previous wave (if available)
- [ ] Capped at ~1000 characters to stay within context budget
- [ ] AI system prompt updated: "When survey data is available, reference specific findings in your coaching. Survey results are direct evidence for the Learning dimension."
- [ ] AI should flag declining survey scores as a priority area
- [ ] AI should acknowledge strong survey results as evidence of process effectiveness

### US-010: Survey Management on Process Page

**Description:** As a process owner, I want to manage my surveys (edit, redeploy, delete) from the process page so everything stays in one place.

**Acceptance Criteria:**

- [ ] Surveys section on process detail page shows all surveys for this process
- [ ] Each survey card shows: title, question count, latest wave status, response count
- [ ] Actions per survey: Edit (opens builder), Deploy/Redeploy, View Results, Delete (with confirmation)
- [ ] Edit is only allowed when no wave is currently open (must close first)
- [ ] Delete confirmation warns about losing all historical response data
- [ ] Empty state: "No surveys yet — create one to start measuring process effectiveness"

## Functional Requirements

- FR-1: Surveys are created from and linked to a specific process (one process can have multiple surveys)
- FR-2: Each survey has 1-10 questions of type "rating" (1-5 scale) or "yes_no"
- FR-3: Survey creator chooses whether the survey is public (anyone with link) or authenticated (@thenia.org login required)
- FR-4: Survey creator chooses whether responses are anonymous or identified
- FR-5: Each question can optionally link to a metric — when linked, closing a wave auto-creates a metric entry
- FR-6: Surveys are deployed as "waves" — each deployment is a new wave with a unique shareable link
- FR-7: Only one wave per survey can be open at a time
- FR-8: The response page works without authentication when the survey is public
- FR-9: Rating question results are averaged; Yes/No results are computed as percentage "Yes"
- FR-10: AI can suggest survey questions based on the process charter and ADLI sections
- FR-11: Survey results are included in the AI coaching context for the process
- FR-12: Closing a wave triggers automatic metric entry creation for linked questions
- FR-13: Wave-over-wave trend comparison is available when 2+ waves exist
- FR-14: The survey response page must be mobile-responsive
- FR-15: An optional open-ended "Comments" field is available at the end of every survey (not linked to a metric, stored as qualitative context)

## Non-Goals (Out of Scope)

- **Email distribution** — surveys are shared via link only (no built-in email sending for now)
- **Conditional logic** — no skip patterns or branching questions
- **Multiple choice questions** — only rating scales and yes/no (can add later)
- **Response editing** — respondents cannot change their answers after submission
- **Scheduled auto-deployment** — waves are manually created (automation can come later)
- **Cross-process survey comparison** — comparing the same survey across different processes
- **Export to PDF/Excel** — survey results are viewable in-app only for now
- **NPS (Net Promoter Score)** — specific NPS question type can be added later
- **Response rate tracking** — would require knowing the target audience size (future feature)
- **Partial responses** — respondents must complete all questions before submitting

## Design Considerations

- Survey builder should reuse the existing slide-out panel pattern (similar to AI chat panel)
- Response page should be clean, minimal, and fast — NIA branding but no sidebar/navigation
- Survey cards on the process page should sit alongside existing metric cards in the Metrics section
- Rating scale UI: horizontal number buttons (1-5) with endpoint labels, similar to common survey tools
- Wave comparison: use the same sparkline pattern already used for metric trends
- Reuse existing NIA color palette — green for positive trends, orange for neutral, red for declining

## Technical Considerations

- **Auth middleware exclusion:** The `/survey/respond/[token]` route must bypass the existing middleware auth check. Use a path-based exclusion in `middleware.ts`
- **RLS for public responses:** Need a Supabase RLS policy that allows INSERT on `survey_responses` and `survey_answers` without auth, validated by share_token → open wave
- **Share token generation:** Use `crypto.randomUUID().slice(0, 12)` or similar for URL-safe tokens
- **Metric entry idempotency:** Use a combination of metric_id + date + note pattern to detect duplicate entries when closing a wave
- **Database migration:** Single migration file for all 5 new tables (surveys, survey_questions, survey_waves, survey_responses, survey_answers)
- **Existing integration points:**
  - `metric_processes` junction table for linking survey-generated metrics to processes
  - `entries` table for storing computed survey results as metric data points
  - `/api/ai/chat` system prompt for survey context injection
  - `lib/process-health.ts` — survey metrics automatically improve the Measurement dimension score
  - `lib/review-status.ts` — survey-generated entries follow the same cadence-based review logic

## Success Metrics

- Process owners can create and deploy a survey in under 5 minutes
- Survey results appear as metric entries with zero manual data entry
- At least 3 processes have active surveys within the first month of launch
- Survey response pages load in under 2 seconds on mobile
- Wave-over-wave comparison shows clear trends for returning surveys

## Open Questions

1. Should there be a maximum number of surveys per process? (Suggestion: no hard limit, but UI guidance to keep it focused)
2. Should wave closure be manual only, or should we add an optional auto-close date? (Start manual, add auto-close later)
3. Should the AI be able to create surveys autonomously (via coach-suggestions), or only assist when the user clicks "Suggest Questions"? (Start with user-initiated only)
4. Do we need a "draft" state for waves, or is it always create → immediately open? (Start with immediate open, add draft later if needed)
5. For authenticated surveys, should we prevent duplicate responses from the same user? (Probably yes — track by auth_id)
