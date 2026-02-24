# Asana-Style Search Design

**Date:** 2026-02-24
**File:** `components/global-search.tsx`
**Status:** Approved

## Problem

Search results truncated at 3–5 items with no way to filter by type or see which part of the name matched the query. MDS/BSS metric names all look identical in the first ~40 characters.

## Solution

Four improvements modelled on Asana's search UX, all in a single component file.

### 1. Category filter tabs
Pill buttons inside the dropdown above results: `All · Processes (N) · Metrics (N) · Requirements (N)`.
- Tabs with zero results hidden
- Active tab highlighted in `nia-orange`
- Clicking a tab filters visible results; keyboard nav respects filter
- Tabs reset to "All" when query changes

### 2. Show more / collapse
- Each group shows 3 results by default
- "Show N more metrics" text link expands that group inline (no re-fetch — 8 results already loaded)
- Groups collapse when query changes

### 3. Bold highlight of matched text
- `highlightMatch(text, query)` helper splits title at matched substring
- Match wrapped in `<span className="font-semibold text-nia-orange">`
- Case-insensitive, no external library

### 4. Clear (×) button on input
- Appears when query is non-empty
- Clears query, closes dropdown, returns focus to input

## Non-goals
- No separate `/search` page
- No server-side highlighting
- No fuzzy/full-text search (ILIKE is sufficient)
