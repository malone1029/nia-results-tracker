# PRD: NIA Time & Billing System

## Introduction

NIA currently uses iSite ($26K/year) for employee timekeeping, attendance tracking, and matching service hours to customer contracts for billing. The process is fragmented across multiple tools — iSite, spreadsheets, group chats, and manual reconciliation — creating data silos, inconsistent reporting, and significant process waste.

This PRD defines a new standalone application that replaces iSite with a unified system for attendance call-in, employee timekeeping, customer contract management, and billing reconciliation. The app will be built on the same tech stack as the NIA Excellence Hub (Next.js, Supabase, Vercel) but deployed as a separate application with its own URL and user experience.

**Key business context:**

- ~40 customer districts purchase NIA services using ~40 hierarchical service codes (categories → codes, change year to year)
- All NIA teammates (~80+) log time daily, often splitting across multiple service codes and districts
- Quarterly invoicing: contract total / 4, adjusted for remaining quarters, with fiscal year-end cleanup billing after June 30
- Subs are external agency workers called in when teammates are absent; sub usage may affect customer billing (needs team confirmation)
- Two-sided reconciliation: customer (service purchased vs. delivered) and employee (expected schedule vs. time worked)
- **Calendar complexity:** Employees work on different calendars — some follow a standard NIA calendar, others have individualized schedules based on their assigned districts' school calendars. Currently tracked in a separate system (data silo)
- **Contract amendments ("Change Form" process):** Customers frequently add and drop services mid-year through an approval process, currently handled in yet another separate system. These changes affect billing. Fiscal year-end (June 30) includes a final cleanup billing cycle
- Employee assignments (which codes/districts each person works) are currently managed in iSite tables — data can be exported when needed

**Current problems (from team's process analysis):**

- Fragmented call-in procedures across departments (West Therapy, East Therapy, Vision/DHH, DHH Program)
- Data silos: spreadsheets, group chats, sub calendars, iSite, separate calendar system, separate change form system — none connected
- Multiple manual data entry points (spreadsheet + sub calendar + iSite + change form system)
- HR not notified for FMLA triggers (4+ consecutive absent days)
- Teammates burdened with calling multiple places
- No single view of attendance, time, contracts, or billing
- Workarounds everywhere, leading to inconsistent compliance

**Process owners:** Jill/Becca (Attendance), Tiffany Agustin (project lead)

## Goals

- Eliminate iSite ($26K/year) with a purpose-built system that fits NIA's actual workflows
- Create a single source of truth for attendance, timekeeping, and billing
- Reduce non-value-added steps in the call-in process (team's stated goal: measurable reduction by 2027 school year)
- Enable two-sided reconciliation: customer (purchased vs. delivered) and employee (assigned vs. worked)
- Provide customer districts with self-service access to their contract and billing data
- Automate notifications: supervisors, HR (FMLA triggers), sub-callers, district contacts
- Build and test over 1 year before canceling iSite

## Architecture

- **Standalone Next.js 16 app** — separate from Excellence Hub
- **Shared Supabase project** — same database instance, different tables, shared Google OAuth
- **Deployed on Vercel** — same `thenia-org` team, separate project
- **URL:** `time.thenia.org` (or similar)
- **Three user types:**
  - **Teammate** — logs time, reports absences, views own history
  - **Admin** — manages contracts, reconciliation, sub-caller groups, billing
  - **Customer** — district contacts view their contract usage and billing (magic link auth)

---

## Phase 1: Attendance Call-In + Sub-Caller System

_The quick win — addresses the process your team has already designed._

### US-001: Project Setup + Database Schema

**Description:** As a developer, I need the app scaffold and core database tables so all other features have a foundation.

**Acceptance Criteria:**

- [ ] New Next.js 16 project created with TypeScript, Tailwind CSS v4
- [ ] Supabase tables: `teammates`, `absences`, `sub_requests`, `sub_assignments`, `departments`, `supervisors`
- [ ] Google OAuth via shared Supabase auth (same login as Excellence Hub)
- [ ] RLS policies: teammates see own absences, admins see all
- [ ] Basic layout with sidebar navigation
- [ ] Deployed to Vercel with preview deploys on PRs
- [ ] Typecheck/lint passes

### US-002: Absence Reporting Form

**Description:** As a teammate, I want to fill out one online form to report my absence so I don't have to call multiple people.

**Acceptance Criteria:**

- [ ] Form fields:
  - Department (dropdown)
  - Supervisor (auto-populated from department, editable)
  - OP (operations person, dropdown)
  - District contact(s) — ability to add multiple
  - Date(s) of absence (single date or date range for multi-day)
  - Number of hours per day
  - Is a sub needed? (yes/no) + sub type if yes (DHH Program sub, Interpreter sub, etc.)
  - Type of time off: Sick, Intermittent FMLA, Personal, Vacation, Bereavement, Other
  - Whether in conjunction with: first week of school, last week of school, holiday
  - Reason for using time (required if "in conjunction" is checked)
  - Free-text notes field
- [ ] Language on form: "If you are missing 4 or more consecutive days, you will need a physician's note with a return-to-work date. This may trigger the FMLA process."
- [ ] Reminder to update out-of-office on email
- [ ] Form validates required fields before submission
- [ ] Saves to `absences` table with teammate's auth ID
- [ ] Works on mobile (teammates may submit from phone)
- [ ] Typecheck passes
- [ ] Verify in browser

### US-003: Absence History View

**Description:** As a teammate, I want to see my previous absences so I can track my own attendance.

**Acceptance Criteria:**

- [ ] "My Absences" page shows all past absences in reverse chronological order
- [ ] Each entry shows: date(s), type, hours, sub requested (yes/no), status
- [ ] Pull in previous absences displayed on the absence form as context before submitting
- [ ] Filter by date range, type of leave
- [ ] Typecheck passes
- [ ] Verify in browser

### US-004: Auto-Notifications on Absence

**Description:** As a supervisor, I want to be automatically notified when my teammate reports an absence so I don't miss it.

**Acceptance Criteria:**

- [ ] On form submission, send email (via Resend) to:
  - Supervisor
  - OP
  - All listed district contacts
- [ ] Email includes: teammate name, date(s), hours, type of leave, whether sub is needed, notes
- [ ] NIA-branded email template (consistent with Excellence Hub digest style)
- [ ] Fail-open: if email fails, absence is still recorded (warning logged, not blocking)
- [ ] Typecheck passes

### US-005: FMLA Consecutive Absence Trigger

**Description:** As an HR administrator, I want to be automatically notified when a teammate misses 3+ consecutive working days so I can initiate the FMLA process on the 4th day.

**Acceptance Criteria:**

- [ ] After each absence submission, system checks: has this teammate been absent for 3+ consecutive working days (based on the annual calendar, not just calendar days)?
- [ ] If yes, auto-send email to HR with: teammate name, dates of consecutive absences, total days, supervisor name
- [ ] "Consecutive" means working days per NIA's annual calendar (excludes weekends, holidays, breaks)
- [ ] Email is informational — system does not manage the FMLA intake process itself (out of scope)
- [ ] Typecheck passes

### US-006: Sub-Caller Notification

**Description:** As a sub-caller, I want to be notified when a teammate needs a sub so I can find coverage quickly.

**Acceptance Criteria:**

- [ ] When absence form is submitted with "sub needed = yes":
  - Create a `sub_request` record with sub type, date(s), department, location details
  - Send email notification to the sub-caller group for that department/sub type
- [ ] Email includes: date(s), location, sub type needed, any special notes
- [ ] Sub-caller group membership managed by admin (see US-009)
- [ ] Typecheck passes

### US-007: Sub Claim System

**Description:** As an available sub (external agency worker), I want to claim an open shift so coverage is confirmed quickly on a first-come-first-served basis.

**Acceptance Criteria:**

- [ ] Sub notification email contains a magic link to a "claim this shift" page
- [ ] Claim page shows: date, location, sub type, notes
- [ ] "Claim Shift" button assigns the sub to the request
- [ ] First person to claim gets it — subsequent visitors see "Already claimed by [name]"
- [ ] On claim: update sub calendar, notify sub-caller that coverage is confirmed
- [ ] Sub does NOT need an NIA account — magic link auth for external workers
- [ ] Typecheck passes
- [ ] Verify in browser

### US-008: Attendance Admin Dashboard

**Description:** As an admin, I want to see a dashboard of all absences so I can monitor attendance patterns across the organization.

**Acceptance Criteria:**

- [ ] Dashboard shows:
  - Today's absences (who is out, sub status)
  - This week's absences (calendar or list view)
  - Absence trends (chart: absences per week/month)
  - Teammates approaching FMLA threshold (2+ consecutive days)
  - Unresolved sub requests (sub needed but not yet claimed)
- [ ] Filter by department, date range, type of leave
- [ ] Search by teammate name
- [ ] Export to CSV
- [ ] Admin-only access (role-based)
- [ ] Typecheck passes
- [ ] Verify in browser

### US-009: Sub-Caller Group Management

**Description:** As an admin, I want to manage who is in each sub-caller notification group so the right people get notified.

**Acceptance Criteria:**

- [ ] Admin page to manage sub-caller groups
- [ ] Groups organized by sub type (DHH Program, Interpreter, Therapy, etc.)
- [ ] Add/remove members by email address
- [ ] Members can be NIA employees or external contacts
- [ ] Typecheck passes
- [ ] Verify in browser

### US-010: Sub Calendar

**Description:** As a sub-caller or admin, I want to see a calendar view of sub assignments so I know who is covering where on any given day.

**Acceptance Criteria:**

- [ ] Calendar view showing all sub assignments by date
- [ ] Each entry shows: date, original teammate (out), sub assigned, location, sub type
- [ ] Color-coded: confirmed (green), pending/unclaimed (orange), no sub found (red)
- [ ] Filter by department, sub type
- [ ] Printable/exportable for daily operations
- [ ] Typecheck passes
- [ ] Verify in browser

---

## Phase 2: Employee Timekeeping

_All teammates log their daily time by service code and customer district._

### US-011: Employee Calendar / Schedule Management

**Description:** As an admin, I want to manage each employee's work calendar so the system knows which days they're expected to work (for FMLA tracking, reconciliation, and time entry validation).

**Acceptance Criteria:**

- [ ] Support multiple calendar types:
  - **Standard NIA calendar** — a shared calendar template with working days, holidays, and breaks
  - **District-based calendar** — follows a specific district's school calendar (imported or manually entered)
  - **Custom/individualized** — employee submits a preplanned calendar based on their assigned districts
- [ ] Each employee is assigned to one or more calendars
- [ ] Calendar view shows working days vs. non-working days for any employee
- [ ] Admin can create, edit, and clone calendar templates
- [ ] Employees can view their own calendar (read-only)
- [ ] System uses calendar data for:
  - FMLA consecutive working day calculation (Phase 1)
  - Expected hours calculation in employee reconciliation (Phase 2)
  - Time entry validation — flag entries on non-working days
- [ ] Calendars can be set up per fiscal year (July 1 - June 30)
- [ ] Typecheck passes
- [ ] Verify in browser

### US-012: Time Entry

**Description:** As a teammate, I want to log my daily time by service code and customer district so my hours are tracked accurately.

**Acceptance Criteria:**

- [ ] Time entry form with fields:
  - Date (defaults to today)
  - Service code (dropdown from ~40 codes)
  - Customer district (dropdown from ~40 districts)
  - Hours (decimal, e.g., 7.5)
  - Notes (optional)
- [ ] Multiple entries per day allowed (teammate splits time across codes/districts)
- [ ] Daily total displayed with warning if over/under expected hours (e.g., 7.5)
- [ ] Edit and delete own entries (within current pay period)
- [ ] Typecheck passes
- [ ] Verify in browser

### US-013: Weekly Timesheet View

**Description:** As a teammate, I want to see my time entries for the week in a grid so I can verify completeness before the pay period closes.

**Acceptance Criteria:**

- [ ] Grid view: rows = service code + district combinations, columns = days of the week
- [ ] Daily totals per column, weekly total in corner
- [ ] Visual indicator for missing days (no time logged)
- [ ] Click any cell to add/edit entry
- [ ] "Submit Week" action (locks entries for admin review)
- [ ] Typecheck passes
- [ ] Verify in browser

### US-014: Service Code + District Management

**Description:** As an admin, I want to manage the list of service codes and customer districts so teammates select from accurate options.

**Acceptance Criteria:**

- [ ] Admin page to CRUD service codes (code, name, description, active/inactive)
- [ ] Admin page to CRUD customer districts (name, contacts, active/inactive)
- [ ] Inactive codes/districts hidden from teammate dropdowns but preserved in historical data
- [ ] Typecheck passes
- [ ] Verify in browser

### US-015: Timekeeping Admin Dashboard

**Description:** As the timekeeping admin, I want to see who has/hasn't submitted their time so I can follow up before payroll.

**Acceptance Criteria:**

- [ ] Dashboard showing submission status per teammate per pay period
- [ ] Statuses: Not Started, In Progress, Submitted, Approved
- [ ] Filter by department
- [ ] "Send Reminder" button to email teammates who haven't submitted
- [ ] Approve/reject submitted timesheets
- [ ] Typecheck passes
- [ ] Verify in browser

### US-016: Employee Reconciliation View

**Description:** As an admin, I want to compare each employee's logged hours against their expected schedule (contract assignment) so I can identify discrepancies.

**Acceptance Criteria:**

- [ ] Per-employee view showing:
  - Expected: 180 days x 7.5 hours = 1,350 hours (from assignment)
  - Actual: hours logged to date
  - Remaining: expected minus actual
  - Percentage complete
- [ ] Flag employees significantly over or under expected pace
- [ ] Filter by service code, district, date range
- [ ] Drill down to individual time entries
- [ ] Typecheck passes
- [ ] Verify in browser

---

## Phase 3: Customer Contracts + Billing Reconciliation

_Match service delivered to service purchased._

### US-017: Customer Contract Management

**Description:** As an admin, I want to create and manage customer contracts so I know what each district purchased.

**Acceptance Criteria:**

- [ ] Contract record with fields:
  - Customer district
  - Fiscal year / contract period (start date, end date)
  - Line items: service code, quantity (e.g., 180 days), unit (days/hours), rate, total amount
  - Contract status: draft, active, completed
- [ ] Multiple line items per contract (district buys combination of services)
- [ ] Contract total auto-calculated from line items
- [ ] Edit existing contracts (with change history)
- [ ] Typecheck passes
- [ ] Verify in browser

### US-018: Contract Change Forms (Add/Drop Services)

**Description:** As an admin, I want to process mid-year contract changes so that when a customer adds or drops services, the billing adjusts automatically.

**Acceptance Criteria:**

- [ ] "Change Form" workflow on any active contract:
  - Add service line item (new service code, quantity, rate)
  - Drop/reduce service line item (reduce quantity or remove entirely)
  - Effective date of change
  - Reason/notes
  - Approval status: submitted, approved, applied
- [ ] Changes recalculate remaining quarterly billing automatically:
  - Added services: cost spread across remaining quarters
  - Dropped services: credit applied to remaining quarters
- [ ] Change history log on each contract (who changed what, when, why)
- [ ] Approval workflow: change submitted → approved by admin → applied to contract
- [ ] Rules engine (to be defined with team): which changes require approval, thresholds, etc.
- [ ] Typecheck passes
- [ ] Verify in browser

### US-019: Customer Reconciliation Dashboard

**Description:** As an admin, I want to see how much service has been delivered vs. purchased for each contract so I can ensure accurate billing.

**Acceptance Criteria:**

- [ ] Per-contract view showing each line item:
  - Purchased: 180 days of OT
  - Delivered: 145 days to date (from timekeeping data)
  - Remaining: 35 days
  - Percentage delivered
  - Pace indicator: on track / ahead / behind based on contract period
- [ ] Roll-up totals per contract and per district
- [ ] Flag contracts where delivery is significantly ahead/behind pace
- [ ] Date range filter to view any period
- [ ] Typecheck passes
- [ ] Verify in browser

### US-020: Quarterly Billing Calculation

**Description:** As an admin, I want the system to calculate quarterly billing amounts so invoices are accurate and consistent.

**Acceptance Criteria:**

- [ ] Billing model: contract total / 4 for first quarter
- [ ] Remaining quarters: remaining balance / remaining quarters
- [ ] Change form adjustments automatically reflected in quarterly amounts
- [ ] Adjustments: if actual delivery is significantly over/under, flag for manual review
- [ ] Per-contract billing schedule showing: Q1 amount, Q2 amount, Q3 amount, Q4 amount
- [ ] Ability to override calculated amounts (with reason)
- [ ] **Fiscal year-end cleanup billing** (after June 30): final reconciliation billing for the fiscal year — adjusts for over/under delivery, unapplied credits, and any remaining balance
- [ ] Support for special/exception billing scenarios (details TBD with team)
- [ ] Typecheck passes
- [ ] Verify in browser

### US-021: Reconciliation Reports

**Description:** As an admin, I want to generate reconciliation reports so I can review service delivery accuracy and share with leadership.

**Acceptance Criteria:**

- [ ] Report types:
  - Customer reconciliation: all contracts, purchased vs. delivered, by service code
  - Employee reconciliation: all employees, expected vs. actual hours, by assignment
  - Service code summary: total hours logged per code across all districts
- [ ] Filter by date range, district, service code, department
- [ ] Export to CSV and PDF
- [ ] Typecheck passes

---

## Phase 4: Customer Portal + Invoicing

_District contacts get self-service access._

### US-022: Customer Portal — Magic Link Auth

**Description:** As a district contact, I want to log in without remembering a password so I can quickly access my contract data.

**Acceptance Criteria:**

- [ ] "Sign In" page with email input
- [ ] System sends magic link email (one-time login link, expires in 24 hours)
- [ ] Link logs user in and redirects to their district dashboard
- [ ] Only pre-registered district contacts can request magic links (admin adds them in US-016)
- [ ] Session persists for 30 days (configurable)
- [ ] Typecheck passes
- [ ] Verify in browser

### US-023: Customer Dashboard

**Description:** As a district contact, I want to see my contract and service delivery status so I know what I've purchased and what's been provided.

**Acceptance Criteria:**

- [ ] District-specific dashboard showing:
  - Active contract(s) with line items
  - Per-service: purchased vs. delivered (progress bars)
  - Overall contract delivery percentage
  - Current quarter billing amount
- [ ] Historical view: past contracts and invoices
- [ ] No access to other districts' data (RLS enforced)
- [ ] Clean, professional design (this is customer-facing)
- [ ] Typecheck passes
- [ ] Verify in browser

### US-024: Quarterly Invoice Generation

**Description:** As an admin, I want to generate quarterly invoices for each district so billing is consistent and professional.

**Acceptance Criteria:**

- [ ] "Generate Invoices" action for a given quarter
- [ ] Invoice includes: district name, contract reference, line items with quantities and amounts, quarter total, year-to-date total, remaining balance
- [ ] PDF download per invoice (NIA-branded)
- [ ] Batch generation: create all district invoices at once
- [ ] Invoice status: draft, sent, paid
- [ ] Auto-send invoice PDF to district contacts via email
- [ ] Typecheck passes
- [ ] Verify in browser

### US-025: Customer Notifications

**Description:** As a district contact, I want to receive email notifications for important billing events so I stay informed.

**Acceptance Criteria:**

- [ ] Email notifications for:
  - New invoice available
  - Contract approaching completion (90% delivered)
  - Quarterly summary
- [ ] Notification preferences manageable by district contact
- [ ] Unsubscribe option
- [ ] Typecheck passes

---

## Phase 5: AI Intelligence Layer

_Transform the system from a data entry tool into a proactive assistant. Built on top of Phases 1-4 data._

### US-026: Smart Time Entry Defaults

**Description:** As a traveling employee, I want the time entry form to pre-fill based on my typical schedule so I spend less time on data entry.

**Acceptance Criteria:**

- [ ] When opening time entry for a given day, AI pre-fills entries based on:
  - Employee's assignment schedule (which districts/codes on which days)
  - Recent patterns ("You logged OT at Lincoln every Tuesday for the last 6 weeks")
  - Calendar data (skip non-working days, adjust for holidays)
- [ ] Pre-filled entries marked as "suggested" with visual distinction (lighter color, dashed border)
- [ ] Employee can accept all, edit individual entries, or dismiss and start blank
- [ ] Suggestions improve over time as more data is logged
- [ ] Never auto-submit — always requires employee confirmation
- [ ] Typecheck passes
- [ ] Verify in browser

### US-027: Voice-to-Timesheet

**Description:** As an employee who travels between districts, I want to voice-log my time while driving so I can record entries without typing on my phone.

**Acceptance Criteria:**

- [ ] "Voice Entry" button on mobile time entry page
- [ ] Records audio, transcribes via speech-to-text API (Whisper or similar)
- [ ] AI parses transcription into structured time entries using the employee's known assignments:
  - Example input: "I spent 3 hours at Lincoln doing OT this morning, then drove to Jefferson for 2 hours of PT eval"
  - Example output: 2 entries — Lincoln/OT/3hrs, Jefferson/PT/2hrs
- [ ] Parsed entries shown as editable "review before submit" cards
- [ ] AI validates against known service codes and districts — flags anything it can't match
- [ ] Employee confirms, edits, or re-records before saving
- [ ] Works offline (record audio, process when back online) — stretch goal
- [ ] Typecheck passes
- [ ] Verify in browser

### US-028: Missing Entry Detection + Nudges

**Description:** As an employee, I want to be reminded if I forgot to log time so gaps don't pile up until year-end.

**Acceptance Criteria:**

- [ ] Nightly check: compare each employee's calendar (expected working days) to logged entries
- [ ] If a working day has no time entry and no recorded absence:
  - Send morning email/push notification: "You didn't log time for Tuesday Feb 11 — did you forget or were you out?"
  - Quick-action links in notification: "Log Time" or "Report Absence"
- [ ] Dashboard widget for admin: "X employees have missing entries this week"
- [ ] Weekly summary email to supervisors with their team's missing entries
- [ ] Configurable grace period (e.g., don't nag until 2 days after)
- [ ] Typecheck passes

### US-029: Continuous Reconciliation Monitor

**Description:** As an admin, I want monthly AI-powered reconciliation reports so problems are caught early instead of at year-end.

**Acceptance Criteria:**

- [ ] Monthly automated reconciliation for every active contract:
  - Expected service delivery pace vs. actual (on track / ahead / behind)
  - Plain-English explanation of gaps: "District A OT is 12% behind. 8 days explained by approved FMLA leave, 4 days appear to be missing time entries from [employee names]"
  - Cross-references: absences, FMLA, holidays, approved leave, missing entries
- [ ] Anomaly detection:
  - Employee assigned to district but hasn't logged time there in 3+ weeks
  - Service delivery significantly ahead of pace (potential over-delivery)
  - Contract approaching exhaustion earlier than expected
- [ ] AI-generated "action items" for each issue (e.g., "Follow up with Jane about missing entries" or "Review OT allocation for District B — on pace to exhaust 6 weeks early")
- [ ] Monthly email digest to admin with top issues across all contracts
- [ ] Drill-down from any issue to the underlying data
- [ ] Typecheck passes
- [ ] Verify in browser

### US-030: Year-End Reconciliation Assistant

**Description:** As an admin, I want AI to prepare the fiscal year-end reconciliation so the cleanup billing process takes hours instead of weeks.

**Acceptance Criteria:**

- [ ] "Year-End Reconciliation" wizard available after June 30:
  - For each contract: purchased vs. delivered, with every gap explained
  - Categories: FMLA leave, approved absences, holidays, missing entries, data errors, sub coverage, change form adjustments
  - Unexplained gaps highlighted in red with suggested investigation steps
- [ ] AI-generated narrative summary per contract: "District A purchased 180 days of OT. 175 days delivered. 3 days accounted for by FMLA (Jan 15-17). 2 days have no explanation — recommend checking with supervisor."
- [ ] Side-by-side comparison: contract line items vs. delivery totals vs. billing to date
- [ ] Export reconciliation report as PDF for leadership review
- [ ] Feeds into US-020 cleanup billing calculation
- [ ] Typecheck passes
- [ ] Verify in browser

### US-031: Customer AI Assistant

**Description:** As a district contact, I want to ask questions about my contract and billing in plain English so I don't have to call NIA for answers.

**Acceptance Criteria:**

- [ ] Chat widget on customer portal dashboard
- [ ] District contact can ask questions like:
  - "How much OT do we have remaining?"
  - "Why was our Q2 bill different from Q1?"
  - "When does our SLP contract expire?"
  - "Show me a breakdown of services received this month"
- [ ] AI answers using only that district's data (RLS-enforced — cannot access other districts)
- [ ] Answers include references to specific data: "Your Q2 bill was $2,400 higher because you added 20 days of PT via change form on November 3"
- [ ] Unanswerable questions route to "Contact NIA" with pre-filled message
- [ ] Typecheck passes
- [ ] Verify in browser

### US-032: Admin Natural Language Queries

**Description:** As an admin, I want to ask questions about the data in plain English instead of building reports manually.

**Acceptance Criteria:**

- [ ] Admin chat/query bar on dashboard:
  - "How much SLP has District C received this quarter?"
  - "Which employees have the most missing time entries?"
  - "Show me all contracts that are behind pace"
  - "What's our total FMLA usage this year?"
- [ ] AI queries the database and returns formatted results (tables, numbers, charts)
- [ ] Can compare across districts, time periods, service codes
- [ ] Results can be exported or saved as a report
- [ ] Typecheck passes
- [ ] Verify in browser

---

## AI Touches in Earlier Phases

_These features are embedded within Phases 1-4, not standalone Phase 5 items._

### Phase 1 AI Enhancement

- **FMLA pattern detection:** Beyond counting consecutive days, AI flags concerning patterns (e.g., "This employee has been absent every Monday for 6 weeks" or "Absences clustering around holidays")
- **Smart form fields:** Absence form auto-suggests district contacts and supervisor based on the employee's assignments

### Phase 2 AI Enhancement

- **Smart defaults** (US-026) should ship WITH Phase 2, not after — it's the difference between a chore and a tool people want to use
- **Duplicate/conflict detection:** "You already logged 7.5 hours to District A today — are you sure you want to add 3 more hours?"

### Phase 3 AI Enhancement

- **Contract pacing alerts** built into the reconciliation dashboard — not a separate AI feature, just AI-powered data interpretation baked into the UI
- **Change form impact preview:** When processing a change form, AI shows projected impact on remaining quarterly billing before applying

### Phase 4 AI Enhancement

- **Customer AI assistant** (US-031) ships with Phase 4 — it's what makes the portal more than just a read-only dashboard
- **Proactive customer notifications:** AI-generated quarterly summary emails to district contacts with plain-English contract status

---

## Customer Portal — Strategic Note

**NIA has never had a customer portal.** This is a first for the organization and represents a significant step in customer service maturity:

- Districts currently get billing/contract info by calling or emailing NIA staff
- A self-service portal with AI-powered Q&A eliminates that overhead
- Professional, polished customer experience differentiates NIA from competitors
- Real-time contract visibility builds trust ("I can see exactly what I'm paying for and what I've received")
- The portal should feel like a premium product — clean, branded, simple
- Consider: the portal could eventually expand beyond billing (e.g., service quality reports, satisfaction surveys, onboarding materials)

---

## Functional Requirements

- FR-01: All teammate authentication via Google OAuth (shared Supabase auth with Excellence Hub)
- FR-02: Customer authentication via magic link (email-based, no password)
- FR-03: Role-based access: teammate (own data), admin (all data), customer (own district)
- FR-04: Absence form sends email notifications to supervisor, OP, and district contacts on submission
- FR-05: System tracks consecutive working-day absences per NIA annual calendar and auto-emails HR at 3+ days
- FR-06: Sub requests generate magic-link claim pages accessible to external agency subs without an NIA account
- FR-07: Sub claims are first-come-first-served with optimistic locking to prevent double-claims
- FR-08: Time entries support multiple entries per day per teammate (split across service codes and districts)
- FR-09: Employee reconciliation compares actual logged hours to assigned expected hours per service code
- FR-10: Customer reconciliation compares actual service delivery hours to contract purchased quantities
- FR-11: Quarterly billing calculated as: Q1 = total/4, subsequent quarters = remaining balance / remaining quarters
- FR-12: All reports exportable to CSV; invoices exportable to PDF
- FR-13: Absence data and timekeeping data live in the same database for cross-referencing (absences reduce available work hours)
- FR-14: All data protected by Supabase RLS — teammates see own data, admins see all, customers see own district
- FR-15: AI time entry suggestions based on employee assignments and historical patterns (never auto-submit)
- FR-16: Voice-to-timesheet via speech-to-text + AI parsing into structured entries with review-before-submit
- FR-17: Nightly missing entry detection compares calendar to logged entries, sends morning nudge notifications
- FR-18: Monthly AI reconciliation report cross-references contracts, time entries, absences, FMLA, and holidays
- FR-19: Year-end reconciliation wizard categorizes every gap with plain-English explanations
- FR-20: Customer portal AI assistant answers district-specific questions using only that district's data (RLS-enforced)
- FR-21: Admin natural language query bar for ad-hoc data questions across all contracts and employees

## Non-Goals (Out of Scope)

- **FMLA intake process** — the system notifies HR but does not manage FMLA paperwork, approvals, or case tracking
- **Payroll integration** — no direct connection to payroll systems; timekeeping data is exported/referenced manually
- **iSite data migration (Phase 1)** — Phase 1 starts clean; historical iSite import is a separate decision for Phase 2+ (team to advise)
- **Student-level tracking** — services are tracked at the district + service code level, not per-student
- **Building/district-level call-in procedures** — NIA's system handles NIA-side notifications; district procedures remain separate
- **APECS uploads** — out of scope per the team's process analysis
- **PTO bank / leave balance tracking** — future consideration, not Phase 1-4
- **Automated schedule optimization** — no AI-based sub matching or schedule suggestions

## Technical Considerations

- **Standalone Next.js 16 app** — separate Vercel project, separate codebase from Excellence Hub
- **Shared Supabase project** — same Postgres instance, different table namespace (prefix `tb_` for time-billing tables), shared `auth.users`
- **Resend for email** — same verified domain (`thenia.org`), same API key
- **Upstash Redis** — rate limiting on magic link generation (prevent abuse)
- **Annual calendar table** — working days, holidays, breaks needed for FMLA consecutive-day calculation
- **Optimistic locking for sub claims** — use Supabase `UPDATE ... WHERE claimed_by IS NULL` pattern to prevent race conditions
- **Mobile-first for time entry and absence forms** — teammates will likely submit from phones
- **Customer portal must be visually distinct** — different color scheme or branding treatment so it's clear this is a customer-facing view
- **Anthropic Claude API** — same API key and streaming pattern as Excellence Hub for all AI features
- **OpenAI Whisper API** (or similar) — speech-to-text for voice-to-timesheet; consider browser-based Web Speech API as a free alternative for initial version
- **AI context design** — each AI query gets only relevant data (employee's assignments, district's contract) to keep responses accurate and costs low
- **Cron jobs for AI monitoring** — nightly missing entry check, monthly reconciliation report (same Vercel cron pattern as Excellence Hub weekly digest)

## Design Considerations

- **NIA branding** throughout (logo, colors) but with a distinct identity from the Excellence Hub
- **Mobile-first** for teammate-facing features (absence form, time entry)
- **Desktop-optimized** for admin features (reconciliation dashboards, contract management)
- **Customer portal** should feel professional and polished — this is NIA's face to its customers
- **Minimal training needed** — the whole point is reducing complexity vs. the current fragmented process

## Success Metrics

- All NIA teammates able to report absences through a single online form (no more calling multiple places)
- Sub coverage confirmed within 1 hour of request (vs. current multi-step manual process)
- HR automatically notified at 3+ consecutive absent days (vs. current: often not notified)
- 100% of employee time logged in one system (vs. current: spreadsheets + iSite + manual reconciliation)
- Customer reconciliation available in real-time (vs. current: manual spreadsheet comparison)
- Quarterly invoices generated in minutes (vs. current: manual calculation and document creation)
- iSite contract ($26K/year) canceled after 1 year of parallel operation
- District contacts can self-serve their billing data without calling NIA (first customer portal in NIA history)
- Year-end reconciliation takes hours instead of weeks
- Missing time entries caught within 48 hours (vs. current: discovered at year-end)
- Monthly reconciliation reports eliminate end-of-year surprise gaps
- Traveling employees complete timesheets 50% faster via smart defaults and voice entry
- Customer portal AI handles routine billing questions without NIA staff involvement

## Resolved Questions

1. ~~**Annual calendar data**~~ → **COMPLEX:** Employees work on different calendars — some on a standard NIA calendar, others on individualized schedules based on assigned districts' school calendars. Currently tracked in a separate system (data silo). **New US-011 added** to handle multi-calendar management.
2. ~~**Service code structure**~~ → **Hierarchical + changes yearly.** Codes are grouped into categories and change between fiscal years. US-014 updated to support hierarchy and versioning.
3. ~~**Employee assignments**~~ → Currently managed in iSite tables. Team can export data when Phase 2 begins.
4. ~~**Contract amendments**~~ → **Frequent.** "Change Form" process where customers add/drop services mid-year, with rules and approvals. Currently in a separate system (another data silo). Plus fiscal year-end cleanup billing after June 30. **New US-018 added.**

## Open Questions (Need Team Input)

1. **Sub pay + billing impact** — Does sub usage affect customer billing? (Jon thinks "both" — subs paid separately but usage affects billing — needs team confirmation)
2. **Parallel operation plan** — During the 1-year testing period, will teammates enter time in BOTH systems (old + new), or migrate in waves? (Haven't decided yet — revisit when closer to launch)
3. **Data retention** — How long should absence and timekeeping records be kept? Any regulatory requirements?
4. **Historical data import** — Team may want to populate the new system with iSite historical data to validate performance. Need team input on which data and how far back.
5. **Special billing scenarios** — Jon mentioned "separate billing for special scenarios" beyond standard quarterly. Need details from team on what these are and how they work.
6. **Change form approval rules** — What rules govern which contract changes require approval? Are there thresholds, authorization levels, or specific approval chains?
7. **District calendar sources** — How do individualized employee calendars get created today? Do employees submit them? Do supervisors? Is there a standard format or is each one different?
8. **Service code hierarchy** — What are the top-level categories? How deep does the hierarchy go? (e.g., Therapy → OT, PT, SLP? Or more levels?)
