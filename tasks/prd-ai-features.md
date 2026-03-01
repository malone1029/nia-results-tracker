# PRD: AI-Guided Process Improvement

## Introduction

Add AI-powered process analysis and improvement to the NIA Excellence Hub. An AI assistant (powered by Anthropic Claude) lives inside each process detail page and helps users assess process maturity using the Baldrige ADLI framework, identify gaps, get improvement suggestions, and apply changes directly. Users can also upload supporting documents (data, strategic plans, meeting notes) to give the AI richer context.

This is the highest-impact Phase 2 feature. It transforms the Excellence Hub from a documentation tool into an active improvement partner.

## Goals

- Provide instant ADLI maturity assessment for any process with a visual score
- Guide users through targeted interview questions based on their weakest ADLI dimensions
- Let users apply AI suggestions directly to process fields with one click (with undo via process history)
- Support file uploads so the AI can analyze performance data, strategic plans, and other evidence
- Help users create new processes from scratch through guided AI interviews
- Show ADLI maturity scores across all processes for category-level comparison
- Use plain English — no Baldrige jargon unless the user asks for it

## User Stories

### US-001: Anthropic Claude API Integration

**Description:** As a developer, I need a backend API route that communicates with Anthropic's Claude API so the AI features have a foundation to build on.

**Acceptance Criteria:**

- [ ] Create `/api/ai/chat` API route that accepts messages and returns Claude responses
- [ ] `ANTHROPIC_API_KEY` environment variable configured in `.env.local` and Vercel
- [ ] System prompt includes the ADLI assessment framework (maturity levels, dimension definitions, scoring signals)
- [ ] API route accepts a `processId` parameter and loads that process's full data (charter, ADLI fields, linked metrics, requirements) as context
- [ ] Conversation history is passed with each request (stateless API, client manages history)
- [ ] Error handling for API failures with user-friendly error messages
- [ ] Typecheck/lint passes

---

### US-002: AI Chat Panel on Process Detail Page

**Description:** As a user, I want to chat with an AI assistant while viewing a process so I can get analysis and improvement suggestions in context.

**Acceptance Criteria:**

- [ ] Collapsible chat panel on the right side (desktop) or bottom sheet (mobile) of the process detail page
- [ ] "Ask AI" button to open the panel, with a subtle indicator showing AI is available
- [ ] Chat interface with message input, send button, and scrollable message history
- [ ] AI messages render markdown (reuse existing `markdown-content` component)
- [ ] Loading state while waiting for AI response (typing indicator)
- [ ] Panel can be closed/reopened without losing conversation history (state preserved during session)
- [ ] Follows existing NIA brand styling (dark teal header, orange accents)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-003: ADLI Gap Analysis

**Description:** As a user, I want the AI to analyze my process and tell me what's strong, what's weak, and what's missing so I know where to focus improvement efforts.

**Acceptance Criteria:**

- [ ] "Analyze This Process" quick action button at the top of the chat panel
- [ ] AI evaluates all four ADLI dimensions (Approach, Deployment, Learning, Integration) separately
- [ ] Each dimension gets a maturity level: Reacting (0-25%), Early Systematic (30-45%), Aligned (50-65%), Integrated (70-100%)
- [ ] AI provides specific evidence from the process data to justify each score (not vague)
- [ ] AI identifies the top 2-3 gaps per weak dimension with actionable suggestions
- [ ] Results displayed as a visual scorecard (four colored bars or badges) above the chat
- [ ] Assessment uses the charter signals checklist from the ADLI spec:
  - **Approach:** purpose, methodology, process owner, inputs/outputs, rationale, repeatability
  - **Deployment:** scope, roles, communication plan, variations, stakeholder coverage
  - **Learning:** measures/KPIs, review cadence, improvement history, lessons learned, benchmarks
  - **Integration:** strategic objectives, cross-references, shared measures, upstream/downstream connections
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-004: AI-Guided Interview Questions

**Description:** As a user, I want the AI to ask me targeted questions about my process so I can fill in gaps I didn't know existed.

**Acceptance Criteria:**

- [ ] After gap analysis, AI automatically offers to help improve the weakest dimension first
- [ ] AI asks 2-3 focused questions at a time (not overwhelming), drawn from the ADLI interview bank:
  - **Weak Approach:** "What problem does this process solve?", "Could someone else follow this and get the same results?", "Is this method based on a standard or best practice?"
  - **Weak Deployment:** "Who needs to follow this process?", "How were people trained on it?", "Are there situations where it's applied differently?"
  - **Weak Learning:** "How do you know if this process is working?", "When was it last reviewed and changed?", "Have you looked at how other organizations handle this?"
  - **Weak Integration:** "Which strategic objectives does this support?", "What other processes depend on this one?", "Do these measures connect to broader dashboards?"
- [ ] User's answers are incorporated into a follow-up response with specific suggestions for improving the process text
- [ ] AI adapts questions based on what's already in the process (doesn't ask about things already documented)
- [ ] Typecheck/lint passes

---

### US-005: Apply AI Suggestions to Process

**Description:** As a user, I want to apply the AI's improvement suggestions to my process with one click so I don't have to manually copy and paste.

**Acceptance Criteria:**

- [ ] When AI suggests improvements, an "Apply to Process" button appears below the suggestion
- [ ] AI structures suggestions as specific field updates (e.g., "Update charter.purpose to: ...")
- [ ] Clicking "Apply" saves the current version to `process_history` first (safety net / undo)
- [ ] Then writes the AI's suggested content into the appropriate process fields via Supabase update
- [ ] Success confirmation shown in the chat: "Applied! Changes saved to [field name]. Previous version saved to history."
- [ ] Process detail page refreshes to show updated content
- [ ] If multiple suggestions exist, user can apply them individually (not all-or-nothing)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-006: File Upload for Process Context

**Description:** As a user, I want to upload files (data reports, strategic plans, meeting notes) to a process so the AI has richer context for its assessment.

**Acceptance Criteria:**

- [ ] "Upload File" button on the process detail page (near the AI chat panel)
- [ ] Accepted file types: PDF, XLSX, CSV, DOCX, TXT, MD, PNG, JPG (images for charts/screenshots)
- [ ] Files stored in Supabase Storage bucket (`process-files`)
- [ ] New `process_files` database table: `id`, `process_id`, `file_name`, `file_type`, `storage_path`, `uploaded_at`
- [ ] Uploaded files listed on the process detail page with download and delete options
- [ ] File size limit: 10MB per file
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-007: AI Reads Uploaded Files

**Description:** As a user, I want the AI to analyze my uploaded files alongside the process data so it can give me better, evidence-based suggestions.

**Acceptance Criteria:**

- [ ] When a process has uploaded files, AI chat API route fetches file content from Supabase Storage
- [ ] Text-based files (TXT, MD, CSV) are read directly and included in the AI context
- [ ] PDF and DOCX files are converted to text before sending to AI (use a server-side parsing library)
- [ ] XLSX/CSV files are parsed into a readable summary (column headers + sample rows)
- [ ] Image files are sent as base64 to Claude's vision capability (Claude can read charts/screenshots)
- [ ] AI references specific uploaded files in its analysis: "Based on your Q3 performance report..."
- [ ] If total context is too large, AI summarizes files rather than including full text
- [ ] Typecheck/lint passes

---

### US-008: AI-Guided New Process Creation

**Description:** As a user, I want the AI to help me create a new process from scratch through a guided conversation so I don't have to figure out the template on my own.

**Acceptance Criteria:**

- [ ] "Create with AI" button on the new process page (alongside existing Quick/Full template options)
- [ ] AI starts with simple questions: "What process do you want to document?", "What problem does it solve?", "Who's involved?"
- [ ] AI progressively builds out ADLI sections through conversation (not all at once)
- [ ] After enough information is gathered, AI generates a draft process with all fields populated
- [ ] User can review the draft in a preview before saving
- [ ] "Save as New Process" button creates the process in Supabase with all AI-generated fields
- [ ] Saved process starts in "Draft" status
- [ ] User can continue chatting to refine before or after saving
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-009: ADLI Maturity Dashboard

**Description:** As a user, I want to see ADLI maturity scores across all my processes so I can identify which categories or processes need the most attention.

**Acceptance Criteria:**

- [ ] New "AI Insights" section on the main dashboard (or a dedicated page linked from nav)
- [ ] Shows each process with its ADLI scores (four dimension bars) in a sortable table
- [ ] Grouped by Baldrige category so you can see category-level patterns
- [ ] Color coding: red (Reacting), yellow (Early Systematic), green (Aligned), dark green (Integrated)
- [ ] Category averages shown as summary row
- [ ] "Last assessed" timestamp for each process
- [ ] Click any process to open its detail page with AI panel
- [ ] ADLI scores are stored in a new `process_adli_scores` table: `id`, `process_id`, `approach_score`, `deployment_score`, `learning_score`, `integration_score`, `maturity_level`, `assessed_at`
- [ ] Scores update whenever an AI assessment is run (US-003)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

## Functional Requirements

- FR-1: Create `/api/ai/chat` POST route using `@anthropic-ai/sdk` npm package
- FR-2: System prompt encodes the full ADLI assessment framework including dimension definitions, maturity levels (Reacting/Early Systematic/Aligned/Integrated), charter assessment checklists, and interview question banks
- FR-3: Each AI request includes the full process context: charter, all ADLI fields, workflow, baldrige_connections, linked metrics, linked requirements, and uploaded file content
- FR-4: AI responses include structured data alongside natural language (JSON blocks for scores, field updates) so the UI can render scorecard visuals and "Apply" buttons
- FR-5: The "Apply to Process" action saves current version to `process_history` before writing changes
- FR-6: Files uploaded via Supabase Storage with metadata in `process_files` table
- FR-7: File content extraction: plain text for TXT/MD/CSV, parsing libraries for PDF/DOCX/XLSX, base64 for images
- FR-8: ADLI scores persisted in `process_adli_scores` table and updated on each AI assessment
- FR-9: AI-guided process creation generates a complete process object matching the existing `Process` TypeScript interface
- FR-10: All AI features work on both desktop and mobile layouts

## Non-Goals (Out of Scope)

- No real-time collaboration (multiple users chatting with AI simultaneously on the same process)
- No conversation persistence across sessions (chat history lives in browser state only — can add database storage later)
- No automatic scheduled assessments (user triggers assessments manually)
- No Asana import/export (separate Phase 2 workstream)
- No team authentication or user roles (separate Phase 2 workstream)
- No AI-powered comparison between NIA's processes and external organizations
- No fine-tuning or custom model training — uses Claude's general capabilities with detailed prompting

## Design Considerations

- Chat panel follows existing NIA brand: dark teal (`#324a4d`) header, orange (`#f79935`) accents for action buttons
- ADLI scorecard uses the existing card pattern: white cards with orange left border (`border-l-4 border-[#f79935]`)
- Score colors: red (`#dc2626`) for Reacting, orange (`#f79935`) for Early Systematic, green (`#b1bd37`) for Aligned, dark teal (`#324a4d`) for Integrated
- Chat panel should not obstruct the process content — collapsible side panel or bottom sheet
- Reuse `components/markdown-content.tsx` for rendering AI responses
- "Apply" buttons should be visually distinct (green/success color `#b1bd37`) to indicate a constructive action
- Mobile: chat panel slides up from bottom as a sheet, taking ~70% of screen height

## Technical Considerations

- **AI SDK:** `@anthropic-ai/sdk` npm package for Claude API calls
- **Model:** `claude-sonnet-4-5-20250929` for chat (good balance of speed and quality). Can upgrade to Opus for complex assessments if needed.
- **Token management:** Process context + file uploads + conversation history could get large. Implement a context budget: summarize older messages if conversation exceeds ~50k tokens.
- **Streaming:** Use Claude's streaming API for better UX (responses appear word-by-word instead of all at once after a delay)
- **File parsing libraries:** `pdf-parse` for PDFs, `mammoth` for DOCX, `xlsx` or `exceljs` for spreadsheets (already installed)
- **Supabase Storage:** Create `process-files` bucket with 10MB file size limit
- **Structured output:** AI responses include JSON blocks (fenced with triple backticks) for scores and field updates that the frontend parses to render UI elements (scorecard, Apply buttons)
- **Environment variables:** `ANTHROPIC_API_KEY` in `.env.local` (local) and Vercel project settings (production)
- **Cost awareness:** Each chat message costs money (Claude API is pay-per-token). Not a concern for single-user usage but relevant when leadership team starts using it.

## Success Metrics

- User can get an ADLI assessment for any process in under 30 seconds
- AI suggestions are specific enough that "Apply" produces meaningful process improvements (not generic boilerplate)
- Users can create a new process from scratch via AI interview in under 10 minutes
- ADLI maturity dashboard gives a clear picture of organizational process health at a glance
- File uploads provide richer AI context that results in more evidence-based suggestions

## Open Questions

- Should conversation history be saved to the database for future reference? (Adds complexity but useful for auditing what the AI suggested)
- Should there be a "bulk assess" feature that runs ADLI analysis on all processes at once to populate the dashboard?
- What is the Anthropic API cost budget? (Claude Sonnet 4.5 is ~$3/million input tokens, ~$15/million output tokens — likely very low cost for single-user usage)
- Should the AI be able to suggest linking processes to specific metrics or requirements that already exist in the system?

## Implementation Order

Build these stories in sequence — each layer adds value and can ship independently:

| Layer                 | Stories        | What Ships                                                   |
| --------------------- | -------------- | ------------------------------------------------------------ |
| **1. Foundation**     | US-001, US-002 | Chat panel works, AI responds to questions about the process |
| **2. Smart Analysis** | US-003, US-004 | ADLI scoring, gap identification, guided interview questions |
| **3. Take Action**    | US-005         | One-click apply suggestions directly to process fields       |
| **4. Richer Context** | US-006, US-007 | File uploads that AI can read and reference                  |
| **5. Create New**     | US-008         | AI-guided process creation from scratch                      |
| **6. Big Picture**    | US-009         | ADLI maturity dashboard across all processes                 |
