# Help & Feedback System — Design

**Date:** 2026-02-11
**Status:** Approved

## Overview

Four-layer system for user support and feedback capture in the NIA Excellence Hub:

1. **Feedback Form** — submit bugs, ideas, and questions (stored in Supabase)
2. **Help Page** — browsable FAQ organized by feature area
3. **Contextual Tooltips** — inline `?` icons explaining features on hover
4. **AI Help Chat** — conversational help available from any page

## How They Connect

```
User is confused
       |
       +-- "What's this?"           --> Tooltip (instant, inline)
       +-- "Let me look it up"      --> Help Page (browse, search)
       +-- "I need to ask"          --> AI Help Chat (conversational)
       +-- "This is broken / idea"  --> Feedback Form (captured, tracked)
```

Cross-links between layers:
- Help page has "Ask AI" button at top + "Submit Feedback" card at bottom
- AI help can suggest "Submit this as feedback?" when it can't answer
- Tooltips are standalone (no navigation)

---

## 1. Feedback System

### Database

**Table: `feedback`**

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | serial | PK | — |
| user_id | uuid | auth.uid() | FK to auth.users |
| user_name | text | — | Denormalized display name |
| type | text | — | CHECK: bug / idea / question |
| description | text | — | The feedback content |
| page_url | text | — | Auto-captured from window.location |
| status | text | 'new' | CHECK: new / reviewed / done / dismissed |
| admin_note | text | null | Admin response (visible to submitter) |
| created_at | timestamptz | now() | — |

**RLS:**
- Users can INSERT their own rows
- Users can SELECT their own rows (see their submissions + admin responses)
- Admins can SELECT all rows, UPDATE status + admin_note

### API

- `POST /api/feedback` — create feedback (authenticated)
- `GET /api/feedback` — list feedback (own submissions for members, all for admins)
- `PATCH /api/feedback` — update status + admin_note (admin only)

### UI — User Side

- **Sidebar link:** "Feedback" with message-circle icon, bottom group near Settings
- **Click opens modal** (not a separate page) with:
  - Type picker: Bug / Idea / Question (pill buttons)
  - Description textarea
  - Page URL shown as muted text (auto-captured, not editable)
  - Submit button
- **"My Feedback" section** on help page or settings — list of past submissions with status badges and admin responses

### UI — Admin Side

- **`/feedback` page** (admin-only, in admin nav group)
- Table: user, type, description, page, date, status
- Filter pills: All / New / Reviewed / Done
- Click row to expand: see full description, add admin_note, change status
- Badge on sidebar "Feedback" link showing count of `new` items (admin only)

---

## 2. Help Page (`/help`)

### Structure

Single page with search bar + accordion sections grouped by feature area.

**Sections:**

| Group | Example Topics |
|-------|---------------|
| Getting Started | What is the Hub? How do I navigate? What's admin vs member? |
| Processes | Create, edit, Key vs Support, improvement stepper, process maps |
| AI Coaching | How to use AI, suggestions, applying changes, task generation |
| Metrics & Data | Logging data, overdue, linking metrics, bulk edit |
| Surveys | Create survey, waves, sharing, auto-metrics, email invites |
| Asana Integration | Connect, import, export, sync, bulk import |
| Baldrige / EB | Criteria Map, gaps, classifications, application drafts |
| Health & Readiness | Health score dimensions, readiness dashboard, milestones |

### Features

- **Search bar** at top — filters questions by keyword match
- **Accordion** — click question to expand answer (one open at a time or multi)
- **Short answers** — 2-3 sentences each, optional link to relevant page
- **"Still need help?"** card at bottom with two CTAs:
  - "Ask AI" — opens AI help chat
  - "Send Feedback" — opens feedback modal
- **No auth differences** — same content for admins and members

### Content Strategy

- Start with ~30-40 Q&A entries covering the most common workflows
- Content lives in a data file (array of objects) for easy editing — not hardcoded JSX
- Can be expanded over time as questions come in via feedback

---

## 3. Contextual Tooltips

### Component: `<HelpTip>`

**Props:**
- `text: string` — tooltip content (1-2 sentences max)
- `position?: "top" | "bottom"` — default auto-detect based on viewport

**Behavior:**
- Renders as a small `?` circle icon (16px, muted color)
- Desktop: hover to show popover
- Mobile: tap to show, tap outside to dismiss
- Auto-positions above or below based on available space
- Max width ~250px, subtle shadow, matches card styling

**Implementation:** Pure CSS positioning with a `data-tooltip` attribute or a small React state toggle. No external library.

### Placement (high-value spots)

| Location | Tooltip Text |
|----------|-------------|
| Health Score ring | "Scored across 5 dimensions: Documentation, Maturity, Measurement, Operations, Freshness. 80+ = Baldrige Ready." |
| ADLI Radar | "Approach, Deployment, Learning, Integration — the Baldrige process maturity framework." |
| Improvement Stepper | "Your 6-step guided improvement cycle. Complete each step to strengthen your process." |
| Process Type badge | "Key processes directly serve your mission. Support processes enable Key ones." |
| Readiness score | "Weighted average of all health scores. Key processes count 2x." |
| Survey wave | "Each deployment is a 'wave' with its own share link and results." |
| Metric cadence | "How often this metric should be updated: monthly, quarterly, annually, etc." |
| PDCA columns (tasks) | "Plan-Do-Check-Act: a continuous improvement cycle for organizing tasks." |

More can be added over time — start with these ~8 high-impact spots.

---

## 4. AI Help Mode

### Concept

Repurpose the existing AI chat infrastructure with a separate "help" persona. Same drawer UI, different system prompt.

### System Prompt

The AI help assistant receives:
- **App guide context:** condensed description of every page, key workflows, common gotchas
- **Current page URL:** so it can give contextual answers ("On this page, you can...")
- **User role:** so it knows whether to mention admin features

The context is a static string (~2-3K chars) describing the app — not the process-specific context used by the coaching AI.

### UI

- **Entry point:** Floating `?` button (bottom-right corner) OR sidebar "Help" link with sub-option
- **Drawer:** Same slide-out panel as process AI chat
- **Visual distinction:** Blue accent color (vs orange for coaching) + "Hub Help" header
- **Available from every page** (not just process detail)
- **Starter chips:** "What can I do here?", "How do I get started?", "What's my health score?"
- **No structured output** — plain conversational text only (no suggestion cards, no apply buttons)
- **Lightweight:** No conversation persistence needed — each session starts fresh

### API

- `POST /api/ai/help` — separate route from `/api/ai/chat`
- Same streaming pattern, different system prompt
- Lower token budget (shorter responses, simpler context)
- Same rate limiting as other AI routes

---

## Navigation Changes

### Sidebar (bottom group)

```
── Settings        (cog icon)
── Help            (book-open icon)     --> /help
── Feedback        (message-circle icon) --> opens modal
```

### Admin sidebar additions

```
Application group:
── ...existing items...
── Feedback        (message-circle icon) --> /feedback (with "new" count badge)
```

---

## Implementation Order

| Phase | Feature | Effort | Dependencies |
|-------|---------|--------|-------------|
| 1 | Feedback form + table + admin page | Medium | Migration, 2 API routes, modal + page |
| 2 | Help page | Low | Static content, no API |
| 3 | HelpTip component + placement | Low | Reusable component, sprinkle across pages |
| 4 | AI help mode | Medium | New API route, global chat drawer |

Phases 1-3 can be built in a single session. Phase 4 is a separate session.

---

## Out of Scope

- Guided tours / step-by-step walkthroughs (future enhancement)
- Video tutorials (would be external Loom links, can add to help page later)
- Push to Asana from feedback (feedback stays in Supabase only)
- Public-facing help (app is internal to @thenia.org)
