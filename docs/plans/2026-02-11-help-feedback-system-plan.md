# Help & Feedback System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a four-layer user support system to the NIA Excellence Hub: feedback form with admin tracking, searchable help page, contextual tooltips, and AI-powered help chat.

**Architecture:** Feedback stored in a new Supabase `feedback` table with RLS. Help page is a static data-driven FAQ. Tooltips are a reusable `<HelpTip>` component with CSS positioning. AI help mode reuses the streaming chat infrastructure with a different system prompt, accessible from every page.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS), Anthropic Claude API (streaming), Tailwind CSS v4 with CSS custom properties.

---

## Phase 1: Feedback System

### Task 1: Database Migration

**Files:**

- Create: `supabase/migrations/20260211_feedback.sql`

**Step 1: Write the migration**

```sql
-- Migration: Feedback table for user bug reports, ideas, and questions

CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('bug', 'idea', 'question')),
  description TEXT NOT NULL,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'done', 'dismissed')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback
CREATE POLICY "Users can read own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all feedback
CREATE POLICY "Admins can read all feedback"
  ON feedback FOR SELECT
  USING (is_admin());

-- Admins can update feedback (status, admin_note)
CREATE POLICY "Admins can update feedback"
  ON feedback FOR UPDATE
  USING (is_admin());

CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status);
```

**Step 2: Run migration**

Run in Supabase SQL Editor (or `supabase db push` if access token is set).

**Step 3: Commit**

```bash
git add supabase/migrations/20260211_feedback.sql
git commit -m "feat: add feedback table migration"
```

---

### Task 2: Feedback API Route

**Files:**

- Create: `app/api/feedback/route.ts`

**Step 1: Write the API route**

```tsx
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

// ============ GET ============
// Members: own feedback. Admins: all feedback.
export async function GET() {
  const supabase = await createSupabaseServer();
  // RLS handles filtering — users see own rows, admins see all
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// ============ POST ============
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const VALID_TYPES = ['bug', 'idea', 'question'];
  if (!body.description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  }
  if (!VALID_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `Type must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Get display name from user_roles
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('full_name')
    .eq('auth_id', user.id)
    .single();

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      user_name: roleRow?.full_name || user.email || 'Unknown',
      type: body.type,
      description: body.description.trim(),
      page_url: body.page_url || null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, success: true });
}

// ============ PATCH ============
// Admin only: update status and admin_note
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const VALID_STATUSES = ['new', 'reviewed', 'done', 'dismissed'];
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }
    updates.status = body.status;
  }
  if (body.admin_note !== undefined) {
    updates.admin_note = body.admin_note;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // RLS ensures only admins can UPDATE
  const { error } = await supabase.from('feedback').update(updates).eq('id', body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add app/api/feedback/route.ts
git commit -m "feat: add feedback API route (GET/POST/PATCH)"
```

---

### Task 3: Feedback Modal Component

**Files:**

- Create: `components/feedback-modal.tsx`

**Step 1: Write the modal component**

A self-contained modal that captures feedback type, description, and auto-detects page URL. Used from the sidebar link.

Props:

- `open: boolean` — whether to show the modal
- `onClose: () => void` — close handler
- `onSuccess?: () => void` — called after successful submission

Features:

- Three type pill buttons (Bug, Idea, Question) with distinct accent colors
- Description textarea (required, min 10 chars)
- Auto-captured page URL shown as muted text
- Submit button with loading state
- Success confirmation with auto-close after 2 seconds

UI matches existing modal pattern:

- `fixed inset-0 z-50 flex items-center justify-center bg-black/40`
- Inner card: `bg-card rounded-xl shadow-xl w-full max-w-md mx-4`
- `onClick={e => e.stopPropagation()}` on inner card
- Header/body/footer sections with `border-b border-border-light`

**Step 2: Commit**

```bash
git add components/feedback-modal.tsx
git commit -m "feat: add feedback submission modal"
```

---

### Task 4: Sidebar — Add Help & Feedback Links

**Files:**

- Modify: `components/sidebar.tsx`

**Step 1: Add two new icons to NavIcon**

Add cases for `"help"` (book-open icon) and `"message"` (message-circle icon) in the NavIcon switch statement.

`help` icon — book-open SVG:

```tsx
case "help":
  return (
    <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
```

`message` icon — message-circle SVG:

```tsx
case "message":
  return (
    <svg className={cn} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0M2.25 12c0 4.556 4.03 8.25 9 8.25a9.764 9.764 0 002.555-.337A5.972 5.972 0 0015.75 21a5.969 5.969 0 004.282-1.8A8.224 8.224 0 0021.75 12c0-4.556-4.03-8.25-9-8.25S2.25 7.444 2.25 12z" />
    </svg>
  );
```

**Step 2: Add Help and Feedback to bottom group**

Replace the existing bottom section (lines 253-267) to include Help link, Feedback button, and Settings:

```tsx
{
  /* Bottom — Help, Feedback, Settings */
}
<div className="px-3 py-3 border-t border-white/10 space-y-0.5">
  <Link
    href="/help"
    onClick={onClose}
    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all ${
      isActive('/help')
        ? 'bg-white/15 text-white font-medium nav-link-active'
        : 'text-white/60 hover:text-white hover:bg-white/8'
    }`}
  >
    <NavIcon icon="help" className="w-4 h-4 flex-shrink-0" />
    Help
  </Link>
  <button
    onClick={() => {
      onClose?.();
      onFeedbackClick?.();
    }}
    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all text-white/60 hover:text-white hover:bg-white/8"
  >
    <NavIcon icon="message" className="w-4 h-4 flex-shrink-0" />
    Feedback
  </button>
  <Link
    href="/settings"
    onClick={onClose}
    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all ${
      isActive('/settings')
        ? 'bg-white/15 text-white font-medium nav-link-active'
        : 'text-white/60 hover:text-white hover:bg-white/8'
    }`}
  >
    <NavIcon icon="settings" className="w-4 h-4 flex-shrink-0" />
    Settings
  </Link>
</div>;
```

**Step 3: Add props and state wiring**

- Add `onFeedbackClick?: () => void` to Sidebar props
- In `app-shell.tsx`: add `feedbackOpen` state, pass `onFeedbackClick` to Sidebar, render `<FeedbackModal>` at root level

**Step 4: Add Feedback link to admin nav group**

In the `adminNavGroups` array, add to the Application group:

```tsx
{ href: "/feedback", label: "Feedback", icon: "message" },
```

**Step 5: Commit**

```bash
git add components/sidebar.tsx components/app-shell.tsx
git commit -m "feat: add Help and Feedback links to sidebar"
```

---

### Task 5: Admin Feedback Page

**Files:**

- Create: `app/feedback/page.tsx`

**Step 1: Build the admin feedback page**

Follow the pattern from `app/surveys/page.tsx`:

- Wrapped in `<AdminGuard>`
- `max-w-6xl mx-auto`
- Stat cards: Total, New, Reviewed, Done (grid-cols-2 sm:grid-cols-4)
- Filter pills: All / Bug / Idea / Question + status pills (New / Reviewed / Done / Dismissed)
- Search bar
- Desktop table (hidden sm:block) with columns: User, Type, Description (truncated), Page, Date, Status
- Mobile cards (sm:hidden)
- Click row to expand: full description, admin note textarea, status dropdown, Save button
- Status badges with colors:
  - `new` → `bg-nia-orange/15 text-nia-orange`
  - `reviewed` → `bg-nia-grey-blue/15 text-nia-grey-blue`
  - `done` → `bg-nia-green/15 text-nia-green`
  - `dismissed` → `bg-surface-muted text-text-muted`
- Type badges:
  - `bug` → red-ish accent
  - `idea` → orange accent
  - `question` → blue accent

**Step 2: Commit**

```bash
git add app/feedback/page.tsx
git commit -m "feat: add admin feedback management page"
```

---

### Task 6: "My Feedback" on Help Page (deferred to Task 8)

Users will see their own past submissions on the help page (built in Phase 2).

---

## Phase 2: Help Page

### Task 7: Help Content Data File

**Files:**

- Create: `lib/help-content.ts`

**Step 1: Write the help content as a typed data structure**

```tsx
export interface HelpQuestion {
  question: string;
  answer: string;
  linkTo?: string; // optional deep link to relevant page
}

export interface HelpSection {
  title: string;
  icon: string;
  questions: HelpQuestion[];
}

export const helpSections: HelpSection[] = [
  {
    title: 'Getting Started',
    icon: 'rocket',
    questions: [
      {
        question: 'What is the NIA Excellence Hub?',
        answer:
          'The Hub is your central tool for managing organizational processes, tracking metrics, and preparing for Baldrige-based assessments. It connects to Asana for task management and uses AI to coach you through process improvement.',
      },
      {
        question: "What's the difference between admin and member roles?",
        answer:
          'Members can view and edit processes, log metrics, and use AI coaching. Admins can additionally manage users, run AI classifications, edit Baldrige criteria mappings, and view all feedback submissions.',
        linkTo: '/settings',
      },
      // ... more Q&A entries
    ],
  },
  // ... more sections: Processes, AI Coaching, Metrics & Data,
  //     Surveys, Asana Integration, Baldrige / EB, Health & Readiness
];
```

Start with ~30-40 Q&A entries across 8 sections. Content can be expanded over time.

**Step 2: Commit**

```bash
git add lib/help-content.ts
git commit -m "feat: add help content data file"
```

---

### Task 8: Help Page

**Files:**

- Create: `app/help/page.tsx`

**Step 1: Build the help page**

Layout:

- `max-w-4xl mx-auto`
- Header: "Help Center" title + "How can we help?" subtitle
- Search bar at top — filters questions by keyword match across question + answer text
- "Ask AI" button in header (opens AI help chat — wired in Phase 4, placeholder for now)
- Sections rendered as cards, each with icon + title header
- Questions as accordion items — click to expand/collapse answer
- Answer text with optional "Go to [page]→" link
- "My Feedback" section at bottom — fetches user's own submissions from `/api/feedback`, shows status badges + admin responses
- "Still need help?" card at very bottom with two buttons:
  - "Ask AI" (placeholder until Phase 4)
  - "Send Feedback" (opens feedback modal)

Accordion state: `expandedId` string state (`"section-index-question-index"` format). Click toggles. Only one open at a time.

Search: filter `helpSections` to only show sections/questions where `question.toLowerCase().includes(query)` or `answer.toLowerCase().includes(query)`. Show "No results" empty state with feedback CTA.

**Step 2: Commit**

```bash
git add app/help/page.tsx
git commit -m "feat: add help page with searchable FAQ"
```

---

## Phase 3: Contextual Tooltips

### Task 9: HelpTip Component

**Files:**

- Create: `components/help-tip.tsx`
- Modify: `app/globals.css` (add tooltip styles)

**Step 1: Write the HelpTip component**

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';

interface HelpTipProps {
  text: string;
  position?: 'top' | 'bottom';
}

export default function HelpTip({ text, position }: HelpTipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<'top' | 'bottom'>(position || 'top');
  const tipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Auto-detect position if not specified
  useEffect(() => {
    if (show && !position && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos(rect.top < 120 ? 'bottom' : 'top');
    }
  }, [show, position]);

  // Close on outside click
  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      if (
        tipRef.current &&
        !tipRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [show]);

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        onClick={() => setShow(!show)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="help-tip-trigger"
        aria-label="Help"
      >
        ?
      </button>
      {show && (
        <div
          ref={tipRef}
          className={`help-tip-popover ${pos === 'top' ? 'help-tip-top' : 'help-tip-bottom'}`}
        >
          {text}
        </div>
      )}
    </span>
  );
}
```

**Step 2: Add tooltip CSS to globals.css**

```css
/* Help tooltips */
.help-tip-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  border: 1px solid var(--border);
  background: var(--surface-hover);
  cursor: help;
  margin-left: 4px;
  transition: all 150ms;
}
.help-tip-trigger:hover {
  color: var(--nia-dark);
  border-color: var(--nia-dark);
}

.help-tip-popover {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 250px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--foreground);
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 50;
  animation: tooltip-enter 150ms ease-out;
}
.help-tip-top {
  bottom: calc(100% + 6px);
}
.help-tip-bottom {
  top: calc(100% + 6px);
}

@keyframes tooltip-enter {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
```

**Step 3: Commit**

```bash
git add components/help-tip.tsx app/globals.css
git commit -m "feat: add HelpTip tooltip component"
```

---

### Task 10: Place Tooltips Across the App

**Files:**

- Modify: `app/processes/[id]/page.tsx` (health ring, ADLI radar, stepper, process type)
- Modify: `app/readiness/page.tsx` (readiness score)
- Modify: `components/task-review-panel.tsx` (PDCA columns)
- Modify: `components/survey-results.tsx` (survey wave)
- Modify: `app/processes/page.tsx` (metric cadence on hover — optional)

**Step 1: Import and place HelpTip at ~8 high-value spots**

Each placement is a single `<HelpTip text="..." />` next to an existing heading or label. No structural changes.

Example placements:

- Health ring section header: `Health Score <HelpTip text="Scored across 5 dimensions: Documentation, Maturity, Measurement, Operations, Freshness. 80+ = Baldrige Ready." />`
- ADLI radar header: `ADLI Maturity <HelpTip text="Approach, Deployment, Learning, Integration — the Baldrige process maturity framework." />`
- Stepper area: `Improvement Cycle <HelpTip text="Your 6-step guided cycle. Complete each step to strengthen your process documentation." />`
- Process type badge area: `<HelpTip text="Key processes directly serve your mission. Support processes enable Key ones." />`
- Readiness score: `Org Readiness <HelpTip text="Weighted average of all health scores. Key processes count 2x." />`
- Survey wave label: `<HelpTip text="Each deployment is a 'wave' with its own share link and results." />`
- PDCA column headers: `<HelpTip text="Plan-Do-Check-Act: a continuous improvement cycle for organizing tasks." />`

**Step 2: Commit**

```bash
git add app/processes/[id]/page.tsx app/readiness/page.tsx components/task-review-panel.tsx components/survey-results.tsx
git commit -m "feat: add contextual help tooltips across key pages"
```

---

## Phase 4: AI Help Mode

### Task 11: AI Help System Prompt

**Files:**

- Create: `lib/help-ai-context.ts`

**Step 1: Write the app guide context**

A ~2-3K char string describing every page, key workflows, and common gotchas. This replaces the process-specific context when in help mode.

```tsx
export function buildHelpSystemPrompt(currentPageUrl: string, isAdmin: boolean): string {
  return `You are a helpful guide for the NIA Excellence Hub, a web app used by the NIA team for process improvement and Baldrige assessment preparation.

## Your Role
- Answer questions about how to use the app
- Explain features in plain, friendly language
- Give step-by-step instructions when asked "how do I..."
- If you're not sure about something, say so and suggest submitting feedback

## The User
- Current page: ${currentPageUrl}
- Role: ${isAdmin ? 'Admin (can access all features)' : 'Member (standard access)'}

## App Pages & Features

### Dashboard (/)
The home page. Shows an owner filter, stat cards (My Readiness, Baldrige Ready, Needs Attention, Overdue Metrics), ADLI overview, action items, and process list. Select your name to see your processes.

### Processes (/processes)
List of all organizational processes. Each shows a health ring (0-100), process type (Key/Support), owner, and last activity. Click any process to see its detail page.

### Process Detail (/processes/[id])
5 tabs: Overview, Documentation, Process Map, Tasks, History.
- Overview: health score, ADLI snapshot, metrics, surveys
- Documentation: charter + ADLI sections (Approach, Deployment, Learning, Integration)
- Process Map: Mermaid flowchart generated by AI
- Tasks: PDCA-organized tasks that can be exported to Asana
- History: improvement log with before/after snapshots

### AI Coaching
On any process detail page, click "Ask AI" to open the coaching panel. The AI analyzes your process and suggests improvements. Use "Apply This" to accept suggestions. The AI can also generate process maps and task lists.

### Improvement Stepper
Linked processes show a 6-step improvement cycle: Start → Charter → Assessment → Deep Dive → Tasks → Export. Each step has an action button that opens AI coaching with a step-specific prompt.

### Metrics & Data Health (/data-health)
Review all metrics, their cadence, and data freshness. Log new data points. Bulk edit metric properties. Overdue = past its expected update date.

### Surveys
Create micro-surveys linked to processes. Deploy as "waves" — each wave gets a unique share link. Close a wave to auto-generate metric entries from responses.

### Asana Integration (/settings)
Connect your Asana account. Import projects as processes, sync changes bidirectionally, export tasks. Each ADLI dimension maps to a PDCA section in Asana.

### Readiness Dashboard (/readiness)
Org-wide Baldrige readiness view. Filter by owner. Shows category breakdown, dimension gaps, and top actions.

### Baldrige Criteria (/criteria) — Admin Only
Map processes to Baldrige questions. AI can auto-suggest mappings. Gap analysis shows unmapped areas.

### Application Drafts (/application) — Admin Only
Write Excellence Builder narratives per Baldrige item. Auto-save, export to Word.

### Classifications (/classifications)
Mark processes as Key (mission-critical) or Support. AI can suggest classifications with rationale.

## Common Questions
- "How do I create a process?" → Use /processes → New Process button, or import from Asana
- "How do I link a metric?" → On a process detail page (Overview tab), click "Link Metric"
- "What's a health score?" → 0-100 score across 5 dimensions. 80+ = Baldrige Ready
- "How do I connect Asana?" → Go to Settings → Asana Connection → Connect with Asana
- "Who can see my data?" → Everyone on the team sees all processes. Admin features (criteria, drafts, user management) are restricted.

## Tone
Be friendly, concise, and specific. Reference page names and button labels. If the user asks about something on their current page, give contextual guidance.`;
}
```

**Step 2: Commit**

```bash
git add lib/help-ai-context.ts
git commit -m "feat: add AI help system prompt with app guide context"
```

---

### Task 12: AI Help API Route

**Files:**

- Create: `app/api/ai/help/route.ts`

**Step 1: Write the help chat API route**

Same streaming pattern as `/api/ai/chat` but simpler — no process context, no structured blocks, just conversational text.

```tsx
import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseServer } from '@/lib/supabase-server';
import { buildHelpSystemPrompt } from '@/lib/help-ai-context';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 60; // Help responses are shorter, 60s is plenty

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 55_000,
  maxRetries: 0,
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  await checkRateLimit(user.id);

  const { messages, pageUrl } = await request.json();

  // Check admin status for context
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('auth_id', user.id)
    .single();
  const isAdmin = roleRow?.role === 'admin';

  const systemPrompt = buildHelpSystemPrompt(pageUrl || '/', isAdmin);

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024, // Short responses for help
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  // Stream response
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

**Step 2: Commit**

```bash
git add app/api/ai/help/route.ts
git commit -m "feat: add AI help chat API route"
```

---

### Task 13: AI Help Chat Drawer

**Files:**

- Create: `components/ai-help-panel.tsx`

**Step 1: Build the help chat drawer**

Similar to the existing `ai-chat-panel.tsx` but significantly simpler:

- Slide-in drawer from right (same as AI coach panel)
- **Blue accent** (not orange) to visually distinguish from coaching
- Header: "Hub Help" with blue icon + close button
- Message list: user messages (right-aligned) + assistant messages (left-aligned, markdown rendered)
- Starter chips when empty: "What can I do here?", "How do I get started?", "What does the health score mean?"
- Input area: textarea + send button
- Streaming: same `fetch` + `ReadableStream` + `getReader()` pattern
- Sends `pageUrl: window.location.pathname` with each request
- No structured output parsing (no suggestion cards, no apply buttons)
- No conversation persistence (fresh on each open)
- AbortController for cleanup on unmount

**Step 2: Commit**

```bash
git add components/ai-help-panel.tsx
git commit -m "feat: add AI help chat drawer component"
```

---

### Task 14: Wire AI Help Into App Shell

**Files:**

- Modify: `components/app-shell.tsx`

**Step 1: Add help panel state and rendering**

- Add `helpOpen` state
- Render `<AiHelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />` at root level
- Pass `onHelpClick` prop to Sidebar (or add a floating `?` button)
- Add floating help button in bottom-right corner (visible on all pages):

```tsx
{
  /* Floating help button */
}
<button
  onClick={() => setHelpOpen(true)}
  className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-nia-grey-blue text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-lg font-bold"
  aria-label="Get help"
>
  ?
</button>;
```

- Help page "Ask AI" button also sets `helpOpen(true)` — wire via callback or URL param `?askAI=true`

**Step 2: Commit**

```bash
git add components/app-shell.tsx
git commit -m "feat: wire AI help panel into app shell with floating button"
```

---

### Task 15: Build & Deploy

**Step 1: Run build**

```bash
cd /Users/jonmalone/projects/nia-results-tracker && npm run build
```

Fix any TypeScript errors.

**Step 2: Run migration**

Run `supabase/migrations/20260211_feedback.sql` in Supabase SQL Editor.

**Step 3: Deploy**

```bash
cd /Users/jonmalone/projects/nia-results-tracker && vercel --prod
```

**Step 4: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete help & feedback system — all 4 layers"
```

---

## Summary

| Task | Feature             | Files                                                |
| ---- | ------------------- | ---------------------------------------------------- |
| 1    | Feedback migration  | `supabase/migrations/20260211_feedback.sql`          |
| 2    | Feedback API        | `app/api/feedback/route.ts`                          |
| 3    | Feedback modal      | `components/feedback-modal.tsx`                      |
| 4    | Sidebar links       | `components/sidebar.tsx`, `components/app-shell.tsx` |
| 5    | Admin feedback page | `app/feedback/page.tsx`                              |
| 7    | Help content data   | `lib/help-content.ts`                                |
| 8    | Help page           | `app/help/page.tsx`                                  |
| 9    | HelpTip component   | `components/help-tip.tsx`, `app/globals.css`         |
| 10   | Tooltip placement   | ~5 existing page files                               |
| 11   | AI help prompt      | `lib/help-ai-context.ts`                             |
| 12   | AI help API         | `app/api/ai/help/route.ts`                           |
| 13   | AI help drawer      | `components/ai-help-panel.tsx`                       |
| 14   | App shell wiring    | `components/app-shell.tsx`                           |
| 15   | Build & deploy      | —                                                    |

**New files:** 9
**Modified files:** ~8
**New DB table:** 1 (`feedback`)
