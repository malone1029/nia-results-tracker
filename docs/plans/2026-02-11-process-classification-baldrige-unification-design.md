# Process Classification & Baldrige Connections Unification

**Date:** 2026-02-11
**Status:** Approved

## Problem

The NIA Excellence Hub has two confusing systems for Baldrige connections:

1. **Legacy:** `baldrige_connections` JSONB field on the `processes` table — unstructured, hidden from users, still used by health scoring
2. **Current:** `process_question_mappings` junction table — structured, powers the Criteria Map page, but not visible on process pages

Additionally, process classification uses a boolean `is_key` field that leaves non-key processes unlabeled (ambiguous "not key" vs. intentional "support").

## Goals

- **Application readiness:** Clear process classification and connections help tell the Baldrige story
- **Daily usability:** Process owners understand what's connected and why without navigating to a separate page
- **Examiner impression:** Show intentional classification of every process in the framework

## Design Decisions

| Decision                      | Choice                                       | Rationale                                       |
| ----------------------------- | -------------------------------------------- | ----------------------------------------------- |
| Process types                 | Key / Support (two values)                   | Matches Baldrige framework exactly              |
| Classification method         | AI-suggested + human confirm                 | Intentional but low-effort                      |
| Existing `is_key` processes   | All reset to "unclassified" for fresh review | Current labels may not be accurate              |
| Mapping method                | AI-only + human confirm (no manual mapping)  | Consistent, explainable                         |
| Mapping direction             | Both (Criteria Map + process pages)          | Users can discover connections from either side |
| Process page placement        | Overview tab, right column                   | First thing owners see                          |
| Legacy `baldrige_connections` | Convert remaining data, then stop using      | Clean break                                     |

## Process Classification (Key / Support)

### Database

- New column: `process_type TEXT DEFAULT 'unclassified'` (values: `key`, `support`, `unclassified`)
- Migration: all existing processes set to `unclassified` (including former `is_key = true`)
- Drop `is_key` column after migration

### Classification Review Flow

1. "Review Process Classifications" button on process list page
2. AI analyzes every process's charter, description, and Baldrige category
3. Presents a review table:
   - Process name
   - Former status (was key / was unlabeled)
   - AI recommendation (Key / Support)
   - One-line rationale
4. User reviews each row — Accept AI suggestion or Override
5. Bulk "Accept All" option
6. Save all classifications at once

### UI Changes

- **Process edit page:** Star toggle replaced with Key/Support segmented control + helper text
- **Process list page:** Key = orange star, Support = subtle gray label
- **Unclassified prompt:** Processes without classification show "Classify this process" nudge
- **Readiness page:** `process_type === 'key'` gets 2x weighting (same as before)
- **Criteria Map:** Shows Key/Support badge next to process names

## Unified Baldrige Connections

### Single Source of Truth

`process_question_mappings` table powers everything:

- Criteria Map page (question-centric view)
- Process detail pages (process-centric view)
- Health score (Documentation dimension)
- Gap Analysis
- Application Drafts

### Process Detail Page (Overview Tab)

New "Baldrige Connections" card in right column:

```
Baldrige Connections
--------------------
6.1 Work Processes — 3 questions (primary)
  > [expand to see individual questions]
1.1 Senior Leadership — 1 question (supporting)
  > [expand to see individual questions]

[Find Baldrige Connections] button
[Manage on Criteria Map ->] link
```

- Grouped by Baldrige item
- Each item shows question count and highest coverage level
- Expand/collapse to see individual questions with coverage badges
- "Find Baldrige Connections" button triggers AI scan for this process
- "Manage on Criteria Map" links to `/criteria`

### AI Mapping — Both Directions

**From Criteria Map (question -> processes):**

- AI Scan All: scans unmapped questions, suggests processes (existing)
- Per-question "Suggest Mappings" button (existing)
- No manual "add mapping" UI (removed)

**From Process Page (process -> questions) — NEW:**

- "Find Baldrige Connections" button on process detail page
- AI analyzes process charter + ADLI content against all unmapped questions
- Shows suggestion cards on the process page with Accept/Dismiss
- Accepted suggestions write to `process_question_mappings`
- Results visible on both process page and Criteria Map

### Health Score Update

`lib/process-health.ts` Documentation dimension:

- Old: checks `baldrige_connections` JSONB for content (2 points)
- New: checks `process_question_mappings` count > 0 (2 points)

### Legacy Cleanup

1. Run `/api/criteria/convert-legacy` one final time
2. Stop referencing `baldrige_connections` in health scoring
3. Replace edit page "Managed automatically" box with read-only connections view
4. Stop reading/writing `baldrige_connections` anywhere in codebase
5. Leave DB column in place (no schema deletion needed)

## Implementation Sequence

1. **Database migration** — add `process_type`, update health score source
2. **Process Classification review flow** — AI classify + review table + edit page control
3. **Find Baldrige Connections on process pages** — new API + suggestion cards + read-only view
4. **Criteria Map cleanup** — remove manual mapping UI
5. **Legacy cleanup** — convert data, remove old field references
6. **Polish** — badges on Criteria Map, process type in Gap Analysis

## What We're NOT Building

- No new database tables (reusing `process_question_mappings`)
- No changes to the draft/narrative system
- No changes to Asana sync
- No offline/caching changes
