# Manual Process Map Editor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the AI-only process map with an interactive manual editor — toolbar to place nodes, drag-to-connect, drag-to-reposition, inline popups for editing, with optional AI draft generation.

**Architecture:** The existing `ProcessFlowCanvas` component becomes the editor. A new `ProcessMapToolbar` component provides node-type buttons and actions. Inline popups (node edit, edge label) render as absolutely-positioned divs over the canvas. All state lives in the parent page component and flows down as props. Save writes to the existing `workflow.flow_data` JSONB column via the existing `/api/ai/apply` route.

**Tech Stack:** React Flow v12 (`@xyflow/react`), Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase JSONB.

---

### Task 1: Add x/y to Flow Types

**Files:**

- Modify: `lib/flow-types.ts:39-45`

**Step 1: Add position fields to ProcessMapNode**

In `lib/flow-types.ts`, add `x` and `y` to the `ProcessMapNode` interface:

```typescript
export interface ProcessMapNode {
  id: string;
  type: ProcessNodeType;
  label: string;
  responsible?: string;
  notes?: string;
  x?: number;
  y?: number;
}
```

**Step 2: Verify types compile**

Run: `cd ~/projects/nia-results-tracker && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/flow-types.ts
git commit -m "feat: add x/y position fields to ProcessMapNode type"
```

---

### Task 2: Update Layout to Respect Saved Positions

**Files:**

- Modify: `lib/flow-layout.ts:175-295` (the `calculateProcessLayout` function)

**Step 1: Modify calculateProcessLayout to use saved positions**

The function currently always runs BFS layout. Change it so that if a node has `x` and `y` values, those are used directly. Only nodes without positions get BFS-placed. Add an `autoLayout` parameter to force BFS on everything (for the Auto-Layout button).

At the top of `calculateProcessLayout`, change the signature:

```typescript
export function calculateProcessLayout(
  flowData: ProcessMapFlowData,
  forceAutoLayout = false
): { nodes: RFNode[]; edges: RFEdge[] } {
```

In the "Build React Flow nodes" section, replace the position lookup:

```typescript
  for (const node of flowData.nodes) {
    // Use saved position if available, otherwise fall back to BFS layout
    const bfsPos = posMap.get(node.id) ?? { x: 0, y: 0 };
    const hasSavedPos = !forceAutoLayout && node.x !== undefined && node.y !== undefined;
    const pos = hasSavedPos ? { x: node.x!, y: node.y! } : bfsPos;

    const isDecision = node.type === 'decision';
    // ... rest unchanged
```

**Step 2: Verify types compile**

Run: `cd ~/projects/nia-results-tracker && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/flow-layout.ts
git commit -m "feat: layout respects saved x/y positions, forceAutoLayout param"
```

---

### Task 3: Make Nodes Interactive — Draggable + Visible Handles

**Files:**

- Modify: `components/flow/process-nodes.tsx`

**Step 1: Add hover-visible handles**

Replace the `opacity: 0` style on all handles with a CSS class that shows them on hover. Add this shared style constant at the top of the file (after `NODE_COLORS`):

```typescript
const HANDLE_STYLE: React.CSSProperties = {
  width: 10,
  height: 10,
  background: '#55787c',
  border: '2px solid #ffffff',
  opacity: 0,
  transition: 'opacity 0.15s',
};

const HANDLE_HOVER_CLASS = '[&_.react-flow__handle]:!opacity-100';
```

Then on each node's outermost `<div>`, add `className={HANDLE_HOVER_CLASS}` alongside the existing style prop. Replace every `style={{ opacity: 0 }}` on Handle components with `style={HANDLE_STYLE}`.

For `DecisionNode`, also add an explicit `id="yes"` on the Bottom handle and keep `id="no"` on the Right handle (already done from earlier PR).

**Step 2: Verify types compile + visual check**

Run: `cd ~/projects/nia-results-tracker && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/flow/process-nodes.tsx
git commit -m "feat: show node handles on hover for interactive connecting"
```

---

### Task 4: Build the Toolbar Component

**Files:**

- Create: `components/flow/process-map-toolbar.tsx`

**Step 1: Create the toolbar component**

```typescript
'use client';

import type { ProcessNodeType } from '@/lib/flow-types';

const NODE_BUTTONS: { type: ProcessNodeType; label: string; icon: string }[] = [
  { type: 'start', label: 'Start', icon: '▶' },
  { type: 'step', label: 'Step', icon: '■' },
  { type: 'decision', label: 'Decision', icon: '◆' },
  { type: 'input', label: 'Input', icon: '↓' },
  { type: 'output', label: 'Output', icon: '↑' },
  { type: 'end', label: 'End', icon: '⏹' },
];

interface ProcessMapToolbarProps {
  activeNodeType: ProcessNodeType | null;
  onNodeTypeSelect: (type: ProcessNodeType | null) => void;
  onSave: () => void;
  onAutoLayout: () => void;
  onGenerateFromCharter: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  isGenerating: boolean;
}

export default function ProcessMapToolbar({
  activeNodeType,
  onNodeTypeSelect,
  onSave,
  onAutoLayout,
  onGenerateFromCharter,
  isSaving,
  hasUnsavedChanges,
  isGenerating,
}: ProcessMapToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-2 bg-card border border-border rounded-lg shadow-sm mb-2 flex-wrap">
      {/* Node type buttons */}
      <div className="flex items-center gap-1 border-r border-border pr-2 mr-1">
        {NODE_BUTTONS.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => onNodeTypeSelect(activeNodeType === type ? null : type)}
            title={`Add ${label} node`}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeNodeType === type
                ? 'bg-nia-green/20 text-nia-green border border-nia-green/40'
                : 'text-text-secondary hover:bg-surface-hover border border-transparent'
            }`}
          >
            <span className="mr-1">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onAutoLayout}
          title="Auto-arrange nodes"
          className="px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover rounded-md transition-colors border border-transparent"
        >
          Auto-Layout
        </button>

        <button
          onClick={onGenerateFromCharter}
          disabled={isGenerating}
          title="Generate a draft process map from the charter"
          className="px-2.5 py-1.5 text-xs font-medium text-nia-grey-blue hover:bg-nia-grey-blue/10 rounded-md transition-colors border border-transparent disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate from Charter'}
        </button>

        <button
          onClick={onSave}
          disabled={isSaving || !hasUnsavedChanges}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            hasUnsavedChanges
              ? 'bg-nia-green text-white hover:bg-nia-green/90'
              : 'bg-surface-hover text-text-muted'
          } disabled:opacity-50`}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify types compile**

Run: `cd ~/projects/nia-results-tracker && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/flow/process-map-toolbar.tsx
git commit -m "feat: add ProcessMapToolbar component for manual map editing"
```

---

### Task 5: Build Inline Popup Components (Node Edit + Edge Label)

**Files:**

- Create: `components/flow/node-edit-popup.tsx`
- Create: `components/flow/edge-label-popup.tsx`

**Step 1: Create NodeEditPopup**

This popup renders absolutely positioned above a node when double-clicked.

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';

interface NodeEditPopupProps {
  nodeId: string;
  label: string;
  responsible?: string;
  showResponsible: boolean; // true for step nodes only
  position: { x: number; y: number }; // screen coordinates
  onSave: (nodeId: string, label: string, responsible?: string) => void;
  onCancel: () => void;
}

export default function NodeEditPopup({
  nodeId,
  label: initialLabel,
  responsible: initialResponsible,
  showResponsible,
  position,
  onSave,
  onCancel,
}: NodeEditPopupProps) {
  const [label, setLabel] = useState(initialLabel);
  const [responsible, setResponsible] = useState(initialResponsible ?? '');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Click outside to cancel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  const handleSubmit = () => {
    if (!label.trim()) return;
    onSave(nodeId, label.trim(), showResponsible ? responsible.trim() || undefined : undefined);
  };

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-card border border-border rounded-lg shadow-xl p-3 min-w-[220px]"
      style={{ left: position.x, top: position.y - 10, transform: 'translate(-50%, -100%)' }}
    >
      <div className="space-y-2">
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Label"
          className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
        />
        {showResponsible && (
          <input
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Owner (optional)"
            className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background text-foreground"
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-2.5 py-1 text-xs text-text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-2.5 py-1 text-xs font-semibold bg-nia-green text-white rounded-md hover:bg-nia-green/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create EdgeLabelPopup**

This popup appears at the midpoint of an edge — for decision edges it shows Yes/No radios, for others a free-text input.

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';

interface EdgeLabelPopupProps {
  edgeId: string;
  currentLabel?: string;
  isDecisionEdge: boolean;
  position: { x: number; y: number };
  onSave: (edgeId: string, label: string) => void;
  onCancel: () => void;
}

export default function EdgeLabelPopup({
  edgeId,
  currentLabel,
  isDecisionEdge,
  position,
  onSave,
  onCancel,
}: EdgeLabelPopupProps) {
  const [label, setLabel] = useState(currentLabel ?? '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-card border border-border rounded-lg shadow-xl p-2.5"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, -50%)' }}
    >
      {isDecisionEdge ? (
        <div className="flex gap-2">
          <button
            onClick={() => onSave(edgeId, 'Yes')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              currentLabel === 'Yes'
                ? 'bg-nia-green text-white'
                : 'border border-border text-text-secondary hover:bg-surface-hover'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => onSave(edgeId, 'No')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              currentLabel === 'No'
                ? 'bg-nia-red text-white'
                : 'border border-border text-text-secondary hover:bg-surface-hover'
            }`}
          >
            No
          </button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave(edgeId, label.trim());
              if (e.key === 'Escape') onCancel();
            }}
            placeholder="Label (optional)"
            className="px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground w-36"
          />
          <button
            onClick={() => onSave(edgeId, label.trim())}
            className="px-2 py-1 text-xs font-semibold bg-nia-green text-white rounded-md"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Verify types compile**

Run: `cd ~/projects/nia-results-tracker && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add components/flow/node-edit-popup.tsx components/flow/edge-label-popup.tsx
git commit -m "feat: add inline popup components for node editing and edge labeling"
```

---

### Task 6: Rewrite ProcessFlowCanvas as Interactive Editor

**Files:**

- Modify: `components/flow/process-flow-canvas.tsx` (complete rewrite)

This is the largest task. The canvas component goes from read-only to fully interactive.

**Step 1: Rewrite ProcessFlowCanvas**

Replace the entire file content. Key changes:

- Enable `nodesDraggable`, `nodesConnectable`, `elementsSelectable`
- Use `useNodesState` and `useEdgesState` for interactive state (needed for drag/connect)
- Sync state when `flowData` prop changes (via `useEffect`)
- `onConnect` handler: creates new edge, shows EdgeLabelPopup if source is decision
- `onPaneClick` handler: places new node if toolbar has active type selected
- `onNodeDoubleClick`: shows NodeEditPopup
- `onEdgeClick`: shows EdgeLabelPopup for editing
- `onNodesDelete` / `onEdgesDelete`: handle deletion (prevent Start node delete)
- Track `hasUnsavedChanges` via a dirty flag
- `onNodeDragStop`: mark dirty
- Expose `onSave(flowData)` callback to parent
- `onAutoLayout`: calls `calculateProcessLayout(flowData, true)`, resets positions
- Keyboard: Delete/Backspace removes selected nodes/edges

The full code for this rewrite is too long to inline here. Key structure:

```typescript
'use client';

import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import { PROCESS_NODE_TYPES } from './process-nodes';
import { calculateProcessLayout } from '@/lib/flow-layout';
import ProcessMapToolbar from './process-map-toolbar';
import NodeEditPopup from './node-edit-popup';
import EdgeLabelPopup from './edge-label-popup';
import type { ProcessMapFlowData, ProcessNodeType } from '@/lib/flow-types';

interface ProcessFlowCanvasProps {
  flowData: ProcessMapFlowData | null;
  height?: number;
  onSave: (data: ProcessMapFlowData) => Promise<void>;
  onGenerateFromCharter: () => void;
  isGenerating?: boolean;
  charter?: unknown;
}

// ... component implementation with all handlers
```

Important implementation details:

- **ID generation**: Use a counter ref. `const nextId = useRef(1)`. On load, scan existing node/edge IDs to set counter above max. New nodes get `s${nextId.current++}`, `d${nextId.current++}`, etc.
- **flowDataToState**: A helper that converts `ProcessMapFlowData` → React Flow nodes/edges (using `calculateProcessLayout` for nodes without x/y, direct positioning for those with x/y).
- **stateToFlowData**: A helper that converts React Flow nodes/edges back → `ProcessMapFlowData` (extracting x/y from node positions).
- **Dirty tracking**: `hasUnsavedChanges` state, set to `true` on any add/delete/edit/drag, set to `false` after save.
- **Sync on prop change**: `useEffect` watching `flowData` to reset state (for when AI generates a draft).

**Step 2: Verify types compile**

Run: `cd ~/projects/nia-results-tracker && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/flow/process-flow-canvas.tsx
git commit -m "feat: rewrite ProcessFlowCanvas as interactive editor with toolbar and popups"
```

---

### Task 7: Wire Up the Process Page — Save, Load, Unsaved Warning

**Files:**

- Modify: `app/processes/[id]/page.tsx`

**Step 1: Update ProcessFlowCanvas usage**

In the process page, update the Process Map tab section:

1. **Remove** the entire inline map chat section (lines ~2434-2620 — the `showMapChat`, `mapChatMessages`, `mapChatInput`, `mapChatLoading`, `mapChatEndRef`, `sendMapChat` state and the corresponding JSX).

2. **Remove** the related state variables at the top: `showMapChat`, `mapChatMessages`, `mapChatInput`, `mapChatLoading`, `mapChatEndRef`, `mapDiagramUpdatedIndicator`.

3. **Add** a save handler:

```typescript
const saveFlowData = useCallback(
  async (data: ProcessMapFlowData) => {
    if (!process) return;
    await fetch('/api/ai/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        processId: process.id,
        field: 'workflow',
        content: data,
        suggestionTitle: 'Manual process map edit',
      }),
    });
    // Update local state so the page reflects the save
    setProcess((prev) =>
      prev
        ? {
            ...prev,
            workflow: { ...(prev.workflow || {}), flow_data: data } as Workflow,
          }
        : prev
    );
  },
  [process]
);
```

4. **Add** a generate-from-charter handler:

```typescript
const [isGeneratingMap, setIsGeneratingMap] = useState(false);

const generateMapFromCharter = useCallback(async () => {
  if (!process) return;
  setIsGeneratingMap(true);
  try {
    const res = await fetch('/api/ai/map-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content:
              'Generate a process map from scratch based on the current charter and ADLI content.',
          },
        ],
        flowData: null,
        processId: process.id,
        processName: process.name,
        charter: process.charter,
      }),
    });
    if (!res.ok || !res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullContent += decoder.decode(value, { stream: true });
    }
    const DELIM = '---DIAGRAM---';
    const delimIdx = fullContent.indexOf(DELIM);
    if (delimIdx !== -1) {
      const jsonPart = fullContent.slice(delimIdx + DELIM.length).trim();
      const newFlowData = JSON.parse(jsonPart) as ProcessMapFlowData;
      setLocalFlowData(newFlowData);
    }
  } finally {
    setIsGeneratingMap(false);
  }
}, [process]);
```

5. **Update** the JSX for the process-map tab:

```tsx
<div id="section-workflow" className={activeTab !== 'process-map' ? 'hidden' : ''}>
  <ProcessFlowCanvas
    flowData={localFlowData}
    height={600}
    onSave={saveFlowData}
    onGenerateFromCharter={generateMapFromCharter}
    isGenerating={isGeneratingMap}
    charter={process.charter}
  />
</div>
```

6. **Add** `beforeunload` warning. This will be handled inside `ProcessFlowCanvas` since it owns the dirty state.

**Step 2: Verify types compile and build**

Run: `cd ~/projects/nia-results-tracker && npx tsc --noEmit && npx next build`
Expected: No errors

**Step 3: Commit**

```bash
git add app/processes/[id]/page.tsx
git commit -m "feat: wire manual process map editor into process page, remove inline AI chat"
```

---

### Task 8: Integration Testing + Polish

**Step 1: Manual testing checklist**

Open a process page in the browser and test:

- [ ] Toolbar renders with 6 node buttons + Save + Auto-Layout + Generate from Charter
- [ ] Click "Step" in toolbar, click canvas — step node appears
- [ ] Click "Decision" in toolbar, click canvas — diamond appears
- [ ] Drag a node — it moves
- [ ] Drag from bottom handle of one node to top handle of another — edge appears
- [ ] Connect from a decision node — Yes/No popup appears
- [ ] Double-click a node — edit popup appears, can change label
- [ ] Select node + Delete key — node removed (with its edges)
- [ ] Try to delete Start node — toast warning
- [ ] Click Save — saves to DB, reloading page shows same positions
- [ ] Click Auto-Layout — nodes rearrange neatly
- [ ] Click Generate from Charter — AI generates map, appears on canvas
- [ ] Navigate away with unsaved changes — browser warns

**Step 2: Fix any issues found during testing**

**Step 3: Final commit**

```bash
git add -A
git commit -m "fix: polish manual process map editor from integration testing"
```

---

### Task 9: Create PR

**Step 1: Push and create PR**

```bash
git push -u origin jon/process-map-editor
gh pr create --title "Manual process map editor" --body "..."
```

Include a test plan matching the checklist from Task 8.
