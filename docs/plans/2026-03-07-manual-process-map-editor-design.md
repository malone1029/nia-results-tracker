# Manual Process Map Editor — Design

**Date:** 2026-03-07
**Status:** Approved

## Goal

Replace the AI-generated-only process map with an interactive manual editor. Users build, connect, position, and edit flowchart nodes directly on the canvas. An optional "Generate from Charter" button provides an AI-drafted starting point.

## Design Decisions

| Question             | Decision                                               |
| -------------------- | ------------------------------------------------------ |
| Editing model        | Toolbar + Canvas + Inline Popups (Approach 3)          |
| Positioning          | Fully draggable — positions saved to DB                |
| Decision edge labels | Immediate Yes/No radio popup on connect                |
| AI role              | Optional "Generate from Charter" draft, not the editor |
| Auto-layout          | Available as one-time rearrange button                 |

## Canvas & Toolbar

A floating toolbar above the canvas with node type buttons:

| Button   | Node Type | Shape                |
| -------- | --------- | -------------------- |
| Start    | start     | Green pill           |
| Step     | step      | Teal rectangle       |
| Decision | decision  | Amber diamond        |
| Input    | input     | Blue parallelogram   |
| Output   | output    | Purple parallelogram |
| End      | end       | Red pill             |

Additional toolbar buttons: **Save**, **Auto-Layout**, **Generate from Charter**.

### Placing Nodes

1. Click a toolbar button (highlights as active)
2. Click anywhere on the canvas — node appears at click position
3. Toolbar deselects after placement (one node per click)

All nodes are draggable. Positions persist exactly where dropped.

## Connecting Nodes

- Nodes show circular handles on hover: top (target), bottom (source)
- Decision diamonds also show a right-side handle (for "No" path)
- Drag from a source handle to a target handle to create a connection
- Arrow appears on the edge

### Decision Edge Labels

When connecting FROM a decision node, a popup appears at the edge midpoint:

```
[ Yes ]  [ No ]
```

Click one to label the edge. Popup disappears.

### Editing Edge Labels

- Click any edge label to re-edit (same popup)
- Click an edge line to add a label to non-decision edges
- Select an edge + Backspace to delete it

## Editing & Deleting Nodes

### Double-Click to Edit

Double-click a node to open an inline popup above it:

- **Step nodes:** Label + Owner fields
- **Decision/Start/End/Input/Output:** Label field only
- Save button or Enter to apply, Cancel or click-away to dismiss

### Deleting Nodes

- Click to select (blue border) + Backspace/Delete
- Removes all connected edges automatically
- Start node cannot be deleted (toast warning)

## Saving & Loading

### Save

- Toolbar "Save" button persists to `workflow` column on `processes` table
- Flow data JSON structure: `{nodes: [...], edges: [...]}`
- Node objects gain `x` and `y` fields for position persistence
- Green toast: "Process map saved"
- Browser `beforeunload` prompt on navigate-away with unsaved changes

### Load Behavior

| Scenario                                   | Behavior                                   |
| ------------------------------------------ | ------------------------------------------ |
| Saved data with x/y positions              | Render at exact saved positions            |
| Saved data without positions (old AI maps) | Run auto-layout once, then editable        |
| No flow data                               | Empty canvas with Start node at top center |

### Auto-Layout Button

Runs BFS layout as a one-time rearrange. Does not lock positions — drag freely after.

### Generate from Charter

Sends to `/api/ai/map-chat` with a generation prompt. Returned flow data populates canvas for manual editing. AI is a starting point, not the ongoing editor.

## What Changes

- **Removed:** Inline "Chat to edit this map" section below canvas
- **Kept:** All 6 node components, flow data JSON structure, dark mode, main AI side panel
- **Modified:** `ProcessFlowCanvas` becomes interactive; `ProcessMapNode` type gains x/y fields

## Data Model Changes

```typescript
// Added to ProcessMapNode
interface ProcessMapNode {
  id: string;
  type: ProcessNodeType;
  label: string;
  responsible?: string;
  notes?: string;
  x?: number; // NEW — canvas x position
  y?: number; // NEW — canvas y position
}
```

No database migration needed — `workflow` is a JSONB column. The x/y fields are just new keys in the JSON.

## Files Affected

| File                                      | Change                                                   |
| ----------------------------------------- | -------------------------------------------------------- |
| `components/flow/process-flow-canvas.tsx` | Enable interactivity, add toolbar, add popups, save/load |
| `components/flow/process-nodes.tsx`       | Make handles visible on hover                            |
| `lib/flow-layout.ts`                      | Respect saved x/y positions, auto-layout as fallback     |
| `lib/flow-types.ts`                       | Add x/y to ProcessMapNode                                |
| `app/processes/[id]/page.tsx`             | Remove inline map chat, wire save/load, unsaved warning  |
| `app/api/ai/map-chat/route.ts`            | Keep for "Generate from Charter" only                    |
