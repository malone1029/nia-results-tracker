# Strategic Plan & Balanced Scorecard — Design Doc

**Date:** 2026-02-26
**Status:** Approved
**Author:** Jon Malone + Claude Code

---

## Overview

Add a Strategic Plan module to the NIA Excellence Hub that surfaces NIA's FY26 Balanced Scorecard objectives, tracks live progress against them using existing Hub metrics, and allows process owners to link their processes to strategic objectives — filling the Baldrige Category 2 (Strategy) gap currently flagged by AI coaching.

---

## Background

NIA's FY26 Strategic Plan uses a Balanced Scorecard framework with four perspectives:

1. **Organizational Capacity** — invest in people, tools, knowledge
2. **Internal Processes** — improve efficiency and service quality
3. **Customer Satisfaction** — retain and delight member districts
4. **Financial Stability** — ensure resources to fulfill mission

Key insight: several strategic goals (Employee Engagement, Customer Satisfaction, BST Satisfaction) are already tracked as Studer survey metrics in the Hub. The scorecard becomes a new view over existing data, not a parallel tracking system.

---

## Data Model

### `strategic_objectives` table

| Column             | Type         | Notes                                                       |
| ------------------ | ------------ | ----------------------------------------------------------- |
| `id`               | serial PK    |                                                             |
| `title`            | text         | Display name of the objective                               |
| `description`      | text         | Context and rationale                                       |
| `bsc_perspective`  | enum         | `financial`, `org_capacity`, `internal_process`, `customer` |
| `target_value`     | numeric      | Nullable (pending for some goals)                           |
| `target_unit`      | text         | e.g. "score", "processes", "%"                              |
| `target_year`      | int          | e.g. 2026                                                   |
| `compute_type`     | enum         | `metric`, `adli_threshold`, `manual`                        |
| `linked_metric_id` | FK → metrics | Nullable — only for `compute_type = metric`                 |
| `current_value`    | numeric      | Nullable — only for `compute_type = manual`                 |
| `sort_order`       | int          | Display order within perspective                            |
| `created_at`       | timestamptz  |                                                             |

### `process_objectives` junction table

| Column         | Type                      | Notes |
| -------------- | ------------------------- | ----- |
| `id`           | serial PK                 |       |
| `process_id`   | FK → processes            |       |
| `objective_id` | FK → strategic_objectives |       |

### `compute_type` logic

- `metric` — GET route fetches latest entry from `linked_metric_id`
- `adli_threshold` — GET route counts processes where latest ADLI overall_score ≥ 70
- `manual` — GET route returns stored `current_value`

### Status calculation

- `green` — current value at or above target
- `yellow` — current value within 10% below target
- `red` — current value more than 10% below target
- `no-data` — no current value available

---

## Seed Data (FY26 Strategic Goals)

| #   | Title                              | Perspective      | Target | Compute Type   | Metric                  |
| --- | ---------------------------------- | ---------------- | ------ | -------------- | ----------------------- |
| 1   | FY25 budget surplus                | financial        | 1–3%   | manual         | — (Not Met)             |
| 2   | FY26 budget surplus                | financial        | 1–3%   | manual         | —                       |
| 3   | FY27 budget surplus                | financial        | 1–3%   | manual         | —                       |
| 4   | Train 50 teammates in PDCA/Quality | org_capacity     | 50     | manual         | —                       |
| 5   | Teammate retention                 | org_capacity     | TBD    | manual         | — (pending baseline)    |
| 6   | BST satisfaction ≥ 4.5             | org_capacity     | 4.5    | metric         | BSS Survey Overall Mean |
| 7   | Employee engagement ≥ 4.5          | org_capacity     | 4.5    | metric         | EE Survey Overall Mean  |
| 8   | 20 processes with ADLI ≥ 70        | internal_process | 20     | adli_threshold | — (auto-computed)       |
| 9   | Maintain/increase active customers | customer         | TBD    | manual         | —                       |
| 10  | Customer satisfaction ≥ 4.5        | customer         | 4.5    | metric         | MDS Survey Overall Mean |

---

## Pages & UI

### `/strategy` — single page, two tabs

**Scorecard tab** (default, all users):

- Summary bar: "X of 10 objectives on track"
- 2×2 BSC quadrant grid (Financial, Org Capacity, Internal Process, Customer)
- Each objective row: title, current vs. target value, green/yellow/red dot, trend arrow, linked process count badge
- ADLI goal shows: "14 / 20 processes at 70+" auto-computed

**Objectives tab** (read for all, edit for super admin):

- List grouped by BSC perspective
- Expand each objective to see description, target, linked metric, linked processes
- Super admin: Edit, Delete, "+ Add Objective" per group
- Same card/expand pattern as Requirements page

### Process page addition

- New "Strategic Objectives" checkbox section on Overview tab, below Requirements
- Checkboxes for all objectives — checked = linked
- Visible to all, editable by process owners

### Sidebar restructuring

- Remove Requirements from Overview section
- Add new **STRATEGY** section between Overview and Processes:
  - Requirements
  - Strategic Plan
- Lock Requirements edit controls to super admin only

---

## API Routes

| Route                          | Method | Purpose                                                     | Access                       |
| ------------------------------ | ------ | ----------------------------------------------------------- | ---------------------------- |
| `/api/strategy`                | GET    | All objectives with computed values, status, process counts | All authenticated            |
| `/api/strategy`                | POST   | Create objective                                            | Super admin                  |
| `/api/strategy/[id]`           | PATCH  | Edit objective                                              | Super admin                  |
| `/api/strategy/[id]`           | DELETE | Delete objective                                            | Super admin                  |
| `/api/strategy/[id]/processes` | POST   | Link process to objective                                   | Process owner or super admin |
| `/api/strategy/[id]/processes` | DELETE | Unlink process                                              | Process owner or super admin |

---

## Access Control

- Strategy page Scorecard tab: all authenticated users
- Strategy page Objectives tab (edit): super admin only via `useRole()` hook
- Requirements page edit controls: locked to super admin (UI gate)
- Process page Strategic Objectives checkboxes: all process owners

---

## Migration

1. Create `strategic_objectives` table with enum types
2. Create `process_objectives` junction table
3. Seed 10 FY26 goals
4. Look up and link metric IDs for BSS/EE/MDS Overall Mean metrics (goals 6, 7, 10)
