# Cross-App Performance Pillar — Design

**Date:** 2026-03-01
**Scope:** All 4 NIA apps (Excellence Hub, Resolve, Tempo, Tick)
**Approach:** Audit first, then fix app-by-app in priority order

## Context

This is the 4th and final pillar of the Cross-App Polish Roadmap:

1. ~~Accessibility (WCAG 2.1 AA)~~ — Complete
2. ~~Design System (semantic tokens)~~ — Complete
3. ~~Responsive (mobile-first)~~ — Complete
4. **Performance** — This design

## Phase 1: Audit

### Bundle Analysis

- Install `@next/bundle-analyzer` as devDependency on all 4 apps
- Run `ANALYZE=true npm run build` to generate visual bundle maps
- Identify oversized chunks and client-side dependencies that should be server-only or lazy-loaded

### Lighthouse Baseline

- Run Lighthouse CLI against each deployed app's key pages (login, dashboard, main feature)
- Record: Performance score, LCP, CLS, INP, FCP, TTFB
- Save results as baseline for before/after comparison

## Phase 2: Fixes (by priority)

### 1. Dynamic Imports for Heavy Libraries (High Impact)

**Problem:** Recharts (~500KB) loads immediately on all pages, even when charts aren't visible.
**Fix:** Wrap chart components in `next/dynamic(() => import(...), { ssr: false })`.
**Apps:**

- Excellence Hub: `readiness/page.tsx`, `data-health/page.tsx`, `metric/[id]/page.tsx`, `surveys/[id]/results/page.tsx`
- Resolve: `dispatcher/reports/page.tsx`

### 2. next/image Migration (Medium Impact)

**Problem:** Bare `<img>` tags don't get automatic WebP conversion, lazy loading, or proper width/height (causes CLS).
**Fix:** Replace `<img>` with Next.js `<Image>` component. Add `images` config to `next.config.ts` where missing.
**Apps:**

- Resolve: `Header.tsx`, `login/page.tsx`, `AppSidebar.tsx` (3 files)
- Tempo: `sidebar.tsx`, `login/page.tsx` (2 files)
- Tick: `sub-portal/page.tsx` (1 file)

### 3. Preconnect Hints (Low-Medium Impact)

**Problem:** No preconnect hints for Supabase auth endpoints used client-side during login.
**Fix:** Add `<link rel="preconnect" href="https://{project-ref}.supabase.co">` to root layout.
**Apps:** All 4

### 4. Font Optimization (Low-Medium Impact)

**Problem:** Potential font flash (FOUT) if `next/font` isn't configured with proper `display` and `subsets`.
**Fix:** Verify `next/font/google` config, ensure `display: 'swap'`, check for unused font weights.
**Apps:** All 4

### 5. Image Compression (Low Impact)

**Problem:** Logo PNGs in `/public` may not be optimally compressed.
**Fix:** Run through compression tools (squoosh/sharp), consider SVG where appropriate.
**Apps:** All 4

### 6. Tempo Webpack Flag (DX Impact)

**Problem:** Tempo's build uses `--webpack` flag, bypassing Turbopack.
**Fix:** Investigate if this is still needed. Test build without it.
**Apps:** Tempo only

## Deliverables

- 1 PR per app with all performance fixes
- Before/after Lighthouse scores in PR description
- Bundle analysis snapshots (before/after) saved in PR description
- Memory files updated with results

## Current State (Pre-Audit)

| Item              | Excellence Hub    | Resolve  | Tempo    | Tick           |
| ----------------- | ----------------- | -------- | -------- | -------------- |
| Next.js           | 16.1.6            | 16.1.6   | 16.1.6   | 16.1.6         |
| Uses next/image   | Yes (4 files)     | No       | No       | Yes (8+ files) |
| Bare `<img>` tags | None              | 3 (logo) | 2 (logo) | 1 (sub-portal) |
| Preconnect hints  | None              | None     | None     | None           |
| Bundle analyzer   | None              | None     | None     | None           |
| Heavy client deps | recharts, @xyflow | recharts | clean    | clean          |
