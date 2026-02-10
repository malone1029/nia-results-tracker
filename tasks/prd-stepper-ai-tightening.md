# PRD: Stepper-to-AI UX Tightening

## Introduction

The Improvement Cycle stepper and the AI chat panel are the two most important tools on the process detail page, but they feel disconnected. The stepper sits at the top of the page and tells users *where* they are, while the AI panel hides behind a floating button in the bottom-right corner. Users must: (1) read the stepper to understand their current step, (2) scroll down and click the floating AI button, (3) open the panel, (4) find the right prompt button inside. That's 3-4 actions for something that should be 1 click.

This PRD tightens the connection between the stepper and the AI by:
- Adding a step-specific action button directly on the stepper (one click opens the panel AND sends the right prompt)
- Adding a dedicated "Check Metrics" action to the Assessment step (equal prominence with "Run ADLI Assessment")
- Scrolling the page to the relevant content section when the AI panel opens at a step
- Nudging unlinked processes to connect to Asana (rather than offering a degraded experience)

## Goals

- Reduce the number of clicks from "I'm on step X" to "AI is helping me with step X" from 3-4 clicks to 1 click
- Give metrics analysis a dedicated moment in the improvement cycle (Assessment step)
- Scroll the page to the relevant content section when AI coaching starts at a step
- Encourage all processes to link to Asana by showing a nudge instead of offering step-less AI

## User Stories

### US-001: Step action button on the stepper
**Description:** As a process owner, I want to click an action button on the current step so the AI panel opens and starts coaching me on that step immediately, without hunting for the right prompt.

**Acceptance Criteria:**
- [ ] Each step in the `ImprovementStepper` shows a small action button (icon or text) on the active step
- [ ] Completed and future steps show their action button with less prominent styling (muted color, smaller)
- [ ] Start and Export steps have visually less prominent action buttons than Charter/Assessment/Deep Dive/Tasks
- [ ] Clicking the action button calls a new `onAction(step)` callback prop
- [ ] The button label matches the primary action for that step (e.g., "Review Charter", "Run Assessment", etc.)
- [ ] On mobile, action buttons use short labels or icons to avoid overflow
- [ ] Typecheck passes
- [ ] Verify in browser

### US-002: Wire stepper action to AI panel
**Description:** As a process owner, when I click the stepper action button, the AI panel should open and automatically send the primary prompt for that step so I don't have to click twice.

**Acceptance Criteria:**
- [ ] Clicking the stepper action button on the process detail page: (a) changes the `guided_step` to that step, (b) opens the AI chat panel, (c) auto-sends the primary prompt for that step
- [ ] The AI panel stays open after the response (user continues the conversation naturally)
- [ ] If the AI panel is already open, clicking a stepper action still sends the prompt (no need to close and reopen)
- [ ] If the same step's prompt was already sent in this conversation, the action button still works (sends it again — user may want a fresh take)
- [ ] Typecheck passes
- [ ] Verify in browser

### US-003: Auto-scroll to relevant content section
**Description:** As a process owner, when the AI panel opens for a step, the page should scroll to the content section that the step relates to, so I can see the AI coaching alongside the relevant content.

**Acceptance Criteria:**
- [ ] When stepper action triggers, page scrolls to the relevant content section:
  - Start → top of page (header)
  - Charter → Charter section
  - Assessment → first ADLI section (Approach)
  - Deep Dive → first ADLI section (Approach)
  - Tasks → switches to Tasks tab and scrolls to Tasks panel
  - Export → top of page (near Asana link)
- [ ] Scroll uses `smooth` behavior
- [ ] Scroll accounts for the AI panel being open (content shifts left on desktop)
- [ ] If "Tasks" step is clicked and Content tab is active, the tab switches to Tasks automatically
- [ ] Typecheck passes
- [ ] Verify in browser

### US-004: Add "Check Metrics" action to Assessment step
**Description:** As a process owner, I want a dedicated "Check Metrics" prompt alongside "Run ADLI Assessment" on the Assessment step so I have a focused moment to review and link metrics to my process.

**Acceptance Criteria:**
- [ ] The Assessment step shows TWO action buttons of equal prominence: "Run Assessment" and "Check Metrics"
- [ ] "Check Metrics" sends a prompt like: "Review the metrics linked to this process. Are there gaps? Are there existing metrics in the system I should link? Flag any overdue or off-target metrics."
- [ ] Both buttons use the same one-click pattern (open panel + send prompt + scroll to ADLI/Metrics section)
- [ ] The "Check Metrics" prompt triggers the AI to use the `metric-suggestions` structured block (from the AI Metrics Intelligence feature)
- [ ] On mobile, the two buttons stack vertically or use short labels to fit
- [ ] Typecheck passes
- [ ] Verify in browser

### US-005: Asana link nudge for unlinked processes
**Description:** As a process owner with an unlinked process, I want to see a clear nudge to connect to Asana so I understand that guided coaching requires Asana linking.

**Acceptance Criteria:**
- [ ] When a process has NO `asana_project_gid`, the stepper area shows a nudge card instead of the stepper
- [ ] Nudge card says something like: "Link this process to Asana to unlock the guided improvement cycle"
- [ ] Nudge includes a "Link to Asana" button that opens the Asana export dialog (same as the "Sync to Asana" header button)
- [ ] The floating AI button still works for unlinked processes (free-form chat, no step-awareness)
- [ ] The nudge does NOT appear if the user has no Asana token connected (in that case, show "Connect Asana in Settings" with a link to `/settings`)
- [ ] Typecheck passes
- [ ] Verify in browser

### US-006: Step action prompt definitions
**Description:** As a developer, I need a shared mapping of step → action labels + prompts so the stepper and AI panel use the same data.

**Acceptance Criteria:**
- [ ] A shared constant (e.g., `STEP_ACTIONS_MAP`) defines for each step: action label, short label (mobile), prompt text, scroll target section ID
- [ ] The Assessment step has TWO actions defined (assessment + metrics)
- [ ] The `ImprovementStepper` reads from this map for button labels
- [ ] The `AiChatPanel` reads from the same map (replacing or augmenting the existing `STEP_ACTIONS` constant)
- [ ] No duplication of prompt text between stepper and AI panel
- [ ] Typecheck passes

## Functional Requirements

- FR-1: `ImprovementStepper` accepts a new `onAction(step: string, actionKey?: string)` callback prop. The `actionKey` distinguishes between multiple actions on the same step (e.g., "assessment" vs "metrics" on the Assessment step).
- FR-2: Each step in the stepper renders an action button. The active step's button uses full styling; completed/future steps use muted styling; Start and Export use less prominent styling than the "work" steps.
- FR-3: The Assessment step renders TWO equal action buttons: "Run Assessment" and "Check Metrics".
- FR-4: Clicking a stepper action button on the process detail page triggers: (a) `guided_step` PATCH to that step, (b) AI panel opens via state, (c) prompt is sent via a new `sendPromptFromOutside(prompt)` mechanism, (d) page scrolls to the relevant section.
- FR-5: The process detail page adds `id` attributes to content sections (e.g., `id="section-charter"`, `id="section-adli"`, `id="section-tasks"`) so scroll targets work.
- FR-6: The AI panel exposes a way for the parent page to trigger a message send programmatically (e.g., via a ref with `sendMessage`, or a `pendingPrompt` state prop).
- FR-7: For unlinked processes, the stepper area renders an Asana nudge card with a link/button to open the Asana export dialog.
- FR-8: If the user has no Asana token (not connected in Settings), the nudge card shows "Connect Asana in Settings" with a link to `/settings` instead of the export dialog button.
- FR-9: The "Check Metrics" prompt instructs the AI to focus on metric gaps, recommend linking existing metrics, and flag overdue/off-target metrics using the `metric-suggestions` block format.
- FR-10: A shared constant maps each step to its action label(s), prompt text(s), and scroll target section ID. Both the stepper and AI panel reference this constant.

## Non-Goals

- No changes to the AI system prompt or AI response format (metrics intelligence and coach suggestions already work)
- No changes to gamification, health scores, or readiness dashboard (separate workstream)
- No changes to the Asana sync, import, or export logic
- No new database migrations
- No changes to the floating AI button behavior (it still works as-is for free-form chat)
- No changes to the step auto-advancement logic (still triggers on "Apply This")

## Design Considerations

- The stepper action buttons should feel like natural extensions of the step, not separate UI elements. Consider small pill-shaped buttons below or to the right of each step label.
- The Assessment step with two buttons is the densest step — on mobile, consider stacking the two buttons vertically or using icons (chart icon for assessment, target icon for metrics).
- The Asana nudge card should use the NIA orange accent to draw attention without being alarming. It should feel like a helpful suggestion, not a warning.
- The active step's action button should have higher contrast than completed/future steps (use `bg-nia-dark text-white` for active, `text-nia-grey-blue` for others).
- Start step action button: "Get Started" (less prominent, one-time orientation)
- Export step action button: "Review for Export" (less prominent, final check)

## Technical Considerations

- **Sending prompts from outside the AI panel:** The cleanest approach is adding a `pendingPrompt` prop to `AiChatPanel`. When set, the panel opens, sends the prompt, and clears it. This avoids refs and imperative API patterns. The process page manages this as state: `const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)`.
- **Scroll targets:** Add `id` attributes to existing section `<Card>` wrappers (e.g., `id="section-charter"`). Use `document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })` after a short delay to let the panel open first.
- **Shared constants:** Create a new file `lib/step-actions.ts` or extend `lib/pdca.ts` with the step-to-action mapping. Import in both `improvement-stepper.tsx` and `ai-chat-panel.tsx`.
- **Asana token check:** The process detail page already fetches `asana_project_gid`. To check if the user has an Asana token, make a lightweight check (e.g., `GET /api/asana/status` or check if the Settings page connect button shows "Connected"). Alternatively, use a simple flag from the user session.
- **Existing STEP_ACTIONS in ai-chat-panel.tsx:** The refactored shared constant replaces this. The AI panel's empty-state buttons and mid-conversation buttons should read from the same source, eliminating the duplication risk.

## Implementation Order

1. **US-006** — Shared step action constants (foundation for everything else)
2. **US-001** — Step action buttons on the stepper (UI only, no wiring yet)
3. **US-002** — Wire stepper action to AI panel (pendingPrompt mechanism)
4. **US-003** — Auto-scroll to relevant content sections
5. **US-004** — Add "Check Metrics" action to Assessment step
6. **US-005** — Asana link nudge for unlinked processes

## Success Metrics

- Process owners can go from "looking at the stepper" to "AI is coaching me" in 1 click (was 3-4)
- Metrics analysis becomes a natural part of the improvement cycle (users check metrics during Assessment)
- Unlinked processes show a clear path to full guided coaching via Asana
- No increase in page load time or AI response time

## Open Questions

- Should the stepper action button be a separate clickable element, or should clicking the step itself trigger the action (with a long-press or double-click to change steps)?
- Should the "Check Metrics" button appear on Deep Dive step too, or only Assessment?
- When the user clicks a completed step's action button, should it re-send the prompt for a fresh analysis, or show a message like "You already completed this step — want to revisit?"
