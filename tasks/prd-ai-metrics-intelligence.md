# PRD: AI Metrics Intelligence

## Introduction

The AI coach currently sees which metrics are linked to a process (name, latest value, target) but has no awareness of metric trends, review status, or the broader metric catalog. This means it can suggest "you should track response times" as a generic task, but it can't say "there's already a Response Time metric in your system at 12 min against a 10 min target — link it to this process."

This feature gives the AI full metrics awareness so it can:

- Recommend linking existing metrics that match the process
- Propose creating new metrics with editable defaults
- Flag overdue, off-target, or declining metrics during ADLI assessments
- Use trend data to make more grounded coaching suggestions

## Goals

- AI can recommend linking specific existing metrics to a process (one-click + edit fallback)
- AI can propose new metrics with editable name/unit/cadence/target (one-click create + link)
- AI sees last 3 data points per linked metric for trend awareness
- AI sees review status (current/overdue/due-soon) for linked metrics
- AI proactively flags metric issues during ADLI assessments (not every response)
- No new database migrations required (uses existing tables)

## User Stories

### US-001: Enrich linked metrics context for AI

**Description:** As a process owner, I want the AI to see metric trends and review status so that its coaching is grounded in actual data, not just the latest number.

**Acceptance Criteria:**

- [ ] `buildMetricsContext()` includes last 3 values per metric (chronological order)
- [ ] Context includes review status: current, due-soon, overdue, or no-data
- [ ] Context includes on-target status (above/below target, and whether higher is better)
- [ ] Context shows trend direction (improving, declining, flat) computed from last 3 values
- [ ] Typecheck passes

### US-002: Send available metrics catalog to AI

**Description:** As a process owner, I want the AI to know what metrics exist in the system so that it can recommend linking relevant ones instead of generic "track this" tasks.

**Acceptance Criteria:**

- [ ] AI context includes a "Available Metrics (Not Linked)" section
- [ ] Lists up to 20 unlinked metrics with name, unit, cadence, and category
- [ ] Grouped or annotated by Baldrige category for relevance matching
- [ ] Context budget stays reasonable (cap the section at ~1500 chars)
- [ ] Typecheck passes

### US-003: AI system prompt — metric recommendations

**Description:** As a process owner, I want the AI to proactively suggest relevant metrics during ADLI assessments so I don't miss measurement gaps.

**Acceptance Criteria:**

- [ ] System prompt instructs AI to check metrics during assessment and deep_dive steps
- [ ] AI should flag: (a) processes with no linked metrics, (b) ADLI Learning section with no measurement plan, (c) unlinked metrics that match the process topic
- [ ] AI uses a new structured block `metric-suggestions` for link/create recommendations
- [ ] AI does NOT force metric discussion in every response — only during assessments and when directly relevant
- [ ] **Timeout guardrail:** Maximum 2 metric suggestions per response
- [ ] **Timeout guardrail:** AI must NOT combine `metric-suggestions` and `coach-suggestions` blocks in the same response — pick one or the other. If flagging metric gaps, don't also rewrite ADLI sections in the same message.
- [ ] Typecheck passes

### US-004: Metric suggestion cards in AI chat panel

**Description:** As a process owner, I want to see AI metric recommendations as actionable cards so I can link or create metrics with one click.

**Acceptance Criteria:**

- [ ] New `MetricSuggestionCard` component renders for `metric-suggestions` blocks
- [ ] "Link existing" cards show: metric name, unit, cadence, latest value, and a "Link to Process" button
- [ ] "Create new" cards show: proposed name, unit, cadence, target with inline editing before confirming
- [ ] Both card types have a secondary "View Details" or "Edit First" link
- [ ] Typecheck passes
- [ ] Verify in browser

### US-005: One-click link existing metric

**Description:** As a process owner, I want to link a recommended metric to my process directly from the AI suggestion card so I don't have to navigate away.

**Acceptance Criteria:**

- [ ] "Link to Process" button on metric suggestion card calls the link API
- [ ] Uses existing `metric_processes` junction table insert (same as the manual link flow)
- [ ] Button shows loading state while linking
- [ ] Success message appears in chat: "Linked [Metric Name] to this process"
- [ ] Process detail page refreshes to show the newly linked metric
- [ ] Typecheck passes
- [ ] Verify in browser

### US-006: One-click create + link new metric

**Description:** As a process owner, I want to create a new metric from an AI recommendation and link it to my process so I can start tracking it immediately.

**Acceptance Criteria:**

- [ ] "Create new" suggestion card shows editable fields: name, unit, cadence, target value
- [ ] User can modify any field before confirming (inline editing, not a separate page)
- [ ] "Create & Link" button inserts into `metrics` table + `metric_processes` junction
- [ ] Success message appears in chat: "Created [Metric Name] and linked to this process"
- [ ] Process detail page refreshes to show the new metric
- [ ] Typecheck passes
- [ ] Verify in browser

### US-007: API endpoint for AI metric actions

**Description:** As a developer, I need an API endpoint that handles both link-existing and create-new metric actions from AI suggestions.

**Acceptance Criteria:**

- [ ] New POST endpoint at `/api/ai/metrics` (or extend `/api/ai/apply`)
- [ ] Accepts `{ processId, action: "link", metricId }` for linking existing
- [ ] Accepts `{ processId, action: "create", metric: { name, unit, cadence, target_value } }` for creating new
- [ ] Returns the linked/created metric data
- [ ] Uses authenticated Supabase client (`createSupabaseServer()`)
- [ ] Validates that the metric isn't already linked (no duplicate junction rows)
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `buildMetricsContext()` sends last 3 values, trend direction, review status, and on-target status for each linked metric
- FR-2: A new `buildAvailableMetricsContext()` function sends up to 20 unlinked metrics (name, unit, cadence, category) capped at ~1500 chars
- FR-3: The AI system prompt includes instructions for when to recommend metrics (assessments, deep dives, Learning dimension gaps)
- FR-4: A new `metric-suggestions` structured block format allows the AI to recommend linking or creating metrics
- FR-5: The `parseMetricSuggestions()` function extracts metric suggestions from AI responses (same pattern as `parseCoachSuggestions`)
- FR-6: `MetricSuggestionCard` renders link-existing and create-new cards with action buttons
- FR-7: Create-new cards support inline editing of metric fields before confirmation
- FR-8: `/api/ai/metrics` POST endpoint handles link and create actions with Supabase auth
- FR-9: Successful metric actions post a confirmation message to the chat and trigger `onProcessUpdated()`
- FR-10: AI is limited to maximum 2 metric suggestions per response (prevents long outputs)
- FR-11: AI must never output `metric-suggestions` and `coach-suggestions` in the same response — one type per message to keep output size manageable and avoid timeouts

## Non-Goals

- No bulk metric linking (one at a time from AI suggestions)
- No metric unlinking from AI (user does that manually)
- No AI-generated metric values or data entry
- No changes to the existing manual metric linking flow on the process detail page
- No metric deletion from AI suggestions
- No changes to the Data Health page or metric detail pages

## Design Considerations

- Metric suggestion cards should be visually distinct from coach suggestion cards (different accent color — maybe the NIA green since metrics = measurement = Learning dimension)
- "Create new" cards need inline editing that feels lightweight — not a full form, just a few editable fields with sensible AI-provided defaults
- Keep the available metrics context lean — 20 metrics at ~75 chars each = ~1500 chars, which fits within the context budget

## Technical Considerations

- **No new migrations needed** — uses existing `metrics` and `metric_processes` tables
- **Context budget:** The AI chat route already caps charter at 2000 chars and ADLI at 1500 chars each. Adding ~1500 chars for available metrics + ~500 chars for enriched linked metrics keeps total context manageable
- **Trend calculation:** Compute in `buildMetricsContext()` server-side, not in the AI prompt. Compare last 3 values: if consistently increasing = "improving", consistently decreasing = "declining", otherwise = "flat"
- **Review status:** Reuse existing `getReviewStatus()` from `lib/review-status.ts` — already handles cadence-based calculations
- **Structured output parsing:** Follow the same pattern as `parseCoachSuggestions()` — fenced code block with JSON, plus partial-block stripping during streaming
- **Available metrics query:** Fetch all metrics, subtract the linked ones, group by category. Use the same `metric_processes` junction table query pattern
- **Timeout prevention:** The two guardrails (max 2 metric suggestions, never combine with coach-suggestions) keep output size bounded. Metric suggestion JSON is small (~200 chars per suggestion) compared to coach-suggestions which include full markdown content rewrites. This means metric-only responses should be fast.

## Implementation Order

Work through these in layer order (each builds on the last):

1. **US-001** — Enrich linked metrics context (backend only, changes `buildMetricsContext()`)
2. **US-002** — Add available metrics catalog to context (backend only, new `buildAvailableMetricsContext()`)
3. **US-003** — Update AI system prompt with metric coaching instructions
4. **US-007** — API endpoint for link/create actions
5. **US-004** — Metric suggestion cards in chat panel (frontend)
6. **US-005** — One-click link existing metric (wire card → API)
7. **US-006** — One-click create + link new metric (wire card → API with inline edit)

## Success Metrics

- AI recommends linking a specific existing metric when one matches the process topic
- AI flags "no metrics linked" for processes missing measurements
- AI references trend data ("your satisfaction score has declined from 92 to 87 over the last 3 quarters")
- Users can link or create metrics without leaving the AI chat panel
- No increase in AI response time (context additions are small)

## Open Questions

- Should the AI see metrics from processes in the same Baldrige category (for cross-process metric recommendations)?
- Should linked metric cards in the chat show the sparkline visualization, or is text-based trend description sufficient?
- When creating a new metric, should `is_higher_better` default to true, or should the AI infer it from context?
