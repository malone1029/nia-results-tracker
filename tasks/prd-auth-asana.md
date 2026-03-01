# PRD: Google Auth + Asana Integration

## Introduction

Add team authentication and bidirectional Asana integration to the NIA Excellence Hub. These two features work together: Google Auth identifies who's using the app (and restricts access to the NIA team), while Asana integration lets each authenticated user connect their own Asana account to import and export processes.

Right now the app is open to anyone with the URL. Adding auth locks it down to `@nia.org` accounts. And while the app already has powerful AI-guided process improvement, most of NIA's real process documentation lives in Asana projects. Connecting Asana means the team can pull their half-documented processes into the Excellence Hub, let AI flesh them out with full ADLI rigor, and push the improved version back — without leaving their existing workflow behind.

## Goals

- Require Google sign-in for all app access, restricted to `@nia.org` email addresses
- Let each team member connect their own Asana account via OAuth
- Import Asana projects into NIA processes (overview, sections, tasks mapped to process fields)
- Export NIA processes back to Asana (update the original project, or create a new one)
- After import, offer AI gap-fill so the user can immediately improve the process
- Track which processes are linked to Asana and show sync status
- Keep the setup simple — no admin panel, no role management (everyone is equal for now)

## User Stories

### US-001: Google OAuth Sign-In via Supabase

**Description:** As a team member, I want to sign in with my Google account so only NIA staff can access the app.

**Acceptance Criteria:**

- [ ] "Sign in with Google" button on a login page (`/login`)
- [ ] Uses Supabase Auth with Google OAuth provider (built-in, no custom auth code)
- [ ] After sign-in, Supabase creates a user record with email, name, and avatar from Google
- [ ] Only `@nia.org` email addresses are allowed — others see an error message: "Access is restricted to NIA team members"
- [ ] Sign-in redirects to the dashboard (or the page the user originally tried to visit)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-002: Auth Middleware and Protected Routes

**Description:** As a developer, I need middleware that checks authentication on every page so unauthenticated users can't access the app.

**Acceptance Criteria:**

- [ ] Create `middleware.ts` at the project root that checks for a valid Supabase Auth session
- [ ] Unauthenticated requests to any page (except `/login`) are redirected to `/login`
- [ ] API routes (`/api/*`) return 401 for unauthenticated requests (except any public health-check routes)
- [ ] Supabase client updated to use auth session — create a server-side client helper that reads the session from cookies
- [ ] User session is accessible in both server components and client components
- [ ] Typecheck/lint passes

---

### US-003: User Profile Display and Sign Out

**Description:** As a signed-in user, I want to see who I'm logged in as and be able to sign out.

**Acceptance Criteria:**

- [ ] User avatar (from Google) and name displayed in the nav bar (top right on desktop, in the mobile menu)
- [ ] Clicking the avatar shows a dropdown with "Sign Out" option
- [ ] Sign out clears the Supabase session and redirects to `/login`
- [ ] If Google doesn't provide an avatar, show the user's initials in a colored circle
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-004: Row-Level Security Policies

**Description:** As a developer, I need to update Supabase RLS policies so the database is protected even if someone bypasses the UI.

**Acceptance Criteria:**

- [ ] Replace all blanket `USING (true)` RLS policies with `USING (auth.uid() IS NOT NULL)` (any authenticated user can read/write)
- [ ] This is intentionally simple — no per-user ownership filtering yet (entire NIA team shares all data)
- [ ] Verify that all existing features still work after RLS update (processes, metrics, AI features)
- [ ] Create a SQL migration file: `supabase/migration-005-auth-rls.sql`
- [ ] Typecheck/lint passes

---

### US-005: Connect Asana Account (OAuth)

**Description:** As a team member, I want to connect my Asana account so the app can access my Asana projects on my behalf.

**Acceptance Criteria:**

- [ ] "Connect Asana" button on a new `/settings` page
- [ ] Clicking it starts the Asana OAuth flow (redirects to Asana's consent screen)
- [ ] After authorization, Asana sends back an access token and refresh token
- [ ] Tokens stored securely in a new `user_asana_tokens` table: `id`, `user_id` (FK to auth.users), `access_token`, `refresh_token`, `workspace_id`, `workspace_name`, `connected_at`
- [ ] Token refresh logic: if access token is expired, use refresh token to get a new one automatically
- [ ] Settings page shows connection status: "Connected as [Asana user name] in [workspace name]" with a "Disconnect" option
- [ ] Disconnecting deletes the stored tokens
- [ ] RLS policy: users can only read/write their own token row (`USING (auth.uid() = user_id)`)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-006: Browse and Select Asana Projects

**Description:** As a user, I want to browse my Asana projects so I can pick which one to import as a process.

**Acceptance Criteria:**

- [ ] New "Import from Asana" tab on the existing `/processes/import` page (alongside "From Obsidian Vault" and "Paste Markdown")
- [ ] Tab shows a list of the user's Asana projects (name, workspace, last modified date) fetched from the Asana API
- [ ] Projects grouped by Asana workspace/team if the user belongs to multiple
- [ ] Search/filter to find a specific project by name
- [ ] Each project shows a preview of its description (first 100 characters)
- [ ] "Import" button next to each project
- [ ] If user hasn't connected Asana yet, show a message with a link to `/settings`
- [ ] Loading state while fetching projects from Asana API
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-007: Import Asana Project as Process

**Description:** As a user, I want to import an Asana project into the Excellence Hub so I can work on it with the ADLI framework and AI tools.

**Acceptance Criteria:**

- [ ] Clicking "Import" on an Asana project fetches the full project data from the Asana API:
  - Project name and description (`notes` / `html_notes`)
  - All sections (ordered)
  - All tasks within each section (name, description, assignee, completion status)
  - Custom fields (if any)
- [ ] Mapping logic converts Asana data to NIA process fields:
  - Project name → process name
  - Project description/overview → charter content (purpose, scope)
  - Sections → mapped to ADLI dimensions if names match (e.g., "Approach", "How we do it"), otherwise stored as workflow steps
  - Tasks → action items within the mapped sections
  - Assignee → process owner (if a single primary assignee can be identified)
- [ ] New process created in Supabase with `template_type: 'full'` and `status: 'draft'`
- [ ] Store the Asana link: add `asana_project_gid` and `asana_project_url` columns to the `processes` table
- [ ] After import, redirect to the new process detail page
- [ ] After redirect, show a prompt: "Process imported! Want AI to analyze it for ADLI gaps?" with [Analyze Now] and [Skip] buttons
- [ ] "Analyze Now" opens the AI chat panel and triggers the ADLI gap analysis automatically
- [ ] If a process with the same `asana_project_gid` already exists, warn the user and offer to update the existing one instead of creating a duplicate
- [ ] Create a SQL migration file: `supabase/migration-006-asana-fields.sql`
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-008: Export Process to Asana (Update Original)

**Description:** As a user, I want to push my improved process back to the Asana project it came from so my team sees the updated documentation in Asana.

**Acceptance Criteria:**

- [ ] "Sync to Asana" button on the process detail page (only visible if the process has an `asana_project_gid`)
- [ ] Export maps NIA process fields back to Asana:
  - Charter content → Project overview/description (`notes` field via Asana API)
  - ADLI sections → Asana sections (create if they don't exist, update if they do)
  - Action items within ADLI sections → Asana tasks within those sections
- [ ] Before syncing, show a preview of what will change: "Will update project description, add 3 sections, create 8 tasks"
- [ ] Confirmation dialog: "This will update [Asana Project Name]. Continue?"
- [ ] Success message with a link to the Asana project: "Synced! View in Asana →"
- [ ] Error handling if the user's Asana token has expired or been revoked (prompt to reconnect)
- [ ] Record the sync in `process_history`: "Synced to Asana project [name] by [user]"
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-009: Export Process to New Asana Project

**Description:** As a user, I want to export a process that was created in the app (not imported from Asana) to a new Asana project so my team can access it there too.

**Acceptance Criteria:**

- [ ] "Export to Asana" button on the process detail page (visible when the process does NOT have an `asana_project_gid`)
- [ ] User picks which Asana workspace/team to create the project in (dropdown, fetched from Asana API)
- [ ] Creates a new Asana project with:
  - Project name = process name
  - Project description = charter content (formatted as readable text, not raw JSON)
  - Sections for each ADLI dimension (Approach, Deployment, Learning, Integration)
  - Tasks for key action items within each section
- [ ] After creation, stores the new `asana_project_gid` and `asana_project_url` on the process
- [ ] The "Export to Asana" button changes to "Sync to Asana" now that the link exists
- [ ] Success message with link: "Created Asana project! View in Asana →"
- [ ] Record in `process_history`: "Exported to new Asana project [name] by [user]"
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

---

### US-010: Asana Sync Status Indicator

**Description:** As a user, I want to see which processes are linked to Asana and whether they're in sync so I know if I need to push or pull updates.

**Acceptance Criteria:**

- [ ] On the processes list page, show an Asana icon/badge next to processes that have an `asana_project_gid`
- [ ] On the process detail page, show a sync status section:
  - "Linked to Asana: [project name]" with a clickable link to the Asana project
  - "Last synced: [date]" (from `process_history`)
  - "Local changes since last sync: Yes/No" (compare `process.updated_at` to last sync timestamp)
- [ ] If there are unsynced local changes, the "Sync to Asana" button gets a subtle highlight (e.g., orange dot)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev server

## Functional Requirements

- FR-1: Use Supabase Auth with Google OAuth provider — no custom auth backend
- FR-2: Email domain restriction to `@nia.org` enforced at sign-in (check email domain after OAuth callback, reject non-matching)
- FR-3: Auth middleware (`middleware.ts`) protects all routes except `/login`
- FR-4: Supabase client split into two helpers: browser client (for client components) and server client (for API routes/middleware, reads session from cookies)
- FR-5: Asana OAuth tokens stored per-user in `user_asana_tokens` with automatic refresh
- FR-6: Asana API calls use the authenticated user's token (each person acts as themselves in Asana)
- FR-7: Import mapping: Asana project overview → charter, sections → ADLI dimensions or workflow steps, tasks → action items
- FR-8: Export mapping: charter → project description, ADLI dimensions → sections, action items → tasks
- FR-9: Bidirectional link tracked via `asana_project_gid` column on the `processes` table
- FR-10: Export to existing Asana project updates in place; export from non-Asana process creates new project
- FR-11: All Asana API calls go through server-side API routes (tokens never sent to the browser)
- FR-12: RLS policies updated from blanket `true` to require `auth.uid() IS NOT NULL`

## Non-Goals (Out of Scope)

- No role-based permissions (admin vs. viewer vs. editor) — all signed-in users have equal access
- No automatic real-time sync between Asana and the app (user triggers import/export manually)
- No Asana webhook listeners for push notifications when Asana projects change
- No bulk import of multiple Asana projects at once (import one at a time)
- No sync of Asana comments, activity feed, or attachments
- No custom field mapping UI (we use sensible defaults; custom mapping can come later)
- No support for Asana Personal Access Tokens (OAuth only, so teammates use their own login)

## Design Considerations

- Login page: clean, centered card with NIA logo, "Sign in with Google" button, and "Access restricted to NIA team" note
- User avatar in nav follows existing brand: dark teal background, avatar circle at far right
- Settings page is a simple single-column layout — "Connected Accounts" section with Asana connection card
- Asana import tab follows the existing import page pattern (tabs for source type, list of items to import)
- "Sync to Asana" / "Export to Asana" buttons use the existing brand colors: green (`#b1bd37`) for primary action
- Asana icon: use the Asana logo or a generic sync icon (e.g., two rotating arrows) next to linked processes
- Sync preview dialog follows the existing confirmation pattern (modal with details and confirm/cancel)

## Technical Considerations

- **Supabase Auth:** Enable Google provider in Supabase dashboard. Create a Google Cloud OAuth app (free, takes ~10 minutes) to get client ID and secret. Configure authorized redirect URI to match Supabase's callback URL.
- **Supabase client refactor:** Currently uses a single public client (`lib/supabase.ts`). Need to add:
  - `lib/supabase-browser.ts` — client-side, uses `createBrowserClient` from `@supabase/ssr`
  - `lib/supabase-server.ts` — server-side, uses `createServerClient` from `@supabase/ssr` with cookie handling
- **Middleware:** Next.js `middleware.ts` at project root. Uses server Supabase client to check session. Runs on every request (with matcher config to exclude static assets).
- **Asana OAuth:** Register an app in the Asana Developer Console (free). OAuth flow: redirect to `https://app.asana.com/-/oauth_authorize` → user approves → callback to `/api/asana/callback` with auth code → exchange for access+refresh tokens. Tokens expire after 1 hour; refresh tokens are long-lived.
- **Asana API endpoints used:**
  - `GET /users/me` — verify connection, get user info
  - `GET /projects?workspace={id}` — list projects in a workspace
  - `GET /projects/{gid}` — project details including `notes`/`html_notes`
  - `GET /sections?project={gid}` — list sections in a project
  - `GET /tasks?section={gid}` — list tasks in a section
  - `PUT /projects/{gid}` — update project description
  - `POST /projects` — create new project
  - `POST /sections` — create section in a project
  - `POST /tasks` — create task in a section
  - `PUT /tasks/{gid}` — update existing task
- **Environment variables (new):**
  - `ASANA_CLIENT_ID` — from Asana Developer Console
  - `ASANA_CLIENT_SECRET` — from Asana Developer Console
  - `NEXT_PUBLIC_APP_URL` — base URL for OAuth redirect (e.g., `https://nia-results-tracker.vercel.app`)
- **Database migrations:**
  - `migration-005-auth-rls.sql` — update all RLS policies to require auth
  - `migration-006-asana-fields.sql` — `user_asana_tokens` table + `asana_project_gid`/`asana_project_url` columns on `processes`

## Success Metrics

- NIA team members can sign in with Google in under 10 seconds
- Non-NIA emails are blocked from accessing the app
- A user can connect their Asana account and import a project in under 2 minutes
- Imported processes retain all meaningful content from the Asana project (nothing silently lost)
- Exported processes create a well-organized Asana project that the team can use immediately
- Round-trip works: import from Asana → improve with AI → export back to Asana with improvements intact

## Open Questions

- Should we store a `last_synced_at` timestamp directly on the `processes` table, or derive it from `process_history`? (Direct column is simpler to query; history is more flexible.)
- When exporting ADLI sections to Asana, should tasks include the full section text as task descriptions, or just key bullet points? (Full text could be overwhelming in Asana's task view.)
- Should the import preserve Asana task completion status (done/not done) as any field in the process, or just import everything as active content?
- If a teammate hasn't connected their Asana account, should they still see the "Sync to Asana" button (grayed out with a tooltip), or hide it entirely?

## Implementation Order

Build in layers — each ships independently and adds value:

| Layer                   | Stories        | What Ships                                                   | Prerequisites                            |
| ----------------------- | -------------- | ------------------------------------------------------------ | ---------------------------------------- |
| **1. Auth Foundation**  | US-001, US-002 | Google sign-in required, routes protected                    | Google Cloud OAuth app + Supabase config |
| **2. User Experience**  | US-003, US-004 | Profile in nav, sign out, database locked down               | Layer 1                                  |
| **3. Asana Connection** | US-005         | Settings page, Asana OAuth flow, token storage               | Layer 1 + Asana Developer Console app    |
| **4. Import**           | US-006, US-007 | Browse Asana projects, import as process, AI gap-fill prompt | Layer 3                                  |
| **5. Export**           | US-008, US-009 | Sync back to original Asana project or create new one        | Layer 3                                  |
| **6. Polish**           | US-010         | Sync status indicators, visual cues for unsynced changes     | Layers 4 & 5                             |
