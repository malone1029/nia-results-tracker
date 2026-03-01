# PRD: Key Requirements Integration

## Introduction

Replace the simple "Integration" checkbox on metrics with a meaningful connection to NIA's Organizational Profile Key Requirements. In the Baldrige Excellence Framework, Integration means results are actively used in decision-making and connected to organizational priorities. Currently, Integration is a manual yes/no checkbox that doesn't tell the story of _how_ a metric connects to what stakeholders need.

This feature introduces a **Key Requirements** system — seeded from the Organizational Profile (Figure P-6) — that lets users link metrics to the stakeholder requirements they provide evidence for. A new **Key Requirements page** shows the health of each requirement based on real metric data, and highlights gaps where requirements have no supporting metrics.

Integration on the LeTCI scorecard becomes auto-calculated: if a metric is linked to at least one Key Requirement, it has Integration.

## Goals

- Create a `key_requirements` table seeded from the Organizational Profile, editable as the profile evolves
- Allow linking metrics to one or more Key Requirements (from either direction)
- Build a Key Requirements overview page showing status, linked metrics, trends, and gaps
- Auto-calculate LeTCI Integration from linked requirements (remove the manual checkbox)
- Make the connection between "what stakeholders need" and "what we measure" visible and auditable

## Seed Data

From the NIA Organizational Profile (Figure P-6):

| Sort | Stakeholder Segment | Stakeholder Group   | Key Requirement                   |
| ---- | ------------------- | ------------------- | --------------------------------- |
| 1    | Customers           | Member Districts    | Prioritization                    |
| 2    | Customers           | Member Districts    | High-quality services             |
| 3    | Customers           | Member Districts    | Cost effective                    |
| 4    | Customers           | Member Districts    | Good customer service             |
| 5    | Customers           | Non-Member Entities | High-quality services             |
| 6    | Customers           | Non-Member Entities | Cost effective                    |
| 7    | Customers           | Non-Member Entities | Good customer service             |
| 8    | Stakeholders        | Workforce           | Competitive compensation/benefits |
| 9    | Stakeholders        | Workforce           | Input and engagement              |
| 10   | Stakeholders        | Workforce           | Clear communication               |
| 11   | Stakeholders        | Workforce           | Responsive leadership             |
| 12   | Stakeholders        | Workforce           | Meaningful work                   |
| 13   | Stakeholders        | Students            | High-quality services             |
| 14   | Stakeholders        | Students            | Engaging service delivery         |
| 15   | Stakeholders        | Parents             | High-quality services             |
| 16   | Stakeholders        | Parents             | Good communication                |

Requirements are kept separate per stakeholder group (e.g., "High-quality services" is a distinct requirement for Member Districts, Students, and Parents) because the metrics that provide evidence may differ by group.

Display order: Customers first (Member Districts, Non-Member Entities), then Stakeholders (Workforce, Students, Parents). This keeps the customer perspective front and center.

## User Stories

### US-001: Create key_requirements database table and seed data

**Description:** As a developer, I need a database table to store Key Requirements so they persist and can be linked to metrics.

**Acceptance Criteria:**

- [ ] Create `key_requirements` table with columns: id (serial PK), stakeholder_segment (text), stakeholder_group (text), requirement (text), description (text, nullable), sort_order (integer)
- [ ] Create `metric_requirements` junction table with columns: id (serial PK), metric_id (integer FK to metrics), requirement_id (integer FK to key_requirements)
- [ ] Add unique constraint on metric_requirements (metric_id, requirement_id) to prevent duplicates
- [ ] Add RLS policies for public read/write (matching existing pattern)
- [ ] Update schema.sql with both tables, policies, and seed data
- [ ] Provide SQL migration for user to run in Supabase dashboard
- [ ] Typecheck passes

### US-002: Add TypeScript types for Key Requirements

**Description:** As a developer, I need TypeScript interfaces so the app can work with Key Requirements data in a type-safe way.

**Acceptance Criteria:**

- [ ] Add `KeyRequirement` interface to lib/types.ts with all table columns
- [ ] Add `MetricRequirement` interface (junction table)
- [ ] Add `KeyRequirementWithStatus` extended interface that includes: linked metric count, metrics with data count, overall health status (green/yellow/red/no-data)
- [ ] Typecheck passes

### US-003: Build Key Requirements overview page

**Description:** As a user, I want a Key Requirements page so I can see at a glance whether NIA is meeting each stakeholder requirement.

**Acceptance Criteria:**

- [ ] New page at `/requirements`
- [ ] Page title: "Key Requirements" with subtitle explaining this comes from the Organizational Profile
- [ ] Source attribution: "Source: NIA Organizational Profile, Figure P-6" displayed near the top
- [ ] Summary cards at top: total requirements, requirements with metrics linked, requirements with no metrics (gaps), requirements meeting targets
- [ ] Requirements grouped by stakeholder segment (Customers, Stakeholders), then by group within each segment, ordered: Customers (Member Districts, Non-Member Entities), then Stakeholders (Workforce, Students, Parents)
- [ ] Each requirement card shows: requirement name, stakeholder group, number of linked metrics, overall health indicator
- [ ] Health indicator logic: green = all linked metrics on target, yellow = some linked metrics below target or missing trend data, red = majority of linked metrics below target, gray = no metrics linked (gap)
- [ ] Clicking a requirement expands to show linked metrics with their current value, trend direction, and target status
- [ ] Gap callout: requirements with zero linked metrics are visually flagged (e.g., orange border or "No metrics linked" badge)
- [ ] Add "Key Requirements" link to the navigation bar
- [ ] Page sets document.title to "Key Requirements | NIA Results Tracker"
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Link metrics to requirements from the metric edit form

**Description:** As a user, I want to select which Key Requirements a metric provides evidence for when editing that metric, so I can build the connection from the metric side.

**Acceptance Criteria:**

- [ ] On the metric edit page (`/metric/[id]/edit`), replace the Integration checkbox with a "Key Requirements" multi-select section
- [ ] Display all available Key Requirements grouped by stakeholder group
- [ ] Requirements currently linked to this metric are checked/selected
- [ ] User can check/uncheck requirements and changes are saved when the form is submitted
- [ ] The section includes a help note: "Select the stakeholder requirements this metric provides evidence for. Linking to at least one requirement marks this metric as Integrated (LeTCI)."
- [ ] Same section appears on the new metric form (`/metric/new`) with nothing pre-selected
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Link metrics to requirements from the Key Requirements page

**Description:** As a user, I want to link metrics to a requirement from the Key Requirements page, so I can build the connection from the requirement side.

**Acceptance Criteria:**

- [ ] Each expanded requirement card shows an "Add Metric" button
- [ ] Clicking "Add Metric" opens a dropdown/picker showing all metrics not yet linked to this requirement
- [ ] Metrics in the picker are grouped by category and process for easy finding
- [ ] Selecting a metric immediately creates the link (saves to `metric_requirements`)
- [ ] Each linked metric shows a small "x" or "unlink" button to remove the connection
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Auto-calculate LeTCI Integration from linked requirements

**Description:** As a user, I want Integration on the LeTCI scorecard to automatically reflect whether a metric is linked to Key Requirements, so I don't have to manually toggle a checkbox.

**Acceptance Criteria:**

- [ ] On the metric detail page (`/metric/[id]`), Integration is true if the metric has at least one linked requirement, false otherwise
- [ ] The Integration LeTCI card shows which requirements are linked (instead of the old checkbox text)
- [ ] If not integrated, the card suggests: "Link this metric to Key Requirements to demonstrate Integration"
- [ ] On the LeTCI summary page (`/letci`), `has_integration` is calculated from linked requirements count > 0
- [ ] Remove the `is_integrated` column from the metrics table (database migration)
- [ ] Remove `is_integrated` from the Metric TypeScript interface
- [ ] Remove the Integration checkbox from metric edit and new forms (replaced by US-004)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Edit and manage Key Requirements

**Description:** As a user, I want to add, edit, or remove Key Requirements as the Organizational Profile evolves, so the system stays current.

**Acceptance Criteria:**

- [ ] On the Key Requirements page, an "Edit Requirements" button toggles edit mode
- [ ] In edit mode, each requirement shows an edit icon and a delete icon
- [ ] Clicking edit opens an inline form to change: requirement name, stakeholder segment, stakeholder group, description
- [ ] Clicking delete shows a confirmation with the count of linked metrics that will be unlinked
- [ ] An "Add Requirement" button at the bottom of each stakeholder group allows adding new requirements
- [ ] New requirements need: requirement name (required), stakeholder segment (required), stakeholder group (required), description (optional)
- [ ] Edit mode changes are saved individually (not a bulk save)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Create `key_requirements` table with columns: id, stakeholder_segment, stakeholder_group, requirement, description, sort_order
- FR-2: Create `metric_requirements` junction table with columns: id, metric_id (FK), requirement_id (FK), unique constraint on (metric_id, requirement_id)
- FR-3: Seed `key_requirements` with 16 requirements from Figure P-6 of the Organizational Profile
- FR-4: The Key Requirements page (`/requirements`) displays all requirements grouped by segment then group
- FR-5: Each requirement shows a health indicator based on linked metric data: green (on target), yellow (mixed), red (below target), gray (no metrics)
- FR-6: Requirements with zero linked metrics are visually flagged as gaps
- FR-7: Summary cards show: total requirements, with metrics, gaps, meeting targets
- FR-8: Clicking a requirement expands to show linked metrics with current value, trend, and target status
- FR-9: Metrics can be linked to requirements from the metric edit/new form (multi-select by stakeholder group)
- FR-10: Metrics can be linked to requirements from the Key Requirements page (add/remove per requirement)
- FR-11: LeTCI Integration is auto-calculated: true if metric has >= 1 linked requirement
- FR-12: The `is_integrated` column is removed from the metrics table
- FR-13: Key Requirements are editable: add, edit, delete with confirmation
- FR-14: Deleting a requirement unlinks all connected metrics (with confirmation showing count)
- FR-15: Add "Key Requirements" to the navigation bar between "LeTCI Summary" and existing links

## Non-Goals

- No automatic suggestion of which metrics should link to which requirements (user decides)
- No weighting of requirements (all requirements are equally important)
- No historical tracking of when links were created or changed
- No requirement-level targets (targets live on the metrics themselves)
- No export or print view of the Key Requirements page
- No connection to Strategic Goals (may be a future feature)

## Design Considerations

- Follow existing NIA brand patterns: `#324a4d` headings, `#55787c` accents, `#b1bd37` green for positive, `#f79935` orange for warnings
- Reuse the collapsible section pattern already used on Dashboard, Categories, and Schedule pages
- The multi-select on metric edit should use checkboxes grouped under stakeholder group headers (similar to the process dropdown pattern but with checkboxes)
- Health indicator colors: green (`#b1bd37`), yellow/orange (`#f79935`), red (`#dc2626`), gray (`#e5e7eb`)
- Gap requirements should have an orange left border or badge to draw attention
- The Key Requirements page should feel like a companion to the LeTCI Summary page

## Technical Considerations

- The `metric_requirements` junction table requires two foreign keys with cascade delete (deleting a metric or requirement removes the link)
- Health status calculation requires joining through `metric_requirements` to `metrics` to `entries` — consider doing this in one query or batching to avoid N+1 queries
- The `is_integrated` column removal should happen in US-006 after the new system is in place. Provide the migration SQL for the user to run in Supabase dashboard.
- Migration order matters: create new tables and seed data (US-001) before removing `is_integrated` (US-006). If existing metrics had `is_integrated = true`, those connections will need to be manually re-created as requirement links.
- Supabase anon key supports all needed operations (insert, update, delete on new tables with public RLS policies)

## Success Metrics

- Every metric can be linked to at least one Key Requirement in under 3 clicks
- The Key Requirements page clearly shows which stakeholder needs have evidence and which don't
- LeTCI Integration scores accurately reflect linked requirements (no manual checkbox needed)
- A Baldrige examiner reviewing the Key Requirements page could trace the connection from stakeholder needs to metric results

## Resolved Decisions

1. **Deduplication of requirements**: Keep requirements separate per stakeholder group. "High-quality services" for Member Districts is a distinct entry from "High-quality services" for Students, because the metrics providing evidence may differ.
2. **Source attribution**: Yes — the Key Requirements page includes "Source: NIA Organizational Profile, Figure P-6" near the top.
3. **Ordering**: Custom order — Customers first (Member Districts, Non-Member Entities), then Stakeholders (Workforce, Students, Parents). This keeps the customer perspective front and center.
