# Cross-App Performance Pillar — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the 4th and final pillar of the Cross-App Polish Roadmap by auditing and optimizing performance across all 4 NIA apps.

**Architecture:** Audit-first approach — install bundle analyzer and Lighthouse on all apps, capture baselines, then fix app-by-app. Each app gets its own PR with before/after metrics. Fixes include dynamic imports for heavy libraries, next/image migration, preconnect hints, font verification, and image compression.

**Tech Stack:** Next.js 16, @next/bundle-analyzer, Lighthouse CLI, next/image, sharp (image compression)

---

## Phase 1: Audit Setup

### Task 1: Install Global Tools

**Step 1: Install Lighthouse CLI globally**

Run: `npm install -g lighthouse`

**Step 2: Verify installation**

Run: `lighthouse --version`
Expected: Version number printed (e.g., `12.x.x`)

**Step 3: Install sharp globally for image compression**

Run: `npm install -g sharp-cli`

**Step 4: Verify sharp**

Run: `npx sharp-cli --version`

---

### Task 2: Install Bundle Analyzer on All 4 Apps

For each app, install `@next/bundle-analyzer` as a dev dependency and wire it into `next.config.ts`.

**Apps and paths:**

- Excellence Hub: `~/projects/nia-results-tracker/`
- Resolve: `~/projects/resolve/`
- Tempo: `~/Tempo/`
- Tick: `~/projects/nia-time-billing/`

**Step 1: Install the package in all 4 apps**

Run (in each app directory):

```bash
npm install --save-dev @next/bundle-analyzer
```

**Step 2: Update next.config.ts in each app**

Wrap the existing config with the analyzer. Pattern:

```ts
import type { NextConfig } from 'next';
import withBundleAnalyzer from '@next/bundle-analyzer';

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // ... existing config stays the same ...
};

export default analyzer(nextConfig);
```

**Files to modify:**

- `~/projects/nia-results-tracker/next.config.ts` — has `images` + `redirects`, keep them
- `~/projects/resolve/next.config.ts` — empty config, just wrap it
- `~/Tempo/next.config.ts` — empty config, just wrap it
- `~/projects/nia-time-billing/next.config.ts` — has `images` + `redirects`, keep them

**Step 3: Verify builds still pass**

Run in each app: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

In each app:

```bash
git checkout -b jon/performance-pass
git add next.config.ts package.json package-lock.json
git commit -m "chore: add @next/bundle-analyzer for performance audit"
```

---

### Task 3: Run Bundle Analysis on All 4 Apps

**Step 1: Run analysis in each app**

```bash
cd ~/projects/nia-results-tracker && ANALYZE=true npm run build
cd ~/projects/resolve && ANALYZE=true npm run build
cd ~/Tempo && ANALYZE=true npm run build
cd ~/projects/nia-time-billing && ANALYZE=true npm run build
```

Each will open a browser tab with an interactive treemap. The build also generates `.next/analyze/` files.

**Step 2: Record findings**

For each app, note:

- Total client-side JS size
- Largest chunks and what's in them
- Any dependencies that appear in client bundles but should be server-only
- Recharts bundle size (Hub and Resolve)

Save findings in a temporary file: `~/performance-audit-notes.md`

---

### Task 4: Run Lighthouse Baselines on All 4 Deployed Apps

**Step 1: Run Lighthouse on each app's login page**

```bash
lighthouse https://nia-results-tracker.vercel.app/login --output=json --output-path=~/lighthouse-hub-login.json --chrome-flags="--headless"
lighthouse https://resolve-jade.vercel.app/login --output=json --output-path=~/lighthouse-resolve-login.json --chrome-flags="--headless"
lighthouse https://tempo-three-tau.vercel.app/login --output=json --output-path=~/lighthouse-tempo-login.json --chrome-flags="--headless"
lighthouse https://nia-time-billing.vercel.app/login --output=json --output-path=~/lighthouse-tick-login.json --chrome-flags="--headless"
```

**Step 2: Also run on each app's main dashboard page (requires auth, so use login page as proxy)**

The login page is the best unauthenticated page to test because it's the first page users see.

**Step 3: Extract key metrics from JSON results**

For each app, record:

- Performance score (0-100)
- LCP (Largest Contentful Paint) — target < 2.5s
- CLS (Cumulative Layout Shift) — target < 0.1
- INP (Interaction to Next Paint) — target < 200ms
- FCP (First Contentful Paint) — target < 1.8s
- TTFB (Time to First Byte) — target < 800ms

Add these to `~/performance-audit-notes.md`

---

## Phase 2: Fix — Excellence Hub

**Repo:** `~/projects/nia-results-tracker/`
**Branch:** `jon/performance-pass` (created in Task 2)

### Task 5: Dynamic Import Recharts in Excellence Hub

Recharts is ~500KB and is imported at the top level in 5 page files. Wrapping chart sections in `next/dynamic` defers loading until the user actually visits that page.

**Files to modify:**

**5a. `app/readiness/page.tsx` (lines 18-27)**

Replace the direct recharts import with a dynamically-imported chart wrapper component. The pattern:

1. Create a new file `app/readiness/readiness-charts.tsx` that contains the chart JSX currently in the page
2. In the page file, replace the recharts import with:

```tsx
import dynamic from 'next/dynamic';
const ReadinessCharts = dynamic(() => import('./readiness-charts'), { ssr: false });
```

3. Move the chart rendering JSX into the new component
4. The page renders `<ReadinessCharts data={...} />` instead of inline `<LineChart>` etc.

**5b. `app/data-health/page.tsx` (line 18)**

Same pattern — extract chart JSX into `app/data-health/data-health-charts.tsx`, dynamic import.

**5c. `app/metric/[id]/page.tsx` (lines 20-30)**

Same pattern — extract into `app/metric/[id]/metric-charts.tsx`, dynamic import.

**5d. `app/surveys/[id]/results/page.tsx` (lines 9-23)**

Same pattern — extract into `app/surveys/[id]/results/survey-charts.tsx`, dynamic import.

**5e. `app/processes/[id]/page.tsx` (line 53)**

Same pattern — extract into `app/processes/[id]/process-charts.tsx`, dynamic import.

**Step: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. Recharts is now in separate chunks loaded on demand.

**Step: Commit**

```bash
git add -A
git commit -m "perf: dynamic import recharts on 5 pages

Recharts (~500KB) was loaded eagerly on every page. Now lazy-loaded
only when users visit chart-heavy pages (readiness, data-health,
metric detail, survey results, process detail)."
```

---

### Task 6: next/image Migration in Excellence Hub

**File:** `app/survey/respond/[token]/page.tsx` (line 460)

Current:

```tsx
<img src="/logo.png" alt="NIA" className="h-7 sm:h-8 w-auto" />
```

Replace with:

```tsx
import Image from 'next/image';
// ... at the usage site:
<Image src="/logo.png" alt="NIA" width={32} height={32} className="h-7 sm:h-8 w-auto" />;
```

Note: `width` and `height` are required by `next/image` for layout calculation. The CSS classes still control visual size. Use the logo's actual dimensions or reasonable values.

**Step: Verify build passes**

Run: `npm run build`

**Step: Commit**

```bash
git add app/survey/respond/\[token\]/page.tsx
git commit -m "perf: migrate bare img to next/image on survey respond page"
```

---

### Task 7: Preconnect Hint in Excellence Hub

**File:** `app/layout.tsx`

Add inside `<head>`, before the theme script:

```tsx
<link rel="preconnect" href="https://nkrpahbykvzfnqbyceag.supabase.co" />
```

This tells the browser to start the TCP+TLS handshake with Supabase early, before any JavaScript runs that needs it.

**Step: Commit**

```bash
git add app/layout.tsx
git commit -m "perf: add preconnect hint for Supabase"
```

---

### Task 8: Font Verification in Excellence Hub

**File:** `app/layout.tsx`

Check that `next/font/google` config includes:

- `subsets: ['latin']` — already present on all 3 fonts
- `display: 'swap'` — `next/font` defaults to `swap` when not specified, so this is already correct

Check `app/globals.css` or Tailwind config to verify the CSS variables are actually used in `font-family` declarations. If DM Serif Display is only used in a few places, verify it's referenced (otherwise it's dead weight).

**Action:** If all fonts are used and config is correct, no changes needed. Note findings.

---

### Task 9: Image Compression in Excellence Hub

**File:** `public/logo.png` — currently 174KB

**Step 1: Check image dimensions**

```bash
file ~/projects/nia-results-tracker/public/logo.png
# or use: sips -g pixelWidth -g pixelHeight ~/projects/nia-results-tracker/public/logo.png
```

**Step 2: Compress if oversized**

If the image is larger than needed (e.g., 1000px+ for a logo displayed at 40px), resize and compress:

```bash
npx sharp-cli -i ~/projects/nia-results-tracker/public/logo.png -o ~/projects/nia-results-tracker/public/logo.png -- resize 200 200 --fit inside --withoutEnlargement
```

Or use `sips` (built into macOS):

```bash
sips --resampleWidth 200 ~/projects/nia-results-tracker/public/logo.png
```

Target: Logo under 20KB while maintaining visual quality at 2x display density.

**Step 3: Verify logo still looks correct**

Run dev server: `npm run dev` and check login page and sidebar visually.

**Step 4: Commit**

```bash
git add public/logo.png
git commit -m "perf: compress logo.png from 174KB"
```

---

### Task 10: Clean Up Unused Public Assets in Excellence Hub

**Files to check:** `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`

These are Next.js scaffold defaults. Search the codebase for references:

```bash
grep -r "file.svg\|globe.svg\|next.svg\|vercel.svg\|window.svg" app/ components/ lib/ --include="*.tsx" --include="*.ts"
```

If no references found, delete them. They add no value and clutter the public directory.

**Step: Commit if any deleted**

```bash
git add -A
git commit -m "chore: remove unused scaffold SVGs from public/"
```

---

### Task 11: Run Post-Fix Lighthouse on Excellence Hub

**Step 1: Push branch and wait for Vercel preview deploy**

```bash
git push -u origin jon/performance-pass
```

Wait for Vercel preview URL.

**Step 2: Run Lighthouse on preview URL**

```bash
lighthouse <preview-url>/login --output=json --output-path=~/lighthouse-hub-after.json --chrome-flags="--headless"
```

**Step 3: Run bundle analysis**

```bash
ANALYZE=true npm run build
```

**Step 4: Compare before/after metrics**

Record deltas in PR description.

**Step 5: Create PR**

```bash
gh pr create --title "perf: performance optimization pass" --body "$(cat <<'EOF'
## Summary
- Dynamic import recharts on 5 pages (~500KB deferred)
- Migrate bare `<img>` to `next/image` on survey respond page
- Add Supabase preconnect hint
- Compress logo.png
- Remove unused scaffold SVGs

## Before/After Lighthouse (login page)
| Metric | Before | After |
|--------|--------|-------|
| Performance | TBD | TBD |
| LCP | TBD | TBD |
| CLS | TBD | TBD |

## Test plan
- [ ] Build passes
- [ ] Login page loads correctly
- [ ] Charts still render on readiness, data-health, metric, survey results, process pages
- [ ] Logo displays correctly in sidebar and survey respond page


🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase 3: Fix — Resolve

**Repo:** `~/projects/resolve/`
**Branch:** `jon/performance-pass`

### Task 12: Dynamic Import Recharts in Resolve

**File:** `app/dispatcher/reports/page.tsx` (lines 4-13)

Same pattern as Hub — extract chart JSX into `app/dispatcher/reports/reports-charts.tsx`, use `next/dynamic`.

**Step: Commit**

```bash
git add -A
git commit -m "perf: dynamic import recharts on reports page"
```

---

### Task 13: next/image Migration in Resolve (3 files)

**13a. `components/Header.tsx` (line 16)**

Current: `<img src="/logo.png" className="h-8 w-auto" alt="NIA" />`
Replace with:

```tsx
import Image from 'next/image';
// ...
<Image src="/logo.png" width={32} height={32} className="h-8 w-auto" alt="NIA" />;
```

**13b. `components/AppSidebar.tsx` (line 72)**

Current: `<img src="/logo.png" className="h-8 w-auto" alt="NIA" />`
Replace with same pattern.

**13c. `app/login/page.tsx` (line 23)**

Current: `<img src="/logo.png" className="h-10 w-auto" alt="NIA" />`
Replace with:

```tsx
<Image src="/logo.png" width={40} height={40} className="h-10 w-auto" alt="NIA" />
```

**Step: Verify build passes**

Run: `npm run build`

**Step: Commit**

```bash
git add components/Header.tsx components/AppSidebar.tsx app/login/page.tsx
git commit -m "perf: migrate 3 bare img tags to next/image"
```

---

### Task 14: Preconnect Hint in Resolve

**File:** `app/layout.tsx`

Add inside `<head>`:

```tsx
<link rel="preconnect" href="https://ascesyhvgcdyxaqpghgv.supabase.co" />
```

**Step: Commit**

```bash
git add app/layout.tsx
git commit -m "perf: add preconnect hint for Supabase"
```

---

### Task 15: Image Compression + Cleanup in Resolve

**Logo:** `public/logo.png` — 174KB (same as Hub, likely same file)

Compress using same technique as Task 9.

**Unused SVGs:** Check and delete `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` if unreferenced.

**Step: Commit**

```bash
git add -A
git commit -m "perf: compress logo.png, remove unused scaffold SVGs"
```

---

### Task 16: Resolve PR

Push, run Lighthouse before/after, create PR with metrics. Same pattern as Task 11.

---

## Phase 4: Fix — Tempo

**Repo:** `~/Tempo/`
**Branch:** `jon/performance-pass`

### Task 17: next/image Migration in Tempo (2 files)

**17a. `src/components/sidebar.tsx` (line 389)**

Current: `<img src="/logo.png" alt="Tempo" className="w-7 h-7 rounded-lg flex-shrink-0" />`
Replace with:

```tsx
import Image from 'next/image';
// ...
<Image
  src="/logo.png"
  alt="Tempo"
  width={28}
  height={28}
  className="w-7 h-7 rounded-lg flex-shrink-0"
/>;
```

**17b. `src/app/login/page.tsx` (line 33)**

Current: `<img src="/logo.png" alt="Tempo" className="w-16 h-16 rounded-2xl mx-auto mb-4" />`
Replace with:

```tsx
<Image
  src="/logo.png"
  alt="Tempo"
  width={64}
  height={64}
  className="w-16 h-16 rounded-2xl mx-auto mb-4"
/>
```

**Step: Verify build passes**

Run: `npm run build`

**Step: Commit**

```bash
git add src/components/sidebar.tsx src/app/login/page.tsx
git commit -m "perf: migrate 2 bare img tags to next/image"
```

---

### Task 18: Preconnect Hint in Tempo

**File:** `src/app/layout.tsx`

Add inside `<head>`:

```tsx
<link rel="preconnect" href="https://qasaxyosffgcbzqnxmxw.supabase.co" />
```

**Step: Commit**

```bash
git add src/app/layout.tsx
git commit -m "perf: add preconnect hint for Supabase"
```

---

### Task 19: Investigate Webpack Flag in Tempo

**File:** `package.json` — `"build": "next build --webpack"`

**Step 1: Try building without the flag**

```bash
# Temporarily change build script
npm pkg set scripts.build="next build"
npm run build
```

**Step 2: If build succeeds**, keep the change. Turbopack is faster.

**Step 3: If build fails**, revert and note the error. The flag stays.

```bash
# Revert if needed
npm pkg set scripts.build="next build --webpack"
```

**Step: Commit if changed**

```bash
git add package.json
git commit -m "perf: remove --webpack flag, use Turbopack for faster builds"
```

---

### Task 20: Image Compression + Cleanup in Tempo

**Logo:** `public/logo.png` — 34KB (already reasonable, but check dimensions)

**Unused SVGs:** Check and delete scaffold defaults if unreferenced.

**Step: Commit if changes made**

---

### Task 21: Tempo PR

Push, Lighthouse before/after, create PR.

---

## Phase 5: Fix — Tick

**Repo:** `~/projects/nia-time-billing/`
**Branch:** `jon/performance-pass`

### Task 22: next/image Migration in Tick (1 file)

**File:** `app/sub-portal/page.tsx` (line 328)

Current: `<img src="/logo.png" alt="Tick" className="w-7 h-7 rounded-lg" />`
Replace with:

```tsx
import Image from 'next/image';
// ...
<Image src="/logo.png" alt="Tick" width={28} height={28} className="w-7 h-7 rounded-lg" />;
```

Note: This file may already import `Image` from `next/image` elsewhere. Check first — if it does, just change the tag.

**Step: Commit**

```bash
git add app/sub-portal/page.tsx
git commit -m "perf: migrate bare img to next/image on sub portal"
```

---

### Task 23: Preconnect Hint in Tick

**File:** `app/layout.tsx`

Add inside `<head>`:

```tsx
<link rel="preconnect" href="https://wjunuszutieidtvxsupq.supabase.co" />
```

**Step: Commit**

```bash
git add app/layout.tsx
git commit -m "perf: add preconnect hint for Supabase"
```

---

### Task 24: Image Compression in Tick

**Logo:** `public/logo.png` — 56KB

Check dimensions and compress if oversized for display size.

**Step: Commit if compressed**

---

### Task 25: Tick PR

Push, Lighthouse before/after, create PR.

---

## Phase 6: Wrap-Up

### Task 26: Update Memory Files

Update `~/.claude/projects/-Users-jonmalone/memory/MEMORY.md`:

- Mark Performance pillar as COMPLETE in the Cross-App Polish Roadmap
- Add PR numbers and session number

Update individual app memory files with what changed.

### Task 27: Update Session Log

Add session entry to `~/.claude/projects/-Users-jonmalone/memory/session-log.md`
