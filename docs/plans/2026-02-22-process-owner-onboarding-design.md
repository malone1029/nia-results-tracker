# Process Owner Onboarding & Scorecard Design

**Date:** 2026-02-22
**Status:** Approved
**Author:** Jon Malone + Claude Code

---

## Problem Statement

The NIA Excellence Hub is the platform for organizational performance management, but it currently has one active user (the administrator). For the Hub to score well on ADLI Deployment — and for it to actually work as a performance system — process owners must be actively using it. There is currently no onboarding program, no published expectations, and no way to monitor whether process owners are engaging.

This design addresses three connected gaps:

1. No orientation for new process owners (they don't know what to do or why)
2. No published compliance expectations (nothing to hold anyone to)
3. No visibility into individual engagement (no way to monitor or evaluate)

---

## Goals

- Orient process owners to the Hub: what it is, why it matters, what their job is
- Publish explicit compliance expectations they can see and self-monitor against
- Give process owners a personal scorecard showing their compliance and growth
- Give Jon and SLT a consolidated view of all process owner engagement
- Strengthen the ADLI Deployment dimension of the Organizational Performance Management process

---

## Design Principle

> "I'll accept progress. I won't accept a failure to use."

This shapes the entire scorecard system. There are two independent readings:

- **Activity compliance** — binary, non-negotiable. Is the owner actively using the Hub?
- **Growth trajectory** — directional, not punitive. Are their scores trending in the right direction?

A process owner with a health score of 42 who is actively working their process is compliant. A process owner with a health score of 80 who hasn't logged in since last quarter is not.

---

## Architecture: Three Pages

### 1. `/onboarding` — Orientation Program

A multi-step program that every process owner completes once. Not just a tooltip tour — a structured orientation with distinct chapters.

**Chapters:**

1. **Why this matters** — NIA's Baldrige journey, the Excellence Hub's role, why process owners are essential
2. **How the Hub works** — process health scoring (5 dimensions), ADLI maturity (4 dimensions, 1–5 scale), metrics, and tasks explained in plain language
3. **Your responsibilities** — the explicit compliance expectations; what you must do and how often
4. **Your first actions** — guided steps inside the owner's actual assigned process (not hypothetical; real clicks on real data)

**Behavior:**

- Completion is tracked per user and displayed as a status badge on their scorecard
- Program remains accessible after completion as a reference resource
- Progress is saved (can exit and resume)
- Completion triggers a "welcome" state on the scorecard page

---

### 2. `/owner/[id]` — The Scorecard

The canonical scorecard page. One design serves two audiences:

- **Process owners** access their own via "My Scorecard" in the sidebar → renders at `/owner/[their-id]`
- **Jon and SLT** access anyone's via `/admin/scorecards` → click a name → same page at `/owner/[id]`

Page title reads "My Scorecard" when viewing your own, the owner's name when an admin views another person.

#### Compliance Panel (left / top)

Binary checklist — green (passing) or red (failing). No amber.

| Check                    | Rule                                                           | Cadence logic                                                                                           |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Onboarding complete      | Has completed the onboarding program                           | One-time                                                                                                |
| Metrics current          | All linked metrics have entries within their cadence window    | Per-metric cadence (monthly = 35 days, quarterly = 100 days, semi-annual = 200 days, annual = 380 days) |
| Process recently updated | `updated_at` within 90 days                                    | Fixed                                                                                                   |
| Task activity            | At least one task completed this quarter                       | Rolling 90 days                                                                                         |
| Process status           | At least one owned process at `ready_for_review` or `approved` | —                                                                                                       |

**Cadence awareness:** The metrics compliance check reads each metric's `cadence` field and applies the appropriate window. An annual metric is compliant if logged within the last ~13 months. This prevents setting expectations that can't be met.

**Configurable:** Compliance thresholds (90-day update window, 1 task/quarter, etc.) should be defined as named constants so they can be adjusted without code changes in the future.

#### Growth Panel (right / bottom)

Directional indicators — trending up is the goal, flat with activity is acceptable, declining is a flag.

| Metric                      | Display                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| Process health score        | Current score + sparkline trend (last 4 snapshots)                    |
| ADLI dimension scores       | Approach / Deployment / Learning / Integration bars with ↑ ↓ → arrows |
| Improvement journal entries | Count this calendar year                                              |
| Task completion rate        | Completed / total tasks this quarter, as a percentage                 |

---

### 3. `/admin/scorecards` — The Overview

Accessible to Jon (super_admin) and SLT (admin role). One row per process owner.

**Summary bar:** "X of Y process owners compliant this period."

**Table columns:**

- Owner name
- Processes owned (count, clickable)
- Compliance status (green all-pass / red any-failing) — default sort: non-compliant first
- Health score + trend arrow
- Last active date
- → click row to open `/owner/[id]`

**Sidebar placement:** Under the existing "Settings" or a new "People" group, admin-only.

---

## What "Compliance" Means

Compliance is the activity bar. It answers: "Is this person showing up?"

A process owner is **compliant** when all five checks pass:

1. Onboarding is complete
2. All linked metrics have entries within their defined cadence window
3. Their process documentation was updated within the last 90 days
4. They have completed at least one task in the rolling 90-day window
5. At least one of their processes is at `ready_for_review` or `approved` status

A process owner is **non-compliant** if any single check fails. Jon sees this immediately on the scorecards page. The process owner can self-diagnose on their own scorecard.

---

## Role Visibility

| Role                        | Can see                                       |
| --------------------------- | --------------------------------------------- |
| Process owner (`member`)    | Own scorecard only (`/owner/[their-id]`)      |
| Admin / SLT (`admin`)       | All scorecards + `/admin/scorecards` overview |
| Super admin (`super_admin`) | Same as admin                                 |

---

## Connection to ADLI

This feature directly improves the ADLI scores of the **Organizational Performance Management** process:

- **Deployment** — the onboarding program and compliance expectations are the evidence that the approach is deployed consistently across process owners, not just used by the administrator
- **Learning** — the compliance and growth metrics become a feedback loop; if compliance is low, the system is surfacing a learning opportunity
- **Integration** — individual leader metrics tie process health to leadership accountability, connecting performance management to people management

---

## Out of Scope (for this build)

- Leaderboards or peer-visibility (process owners don't see each other's scores)
- Email reminders or notifications when compliance lapses (can be added later)
- Configurable compliance thresholds via UI (constants in code for now; UI toggle later)
- Historical compliance trend (did they improve their compliance over time?) — future iteration

---

## Open Questions for Future Iterations

- Should SLT see each other's scorecards, or only their own + their reports?
- At what point does non-compliance trigger a formal follow-up workflow?
- Should the onboarding program be versioned (i.e., re-triggered when major Hub updates ship)?
