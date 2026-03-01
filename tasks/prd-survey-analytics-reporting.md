# PRD: Survey Analytics & Reporting (Layer 4)

## Introduction

Add a dedicated survey results dashboard with visual charts, cross-wave trend analysis, AI-generated executive summaries, and PDF/CSV export. Currently, survey results are displayed inline on the process detail page as basic text and colored bars. This upgrade gives process owners and leadership a professional analytics experience — visual charts for presentations, AI narratives that interpret what the numbers mean, and downloadable reports for sharing with stakeholders who don't log into the Hub.

## Goals

- Provide a full-page results dashboard for each survey with visual charts
- Show trends across all survey waves (rounds) on a single chart
- Generate editable AI executive summaries that interpret results in context
- Export professional PDF reports for leadership sharing
- Export raw response data as CSV for custom analysis
- Link seamlessly from the process detail page to the new dashboard

## User Stories

### US-001: Full-page results dashboard

**Description:** As a process owner, I want a dedicated results page for each survey so I can see all analytics in one place without scrolling through the process detail page.

**Acceptance Criteria:**

- [ ] New route at `/surveys/[id]/results` shows full-page dashboard
- [ ] Page header shows survey title, process name (linked), total responses, and wave selector
- [ ] Wave selector dropdown lets user pick any wave (defaults to latest)
- [ ] Dashboard sections: Overview stats, Question charts, Open-text responses, AI Summary
- [ ] Loading skeleton while data fetches
- [ ] Process detail page "View Results" button links to this dashboard
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Overview stats cards

**Description:** As a process owner, I want key metrics at the top of the dashboard so I can see the big picture at a glance.

**Acceptance Criteria:**

- [ ] Stats row shows: Total Responses, Response Rate (if response target exists), Overall NPS (if survey has NPS question), Completion Rate
- [ ] Each stat card shows current value and trend arrow vs. previous wave (if available)
- [ ] NPS card color-coded: red (<0), yellow (0-49), green (50+)
- [ ] Cards are responsive — 2x2 grid on mobile, 4-across on desktop
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Rating question charts

**Description:** As a process owner, I want bar charts for rating questions so I can see the distribution of responses visually.

**Acceptance Criteria:**

- [ ] Each rating question renders a horizontal bar chart (Recharts `BarChart`)
- [ ] Bars labeled with the custom scale labels (e.g., "Strongly Disagree" through "Strongly Agree")
- [ ] Bar colors use a green gradient (darker = higher rating)
- [ ] Average score displayed prominently next to chart title
- [ ] Trend indicator (up/down arrow + delta) shown when previous wave data exists
- [ ] Response count shown below chart
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: NPS visualization

**Description:** As a process owner, I want a dedicated NPS visualization showing the score, segment breakdown, and distribution.

**Acceptance Criteria:**

- [ ] Large NPS score number in center with color coding (red/yellow/green)
- [ ] Stacked horizontal bar showing Detractors (red) | Passives (yellow) | Promoters (green) with percentages
- [ ] Distribution chart below showing counts for each score 0-10 (Recharts `BarChart`)
- [ ] Segment counts labeled: "X Detractors (0-6), Y Passives (7-8), Z Promoters (9-10)"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Multiple choice and checkbox charts

**Description:** As a process owner, I want pie/donut charts for choice-based questions so I can see the proportion of each answer.

**Acceptance Criteria:**

- [ ] Multiple choice questions render a donut chart (Recharts `PieChart`) with legend
- [ ] Checkbox questions render a horizontal bar chart (since respondents pick multiple)
- [ ] Colors auto-assigned from a NIA-branded palette
- [ ] Hover/click shows exact count and percentage
- [ ] "Other" responses listed below chart if any exist
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Matrix question visualization

**Description:** As a process owner, I want a heatmap-style table for matrix questions so I can compare rows at a glance.

**Acceptance Criteria:**

- [ ] Matrix renders as a styled table: rows on left, columns across top
- [ ] Cell background color intensity reflects the count (darker = more responses)
- [ ] Row averages shown in rightmost column
- [ ] Overall average shown in footer
- [ ] Responsive: horizontal scroll on mobile if needed
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Open-text response display

**Description:** As a process owner, I want to read all open-text responses in a clean, scannable format.

**Acceptance Criteria:**

- [ ] Open-text questions show all responses in a card list (no truncation limit)
- [ ] Each response in its own card with subtle border
- [ ] Response count shown in section header
- [ ] If question has >10 responses, show first 10 with "Show all" expand button
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Cross-wave trend charts

**Description:** As a process owner, I want to see how each question's scores change across all waves so I can track improvement over time.

**Acceptance Criteria:**

- [ ] New API endpoint fetches aggregated results for ALL waves of a survey in one call
- [ ] "Trends" tab on dashboard shows a Recharts `LineChart` per rating/NPS/yes_no question
- [ ] Each line represents one question, x-axis = wave number, y-axis = average score
- [ ] NPS questions shown on separate chart (different scale: -100 to +100)
- [ ] Hover tooltip shows exact value + wave date
- [ ] If only 1 wave exists, tab shows message: "Trends will appear after your second round"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: AI executive summary

**Description:** As a process owner, I want AI to analyze survey results and write an executive summary so I can quickly understand themes and share insights with leadership.

**Acceptance Criteria:**

- [ ] New API endpoint `/api/surveys/[id]/ai-summary` accepts waveId, sends results + open-text to Claude
- [ ] AI returns structured summary: Key Findings (3-5 bullets), Strengths, Areas for Improvement, Notable Comments, Recommended Actions
- [ ] Summary displayed in a styled card on the dashboard with section headings
- [ ] "Generate Summary" button triggers the AI call (not auto-generated on page load)
- [ ] Loading state with skeleton while AI processes
- [ ] Summary is **editable** — rendered in a contentEditable div or textarea after generation
- [ ] Edits persist in component state (used by PDF export) but are NOT saved to database
- [ ] "Regenerate" button to get a fresh AI summary (replaces current edits)
- [ ] `maxDuration = 60` on the API route for Vercel Pro
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: PDF report export

**Description:** As a process owner, I want to download a professional PDF report so I can share survey results with leadership who don't use the Hub.

**Acceptance Criteria:**

- [ ] "Download PDF" button on dashboard header
- [ ] PDF generated server-side via `@react-pdf/renderer`
- [ ] API endpoint `/api/surveys/[id]/pdf` accepts waveId + optional AI summary text
- [ ] PDF includes: cover page (survey title, process name, date, wave number, response count), overview stats, per-question results with mini-charts (bar representations), AI summary section (if provided), NIA branding (logo, colors)
- [ ] Mini-charts in PDF rendered as styled bars using react-pdf primitives (not Recharts — react-pdf can't use DOM)
- [ ] PDF filename: `{survey-title}-round-{wave-number}.pdf`
- [ ] Loading indicator while PDF generates
- [ ] Typecheck passes

### US-011: CSV raw data export

**Description:** As a process owner, I want to download raw response data as CSV so I can do custom analysis in Excel or Google Sheets.

**Acceptance Criteria:**

- [ ] "Export CSV" button on dashboard
- [ ] New API endpoint `/api/surveys/[id]/csv?waveId=N` returns CSV file
- [ ] CSV format: one row per response, columns = question texts, cells = answer values
- [ ] Rating/NPS/yes_no: numeric value in cell
- [ ] Multiple choice: selected option text in cell
- [ ] Checkbox: semicolon-separated list of selected option texts
- [ ] Open text: full text in cell (quoted to handle commas)
- [ ] Matrix: one column per "row_label", cell = selected column value
- [ ] First row = question texts as headers
- [ ] Response metadata columns: response_id, submitted_at
- [ ] Content-Disposition header triggers browser download
- [ ] Typecheck passes

### US-012: Link from process detail page

**Description:** As a process owner, I want to navigate from my process page to the survey dashboard with one click.

**Acceptance Criteria:**

- [ ] Each survey card on the process detail page shows a "View Results" button (next to existing "Edit" and wave controls)
- [ ] Button links to `/surveys/[surveyId]/results?waveId=[latestWaveId]`
- [ ] Button only appears if survey has at least 1 wave with responses
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Create route `/surveys/[id]/results` with full-page dashboard layout
- FR-2: Dashboard displays wave selector, overview stats, per-question charts, open-text section, and AI summary
- FR-3: Rating questions rendered as horizontal `BarChart` (Recharts) with custom scale labels
- FR-4: NPS questions rendered with score display, stacked segment bar, and 0-10 distribution chart
- FR-5: Multiple choice rendered as `PieChart` (donut), checkbox as horizontal `BarChart`
- FR-6: Matrix questions rendered as color-intensity table with row averages
- FR-7: Open-text responses shown as expandable card list (first 10, then "Show all")
- FR-8: New API endpoint returns aggregated results for all waves of a survey (for trend charts)
- FR-9: Trends tab shows `LineChart` per question across all waves, with hover tooltips
- FR-10: AI summary endpoint sends results data to Claude Sonnet 4.5, returns structured narrative
- FR-11: AI summary is editable in-place before export (edits stay in component state, not persisted to DB)
- FR-12: PDF generated server-side with `@react-pdf/renderer` — includes cover page, stats, question results with bar representations, and AI summary
- FR-13: CSV export returns one row per response with question texts as column headers and appropriate value formats per question type
- FR-14: Process detail page survey cards include "View Results" link when wave data exists

## Non-Goals (Out of Scope)

- **Respondent filtering** (slice by department, role) — deferred until respondent attributes are collected (Layer 3 non-anonymous tracking)
- **Real-time response monitoring** — Layer 5 feature
- **Benchmark comparison** — Layer 5 feature
- **Saving AI summaries to database** — edits are ephemeral (session only). Persistence can be added later if needed
- **Custom chart styling/colors per survey** — uses NIA brand palette only
- **Interactive chart drill-down** (click a bar to see individual responses) — keep charts read-only for now

## Design Considerations

- Dashboard layout: single column, scrollable sections, sticky wave selector
- Chart sizing: full-width on mobile, max-width constraint on desktop for readability
- NIA color palette for charts: use existing brand colors (green, orange, dark, grey-blue)
- AI summary card: white background with subtle left border accent (like coaching suggestions)
- PDF: clean, professional layout — NIA logo in header, consistent fonts, enough whitespace
- Reuse existing `survey-results.tsx` patterns where appropriate, but charts replace plain bars

## Technical Considerations

- **Recharts** is already installed — use `BarChart`, `PieChart`, `LineChart`, `ResponsiveContainer`
- **`@react-pdf/renderer`** needs to be installed (`npm install @react-pdf/renderer`)
- react-pdf can't render Recharts components — PDF charts must be built with react-pdf primitives (`View`, `Text`, `Svg`)
- All-waves trend endpoint: fetch wave list, then `Promise.all` to get results per wave — cache-friendly since closed waves don't change
- AI summary: cap input to ~4000 chars of results data to stay within fast response time
- CSV generation: use template literals to build CSV string server-side, return with `text/csv` content type
- Vercel Pro `maxDuration = 60` on AI summary and PDF routes
- Future role system note: access currently open to all authenticated users; when Teammates/Supervisors/Admin roles are added, restrict based on process ownership or role level

## Success Metrics

- Process owners can generate and share a PDF report in under 2 minutes
- AI summary accurately identifies top themes from open-text responses
- Trend charts clearly show improvement (or decline) across survey waves
- No regression in process detail page load time (dashboard is a separate route)

## Resolved Decisions

1. **PDF approach**: Server-side via `@react-pdf/renderer` — produces consistent, high-quality PDFs without a headless browser
2. **AI scope**: Full executive summary (findings, strengths, areas for improvement, notable comments, recommended actions) — editable before export
3. **Wave comparison**: All waves overlaid on trend charts (not limited to 2)
4. **Access control**: All authenticated users for now. Future role tiers (Teammates, Supervisors, Admin) will refine access

## Open Questions

None — all decisions resolved.
