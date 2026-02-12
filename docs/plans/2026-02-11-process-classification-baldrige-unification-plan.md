# Process Classification & Baldrige Connections Unification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the boolean `is_key` field with explicit Key/Support/Unclassified process types, unify Baldrige connections around `process_question_mappings`, and make connections visible on process pages with AI-only mapping from both directions.

**Architecture:** Database migration adds `process_type` column, all 22 files referencing `is_key` get updated, health scoring switches from legacy `baldrige_connections` JSONB to real `process_question_mappings` count, and a new "Find Baldrige Connections" feature lets AI suggest mappings from individual process pages.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL), TypeScript, Tailwind CSS v4, Claude Sonnet 4.5 API

**PRD:** `tasks/prd-process-classification-baldrige-unification.md` (10 user stories)

**Design:** `docs/plans/2026-02-11-process-classification-baldrige-unification-design.md`

---

## Task 1: Database Migration — Add `process_type` Column

**PRD:** US-001

**Files:**
- Create: `supabase/migrations/20260211_process_type.sql`

**Step 1: Write the migration SQL**

```sql
-- Add process_type column
ALTER TABLE processes
ADD COLUMN process_type TEXT NOT NULL DEFAULT 'unclassified';

-- Set ALL processes to unclassified (fresh review, even former is_key = true)
UPDATE processes SET process_type = 'unclassified';

-- Add check constraint for valid values
ALTER TABLE processes
ADD CONSTRAINT process_type_check
CHECK (process_type IN ('key', 'support', 'unclassified'));
```

Save to `supabase/migrations/20260211_process_type.sql`.

**Step 2: Run in Supabase SQL Editor**

Copy the SQL and run it in the Supabase dashboard SQL Editor. Verify with:
```sql
SELECT id, name, is_key, process_type FROM processes LIMIT 10;
```
Expected: all rows show `process_type = 'unclassified'`.

**Step 3: Commit**

```bash
git add supabase/migrations/20260211_process_type.sql
git commit -m "feat: add process_type column for key/support classification"
```

---

## Task 2: Update Type Definitions & Shared Libraries

**PRD:** US-001, US-005

**Files:**
- Modify: `lib/types.ts` (lines 74-83, 100-101)
- Modify: `lib/fetch-health-data.ts` (lines 24, 69, 91)
- Modify: `lib/process-health.ts` (lines 51, 133-134)
- Modify: `lib/parse-obsidian-process.ts` (lines 35, 460)

**Step 1: Update `lib/types.ts`**

Add `ProcessType` type and update `Process` interface:

```typescript
// Add near top of file
export type ProcessType = "key" | "support" | "unclassified";
```

In the `Process` interface, add `process_type` field alongside `is_key`:
```typescript
  is_key: boolean;           // KEEP for now — removed in Task 14
  process_type: ProcessType;
```

**Step 2: Update `lib/fetch-health-data.ts`**

- Line 24 interface: add `process_type: ProcessType` field
- Line 69 SQL query: add `process_type` to the select string
- Line 91 mapping: add `process_type: p.process_type as ProcessType || "unclassified"`
- Import `ProcessType` from `lib/types`

**Step 3: Update `lib/process-health.ts`**

- Line 51 `HealthProcessInput` interface: add `process_type: string` field (keep `baldrige_connections` for now — removed in Task 9)

**Step 4: Update `lib/parse-obsidian-process.ts`**

- Line 35: add `process_type: ProcessType` to the parsed interface
- Line 460: add `process_type: "unclassified"` to the returned object

**Step 5: Build and verify**

```bash
npm run build
```
Expected: build passes (may show warnings about unused `is_key` — that's fine for now).

**Step 6: Commit**

```bash
git add lib/types.ts lib/fetch-health-data.ts lib/process-health.ts lib/parse-obsidian-process.ts
git commit -m "feat: add process_type to types and shared libraries"
```

---

## Task 3: Update Process List Page

**PRD:** US-001, US-004

**Files:**
- Modify: `app/processes/page.tsx` (lines 66-74, 131, 188-190, 235, 269-379)

**Step 1: Replace `is_key` toggle with `process_type` toggle**

- Remove `toggleKeyProcess()` function (lines 66-74) — replace with:
```typescript
async function cycleProcessType(id: number, current: string) {
  const next = current === "key" ? "support" : current === "support" ? "unclassified" : "key";
  await supabase.from("processes").update({ process_type: next }).eq("id", id);
  setProcesses((prev) =>
    prev.map((p) => (p.id === id ? { ...p, process_type: next } : p))
  );
}
```

- Update filter: replace `showKeyOnly` boolean with `typeFilter` state:
```typescript
const [typeFilter, setTypeFilter] = useState<"all" | "key" | "support" | "unclassified">("all");
```

- Update filter logic (line 131): replace `if (showKeyOnly && !p.is_key) return false` with:
```typescript
if (typeFilter !== "all" && p.process_type !== typeFilter) return false;
```

**Step 2: Update filter UI**

Replace the single "Key Only" toggle button (line 235) with a segmented filter:
```
All | Key | Support | Unclassified
```
Each button sets `typeFilter`. Use the same styling pattern as the tier filter on the Criteria Map page.

**Step 3: Update display**

Replace star toggle buttons (lines 269-379) with type labels:
- `key` → orange star `★` + "Key" text
- `support` → gray text "Support"
- `unclassified` → muted italic "Unclassified" with subtle border

Make the label clickable to cycle through types (calls `cycleProcessType`).

**Step 4: Update category counts** (lines 188-190)

Replace `p.is_key` filter with `p.process_type === typeFilter` logic.

**Step 5: Ensure Supabase query includes `process_type`**

Find the process list fetch query and add `process_type` to the select string.

**Step 6: Build and verify**

```bash
npm run build
```

**Step 7: Commit**

```bash
git add app/processes/page.tsx
git commit -m "feat: process list uses process_type filter and labels"
```

---

## Task 4: Update Process Edit Page

**PRD:** US-003

**Files:**
- Modify: `app/processes/[id]/edit/page.tsx` (lines 55, 89, 143, 218-235)

**Step 1: Replace star toggle with segmented control**

- Replace `isKey` state (line 55) with:
```typescript
const [processType, setProcessType] = useState<"key" | "support" | "unclassified">("unclassified");
```

- Load from database (line 89): replace `setIsKey(p.is_key || false)` with:
```typescript
setProcessType(p.process_type || "unclassified");
```

- Save to database (line 143): replace `is_key: isKey` with:
```typescript
process_type: processType,
```

**Step 2: Build the segmented control UI**

Replace the toggle switch (lines 218-235) with:
```
Process Type
[  Key  ] [  Support  ]
Helper text: "Key processes directly create value for stakeholders. Support processes enable key processes to function."
```

If `processType === "unclassified"`, show a prompt: "Classify this process" with both buttons in outline style. Once selected, the chosen button gets a filled style (Key = orange, Support = gray).

**Step 3: Build and verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add app/processes/[id]/edit/page.tsx
git commit -m "feat: process edit page Key/Support segmented control"
```

---

## Task 5: Update Process New Pages

**PRD:** US-001

**Files:**
- Modify: `app/processes/new/page.tsx` (lines 25, 54, 126-135)
- Modify: `app/processes/new/ai/page.tsx` (lines 19, 373)

**Step 1: Update manual new process page**

- Replace `isKey` state with `processType` state (default `"unclassified"`)
- Replace toggle UI with same segmented control as edit page
- Update save payload: `process_type: processType` instead of `is_key: isKey`

**Step 2: Update AI new process page**

- Update draft type definition (line 19): `process_type: ProcessType` instead of `is_key: boolean`
- Update display (line 373): show "Key Process" or "Support Process" badge based on `draft.process_type`

**Step 3: Update AI create process API**

File: `app/api/ai/create-process/route.ts`
- Line 57: change `"is_key": false` to `"process_type": "unclassified"` in JSON template
- Line 85: update AI prompt instruction to reference `process_type`
- Line 153: change `is_key: processData.is_key || false` to `process_type: processData.process_type || "unclassified"`

**Step 4: Build and verify**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add app/processes/new/page.tsx app/processes/new/ai/page.tsx app/api/ai/create-process/route.ts
git commit -m "feat: new process pages use process_type"
```

---

## Task 6: Bulk Update Remaining Pages (is_key → process_type)

**PRD:** US-001

**Files (8 pages with same pattern: query, filter, display):**
- Modify: `app/page.tsx` (dashboard — lines 246, 393, 772-775)
- Modify: `app/readiness/page.tsx` (lines 74-77, 196-220, 555-558)
- Modify: `app/adli-insights/page.tsx` (lines 26, 65, 200, 244-246, 308-310)
- Modify: `app/data-health/page.tsx` (lines 77, 92-99, 117, 176-182, 364)
- Modify: `app/categories/page.tsx` (lines 14, 26, 62, 121, 135, 172, 191, 250, 359)
- Modify: `app/schedule/page.tsx` (lines 46, 56, 84, 102, 130, 272, 309)
- Modify: `app/letci/page.tsx` (lines 13, 52, 63, 84, 131, 162, 270, 319)
- Modify: `app/requirements/page.tsx` (lines 30, 127, 141, 449-451)

**Pattern for each page — apply these changes:**

1. **Supabase queries:** Add `process_type` to select strings alongside `is_key`
2. **Interfaces/types:** Add `process_type: string` field
3. **Data mapping:** Add `process_type: p.process_type as string || "unclassified"`
4. **Filter state:** Replace `showKeyOnly` boolean with `typeFilter` state: `"all" | "key" | "support" | "unclassified"`
5. **Filter logic:** Replace `p.is_key` checks with `p.process_type === "key"` (or `typeFilter` checks)
6. **Filter UI:** Replace `"★ Key Only"` toggle with segmented filter: `All | Key | Support`
7. **Display:** Replace `p.is_key && <star>` with type-aware labels:
   - `process_type === "key"` → orange star ★
   - `process_type === "support"` → gray "Support" label (or nothing if space is tight)
   - `process_type === "unclassified"` → nothing (or subtle indicator)
8. **Weighting (readiness, cron):** Replace `proc.is_key ? 2 : 1` with `proc.process_type === "key" ? 2 : 1`

**Special cases:**
- `app/readiness/page.tsx` line 220: `filteredProcesses.filter((p) => p.is_key)` → `filteredProcesses.filter((p) => p.process_type === "key")`
- `app/data-health/page.tsx` line 117: `if (proc.is_key) keyMetrics.add(...)` → `if (proc.process_type === "key") keyMetrics.add(...)`

**Also update API route:**
- Modify: `app/api/cron/weekly-digest/route.ts` (lines 55-58): same weighting pattern
- Modify: `app/api/ai/chat/route.ts` (line 25): `if (process.is_key)` → `if (process.process_type === "key")`
- Modify: `app/api/ai/scores/route.ts` (line 29): add `process_type` to select

**Step 1: Update all 8 pages + 3 API routes**

Use parallel agents if desired — the pages are independent. Apply the pattern above to each file.

**Step 2: Build and verify**

```bash
npm run build
```

This is the critical build — all 22 files now reference `process_type`. Fix any TypeScript errors.

**Step 3: Commit**

```bash
git add app/page.tsx app/readiness/page.tsx app/adli-insights/page.tsx app/data-health/page.tsx app/categories/page.tsx app/schedule/page.tsx app/letci/page.tsx app/requirements/page.tsx app/api/cron/weekly-digest/route.ts app/api/ai/chat/route.ts app/api/ai/scores/route.ts
git commit -m "feat: all pages use process_type instead of is_key"
```

---

## Task 7: AI Classification Endpoint + Review Flow

**PRD:** US-002

**Files:**
- Create: `app/api/processes/classify/route.ts`
- Modify: `app/processes/page.tsx` (add review UI)

**Step 1: Build the AI classification endpoint**

`POST /api/processes/classify` — analyzes all processes and returns suggestions.

```typescript
// Fetch all processes with charter, description, category, ADLI content
// Build compact summaries
// Send to Claude Sonnet 4.5 with prompt:
//   "For each process, classify as 'key' (directly creates value for customers/stakeholders)
//    or 'support' (enables key processes to function). Return JSON."
// Return: [{ process_id, name, current_type, suggestion, rationale }]
```

Key details:
- Rate limit check via `checkRateLimit()`
- Admin-only (same pattern as `/api/criteria/ai-scan`)
- `maxDuration = 120` for large process lists
- Process in batches of 10 (similar to ai-scan batching)
- AI prompt should reference Baldrige Category 6 distinction

**Step 2: Build the review UI on process list page**

Add a "Review Classifications" button in the page header (admin-only via `useRole()`).

When clicked:
1. Shows loading spinner: "AI is analyzing your processes..."
2. Calls `POST /api/processes/classify`
3. Displays review table overlay/section:
   - Columns: Process Name | Former Status | AI Suggestion | Rationale | Action
   - Former Status: "Was Key" (orange) or "Was Unlabeled" (gray) based on original `is_key`
   - AI Suggestion: "Key" (orange badge) or "Support" (gray badge)
   - Action: Accept / Override toggle
4. "Accept All" button at top
5. "Save Classifications" button — PATCH each process with chosen type
6. After saving: close review UI, refresh process list

**Step 3: Build and verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add app/api/processes/classify/route.ts app/processes/page.tsx
git commit -m "feat: AI classification review flow for Key/Support"
```

---

## Task 8: Deploy + Test Classification (Checkpoint)

**Step 1: Deploy to Vercel**

```bash
vercel --prod
```

**Step 2: Browser verification**

- [ ] Process list shows new type filter (All / Key / Support / Unclassified)
- [ ] All processes show as "Unclassified" (fresh start)
- [ ] "Review Classifications" button visible for admin
- [ ] AI classification returns suggestions
- [ ] Accept All + Save works
- [ ] Process edit page shows Key/Support segmented control
- [ ] Readiness page weighting still works (key = 2x)
- [ ] Dashboard "Key Only" filter works with new field

**Step 3: Commit any fixes**

---

## Task 9: Health Score — Switch to `process_question_mappings`

**PRD:** US-005

**Files:**
- Modify: `lib/process-health.ts` (lines 51, 133-134)
- Modify: `lib/fetch-health-data.ts` (add mapping count fetch)

**Step 1: Add mapping count to health data fetch**

In `lib/fetch-health-data.ts`, add a parallel query to fetch mapping counts per process:

```typescript
// Add to the Promise.all block:
supabase.from("process_question_mappings")
  .select("process_id")
```

Then compute a `Map<number, number>` of process_id → mapping count. Pass it into the health score calculation.

**Step 2: Update health score interface**

In `lib/process-health.ts`, add to `HealthProcessInput`:
```typescript
baldrige_mapping_count: number;  // from process_question_mappings
```

**Step 3: Update scoring logic**

Replace lines 133-134:
```typescript
// OLD: const baldrigePts = hasContent(process.baldrige_connections) ? 2 : 0;
// NEW:
const baldrigePts = process.baldrige_mapping_count > 0 ? 2 : 0;
```

Keep the label: `{ label: "Baldrige Connections", earned: baldrigePts, possible: 2 }`

**Step 4: Update caller in fetch-health-data.ts**

Pass the mapping count when calling `calculateHealthScore()`:
```typescript
baldrige_mapping_count: mappingCountMap.get(proc.id) || 0,
```

**Step 5: Build and verify**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add lib/process-health.ts lib/fetch-health-data.ts
git commit -m "feat: health score uses process_question_mappings instead of legacy field"
```

---

## Task 10: Baldrige Connections Card on Process Detail Page

**PRD:** US-006

**Files:**
- Modify: `app/processes/[id]/page.tsx` (Overview tab, right column)

**Step 1: Fetch full mapping data**

Replace the existing `ebMappings` fetch (which only gets count) with a richer query:

```typescript
// Fetch all mappings for this process, joined to questions and items
supabase.from("process_question_mappings")
  .select("id, coverage, mapped_by, baldrige_questions!inner(id, question_code, area_label, question_text, tier, baldrige_items!inner(id, item_code, item_name, category_name, category_number))")
  .eq("process_id", id)
```

**Step 2: Group mappings by Baldrige item**

```typescript
// Group: Map<item_code, { item_name, category_name, questions: [...] }>
```

**Step 3: Build the Baldrige Connections card**

Place in Overview tab right column, below Quick Info card:

```
Baldrige Connections (X questions)
──────────────────────────────────
▸ 6.1 Work Processes — 3 questions [primary]
  (click to expand: individual questions with coverage badges)
▸ 1.1 Senior Leadership — 1 question [supporting]
  (click to expand)

[Find Baldrige Connections] button  (→ wired in Task 11)
Manage on Criteria Map →
```

- Use `expandedBaldrigeItems` state (Set<string>) for expand/collapse
- Coverage badge colors: primary = green, supporting = gray-blue, partial = orange (same as Criteria Map)
- Empty state: "No Baldrige connections yet" + "Find Connections" CTA

**Step 4: Remove old "EB Connections" from Quick Info card**

Delete the `ebMappings.length > 0` block from the Quick Info card — replaced by the full connections card.

**Step 5: Build and verify**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add app/processes/[id]/page.tsx
git commit -m "feat: Baldrige Connections card on process detail Overview tab"
```

---

## Task 11: Find Baldrige Connections API + Process Page Integration

**PRD:** US-007

**Files:**
- Create: `app/api/criteria/suggest-for-process/route.ts`
- Modify: `app/processes/[id]/page.tsx` (wire button to API)

**Step 1: Build the per-process AI suggestion endpoint**

`POST /api/criteria/suggest-for-process` — given a process_id, finds matching Baldrige questions.

```typescript
// 1. Fetch the process (charter, ADLI, description)
// 2. Fetch all Baldrige questions NOT already mapped to this process
// 3. Build process context (charter + ADLI, capped at ~3K chars)
// 4. Send to Claude with prompt:
//    "Given this process, which Baldrige questions does it address?
//     Return JSON array of suggestions with question_id, coverage, rationale."
// 5. Return suggestions
```

Key details:
- Rate limit + admin check
- `maxDuration = 120`
- Process questions in batches of 10 (send question text, get matches)
- Return: `{ suggestions: [{ question_id, question_code, question_text, item_code, item_name, coverage, rationale }] }`

**Step 2: Wire "Find Baldrige Connections" button**

On the process detail page Baldrige Connections card:
- Button shows spinner while loading
- On success, render suggestion cards below the existing connections:
  ```
  AI Suggestions
  ─────────────
  [6.1a(2)] How do you manage work processes?
  Coverage: primary | "This process directly manages..."
  [Accept] [Dismiss]
  ```
- Accept calls `POST /api/criteria/mappings` (existing endpoint) with `mapped_by: "ai_confirmed"`
- After accepting, refresh the connections card

**Step 3: Build and verify**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add app/api/criteria/suggest-for-process/route.ts app/processes/[id]/page.tsx
git commit -m "feat: Find Baldrige Connections with AI from process page"
```

---

## Task 12: Remove Manual Mapping from Criteria Map

**PRD:** US-008

**Files:**
- Modify: `app/criteria/page.tsx` (remove manual mapping UI)

**Step 1: Remove manual mapping controls**

In the expanded question detail area (lines 630-740), remove:
- Any manual "add process" dropdown or form
- Keep: "Suggest Mappings" per-question button (AI-generated)
- Keep: "AI Scan All" bulk button
- Keep: Accept/Dismiss on suggestion cards
- Keep: "Remove" button on existing mappings

Note: Based on the current code, the Criteria Map already only uses AI suggestions — there's no manual "add" dropdown. If confirmed, this task just verifies and documents that manual mapping was never built, and the PRD acceptance criteria is already met.

**Step 2: Verify and confirm**

Review the expanded question section. If there's no manual mapping UI, mark this task as complete.

**Step 3: Commit (if changes needed)**

```bash
git add app/criteria/page.tsx
git commit -m "refactor: confirm Criteria Map is AI-only mapping"
```

---

## Task 13: Process Edit Page — Read-Only Baldrige Connections

**PRD:** US-009

**Files:**
- Modify: `app/processes/[id]/edit/page.tsx` (lines 460-480)

**Step 1: Fetch mappings for this process**

Add a Supabase query in the edit page's data fetch to get `process_question_mappings` for the current process (same query pattern as Task 10).

**Step 2: Replace info box with read-only connections view**

Replace the current "Managed automatically via AI mapping" info box (lines 460-480) with:
- Grouped-by-item connections list (same visual style as detail page card, but simpler)
- Coverage badges on each item
- "Manage on Criteria Map →" link
- Empty state: "No connections yet — use Find Connections on the process page"

**Step 3: Remove `baldrige_connections` from save payload**

Line 153: remove `baldrige_connections: baldrigeConn` from the update object.
Line 99: remove `setBaldrigeConn(p.baldrige_connections)` state initialization.

**Step 4: Build and verify**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add app/processes/[id]/edit/page.tsx
git commit -m "feat: edit page shows read-only Baldrige connections, stops writing legacy field"
```

---

## Task 14: Legacy Cleanup — Remove `baldrige_connections` References

**PRD:** US-010

**Files:**
- Modify: `lib/types.ts` — remove `BaldigeConnections` interface and `baldrige_connections` field from `Process`
- Modify: `lib/fetch-health-data.ts` — remove from interface, query, and mapping
- Modify: `lib/process-health.ts` — remove from `HealthProcessInput` (already replaced in Task 9)
- Modify: `lib/parse-obsidian-process.ts` — remove from interface and returned object
- Modify: `app/processes/[id]/page.tsx` — remove from interface and any remaining references
- Modify: `app/processes/[id]/edit/page.tsx` — remove state, query field (already done in Task 13)
- Modify: `app/api/ai/chat/route.ts` (lines 95-99) — remove Baldrige Connections context section
- Keep: `app/api/criteria/convert-legacy/route.ts` — leave as-is (one-time migration tool, harmless)

**Also remove `is_key` references (now fully replaced by `process_type`):**
- Modify: `lib/types.ts` — remove `is_key: boolean` from `Process` interface
- Modify: `lib/fetch-health-data.ts` — remove `is_key` from interface, query, mapping
- Modify: `lib/parse-obsidian-process.ts` — remove `is_key` from interface and returned object
- All page files from Task 6 — remove any remaining `is_key` references (should already be done)

**Step 1: Remove `baldrige_connections` from all files**

Work through each file listed above. Search for `baldrige_connections`, `baldrigeConn`, `BaldigeConnections` and remove.

**Step 2: Remove `is_key` from all files**

Search for `is_key` and `isKey` across the codebase. Remove any remaining references. All functionality should now use `process_type`.

**Step 3: Build and verify**

```bash
npm run build
```

This is the final verification — the entire codebase should compile with zero references to `is_key` or `baldrige_connections` (except the legacy converter route and migration files).

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy is_key and baldrige_connections from codebase"
```

---

## Task 15: Final Deploy + End-to-End Verification

**Step 1: Deploy to Vercel**

```bash
vercel --prod
```

**Step 2: Run legacy converter one last time**

In the browser, call `/api/criteria/convert-legacy` (POST) to migrate any remaining `baldrige_connections` data to `process_question_mappings`.

**Step 3: Browser verification checklist**

Process Classification:
- [ ] Process list shows All/Key/Support/Unclassified filter
- [ ] "Review Classifications" button works (AI suggests, user confirms)
- [ ] Process edit page has Key/Support segmented control
- [ ] New process page has Key/Support control
- [ ] Dashboard "Key Only" filter uses new field
- [ ] Readiness page weights key processes 2x
- [ ] All other pages (ADLI Insights, Data Health, Categories, Schedule, LeTCI, Requirements) show correct labels

Baldrige Connections:
- [ ] Process detail Overview tab shows Baldrige Connections card
- [ ] Connections grouped by item with expand/collapse
- [ ] "Find Baldrige Connections" button triggers AI scan
- [ ] AI suggestion cards show with Accept/Dismiss
- [ ] Accepted suggestions appear in connections card
- [ ] Process edit page shows read-only connections
- [ ] Health score uses mapping count (not legacy field)
- [ ] Criteria Map still works (AI Scan All, per-question suggest)

**Step 4: Final commit if any fixes needed**

---

## Summary: Task Order & Dependencies

```
Task 1:  Migration (process_type column)          ← Foundation
Task 2:  Types + shared libs                       ← Depends on Task 1
Task 3:  Process list page                         ← Depends on Task 2
Task 4:  Process edit page                         ← Depends on Task 2
Task 5:  Process new pages + AI create API         ← Depends on Task 2
Task 6:  Bulk update remaining 8 pages + 3 APIs    ← Depends on Task 2
Task 7:  AI classification endpoint + review flow  ← Depends on Task 3
Task 8:  DEPLOY + TEST CHECKPOINT                  ← Depends on Tasks 3-7
Task 9:  Health score switch                       ← Independent (can parallel with 3-7)
Task 10: Baldrige Connections card on detail page   ← Independent (can parallel with 3-7)
Task 11: Find Baldrige Connections API + UI         ← Depends on Task 10
Task 12: Criteria Map manual mapping removal        ← Independent
Task 13: Edit page read-only connections            ← Depends on Task 10
Task 14: Legacy cleanup (remove is_key + baldrige)  ← Depends on ALL above
Task 15: Final deploy + E2E verification            ← Depends on Task 14
```

**Parallelizable groups:**
- Tasks 3, 4, 5, 6 can run in parallel (all depend on Task 2 only)
- Tasks 9, 10, 12 can run in parallel with each other
- Task 14 must be LAST before final deploy
