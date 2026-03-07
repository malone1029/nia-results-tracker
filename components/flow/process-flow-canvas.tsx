'use client';

// Interactive React Flow editor for individual process maps.
// Supports click-to-place nodes, drag, connect, double-click edit,
// edge label editing, delete, auto-layout, save, and AI generation.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
} from '@xyflow/react';

import { PROCESS_NODE_TYPES } from './process-nodes';
import { calculateProcessLayout } from '@/lib/flow-layout';
import ProcessMapToolbar from './process-map-toolbar';
import NodeEditPopup from './node-edit-popup';
import EdgeLabelPopup from './edge-label-popup';
import type { ProcessMapFlowData, ProcessNodeType } from '@/lib/flow-types';

// ── Module-level constants (NEVER define inside component body) ──────────────

const nodeTypes = PROCESS_NODE_TYPES;

// Node dimensions (must match flow-layout.ts)
const NODE_DIMS: Record<ProcessNodeType, { w: number; h: number }> = {
  start: { w: 140, h: 44 },
  end: { w: 140, h: 44 },
  step: { w: 180, h: 60 },
  decision: { w: 130, h: 130 },
  input: { w: 160, h: 50 },
  output: { w: 160, h: 50 },
};

// ID prefix per node type
const ID_PREFIX: Record<ProcessNodeType, string> = {
  start: 'start',
  end: 'end',
  step: 's',
  decision: 'd',
  input: 'in',
  output: 'out',
};

// Default edge styling
const EDGE_STYLE = { stroke: '#55787c', strokeWidth: 2 };
const EDGE_LABEL_STYLE = { fontSize: 11, fill: '#55787c', fontWeight: 600 };
const EDGE_LABEL_BG = { fill: '#ffffff', fillOpacity: 0.9 };

// ── Interfaces ───────────────────────────────────────────────────────────────

interface ProcessFlowCanvasProps {
  flowData: ProcessMapFlowData | null;
  height?: number;
  onSave: (data: ProcessMapFlowData) => Promise<void>;
  onGenerateFromCharter: () => void;
  isGenerating?: boolean;
}

interface NodeEditState {
  nodeId: string;
  label: string;
  responsible?: string;
  showResponsible: boolean;
  position: { x: number; y: number };
}

interface EdgeEditState {
  edgeId: string;
  currentLabel?: string;
  isDecisionEdge: boolean;
  position: { x: number; y: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert React Flow nodes/edges back to our ProcessMapFlowData for saving */
function stateToFlowData(nodes: Node[], edges: Edge[]): ProcessMapFlowData {
  return {
    nodes: nodes.map((n) => {
      // Strip the pm_ prefix: "pm_step" → "step"
      const rawType = (n.type ?? 'step').replace(/^pm_/, '') as ProcessNodeType;
      return {
        id: n.id,
        type: rawType,
        label: (n.data?.label as string) ?? '',
        responsible: (n.data?.responsible as string) || undefined,
        x: n.position.x,
        y: n.position.y,
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: (e.label as string) || undefined,
    })),
  };
}

/** Convert ProcessMapFlowData → React Flow nodes/edges via layout engine */
function flowDataToState(
  flowData: ProcessMapFlowData,
  isDark: boolean
): { nodes: Node[]; edges: Edge[] } {
  const layout = calculateProcessLayout(flowData);
  const nodes: Node[] = layout.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { ...n.data, isDark },
    style: n.style as Record<string, string | number> | undefined,
  }));
  const edges: Edge[] = layout.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: e.type,
    style: e.style as Record<string, string | number> | undefined,
    labelStyle: e.labelStyle as Record<string, string | number> | undefined,
    labelBgStyle: e.labelBgStyle as Record<string, string | number> | undefined,
    labelBgPadding: e.labelBgPadding,
    markerEnd: e.markerEnd,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
  }));
  return { nodes, edges };
}

/** Scan existing node IDs and return a counter map so new IDs don't collide */
function buildIdCounters(nodes: Node[]): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const node of nodes) {
    const id = node.id;
    for (const [type, prefix] of Object.entries(ID_PREFIX)) {
      // Match patterns like "s1", "d3", "start", "end1", "in2", "out4"
      if (type === 'start' && id === 'start') {
        counters[prefix] = Math.max(counters[prefix] ?? 0, 1);
      } else if (id.startsWith(prefix)) {
        const numPart = id.slice(prefix.length);
        const num = numPart === '' ? 1 : parseInt(numPart, 10);
        if (!isNaN(num)) {
          counters[prefix] = Math.max(counters[prefix] ?? 0, num);
        }
      }
    }
  }
  return counters;
}

// ── Default empty state: single Start node ───────────────────────────────────

const DEFAULT_FLOW_DATA: ProcessMapFlowData = {
  nodes: [{ id: 'start', type: 'start', label: 'Start', x: 400, y: 50 }],
  edges: [],
};

// ── Inner component (must be inside ReactFlowProvider) ───────────────────────

function ProcessFlowInner({
  flowData,
  height = 520,
  onSave,
  onGenerateFromCharter,
  isGenerating = false,
}: ProcessFlowCanvasProps) {
  const reactFlowInstance = useReactFlow();

  // ── Dark mode detection ──────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // ── React Flow interactive state ─────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // ── Editor state ─────────────────────────────────────────────────────────
  const [activeNodeType, setActiveNodeType] = useState<ProcessNodeType | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nodeEdit, setNodeEdit] = useState<NodeEditState | null>(null);
  const [edgeEdit, setEdgeEdit] = useState<EdgeEditState | null>(null);

  // ID counter ref — persists across renders, avoids collisions
  const idCounters = useRef<Record<string, number>>({});
  // Track the last flowData identity to detect prop changes
  const lastFlowDataRef = useRef<ProcessMapFlowData | null | undefined>(undefined);

  // ── Sync on prop change (initial load + AI generation) ───────────────────
  useEffect(() => {
    // Only re-init when the prop identity actually changes
    if (flowData === lastFlowDataRef.current) return;
    lastFlowDataRef.current = flowData;

    const data = flowData ?? DEFAULT_FLOW_DATA;
    const state = flowDataToState(data, isDark);
    setNodes(state.nodes);
    setEdges(state.edges);
    idCounters.current = buildIdCounters(state.nodes);
    setHasUnsavedChanges(false);
    setNodeEdit(null);
    setEdgeEdit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowData]);

  // ── Keep isDark in sync with node data ───────────────────────────────────
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isDark },
      }))
    );
  }, [isDark, setNodes]);

  // ── Beforeunload guard ───────────────────────────────────────────────────
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // ── Generate next ID for a node type ─────────────────────────────────────
  const nextId = useCallback((type: ProcessNodeType): string => {
    const prefix = ID_PREFIX[type];
    const current = idCounters.current[prefix] ?? 0;
    const next = current + 1;
    idCounters.current[prefix] = next;
    // "start" stays as "start" (first one), then "start2", etc.
    if (prefix === 'start' || prefix === 'end') {
      return next === 1 ? prefix : `${prefix}${next}`;
    }
    return `${prefix}${next}`;
  }, []);

  // ── Click-to-place nodes ─────────────────────────────────────────────────
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!activeNodeType) return;

      const dims = NODE_DIMS[activeNodeType];
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      // Center the node on the click position
      position.x -= dims.w / 2;
      position.y -= dims.h / 2;

      const id = nextId(activeNodeType);
      const defaultLabels: Record<ProcessNodeType, string> = {
        start: 'Start',
        end: 'End',
        step: 'New Step',
        decision: 'Condition?',
        input: 'Input',
        output: 'Output',
      };

      const newNode: Node = {
        id,
        type: `pm_${activeNodeType}`,
        position,
        data: { label: defaultLabels[activeNodeType], isDark },
        style: { width: dims.w, height: dims.h },
      };

      setNodes((nds) => [...nds, newNode]);
      setActiveNodeType(null);
      setHasUnsavedChanges(true);
    },
    [activeNodeType, isDark, nextId, reactFlowInstance, setNodes]
  );

  // ── Drag stop → mark dirty ──────────────────────────────────────────────
  const onNodeDragStop = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  // ── Connect nodes ────────────────────────────────────────────────────────
  // Pending edge waiting for decision label popup
  const pendingEdgeRef = useRef<Edge | null>(null);

  const onConnect = useCallback(
    (connection: Connection) => {
      const edgeId = `e_${connection.source}_${connection.target}_${Date.now()}`;
      const newEdge: Edge = {
        id: edgeId,
        source: connection.source,
        target: connection.target,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
        style: EDGE_STYLE,
        labelStyle: EDGE_LABEL_STYLE,
        labelBgStyle: EDGE_LABEL_BG,
        labelBgPadding: [4, 2] as [number, number],
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      };

      setEdges((eds) => addEdge(newEdge, eds));
      setHasUnsavedChanges(true);

      // Check if source is a decision node — show label popup immediately
      const sourceNode = nodes.find((n) => n.id === connection.source);
      if (sourceNode?.type === 'pm_decision') {
        pendingEdgeRef.current = newEdge;
        // Position popup at the midpoint of the viewport
        const sourceScreen = reactFlowInstance.flowToScreenPosition(sourceNode.position);
        setEdgeEdit({
          edgeId,
          currentLabel: undefined,
          isDecisionEdge: true,
          position: {
            x: sourceScreen.x + NODE_DIMS.decision.w / 2,
            y: sourceScreen.y + NODE_DIMS.decision.h + 20,
          },
        });
      }
    },
    [nodes, reactFlowInstance, setEdges]
  );

  // ── Double-click node → edit popup ───────────────────────────────────────
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const rawType = (node.type ?? '').replace(/^pm_/, '');
      const dims = NODE_DIMS[rawType as ProcessNodeType] ?? NODE_DIMS.step;
      const screenPos = reactFlowInstance.flowToScreenPosition(node.position);

      setNodeEdit({
        nodeId: node.id,
        label: (node.data?.label as string) ?? '',
        responsible: (node.data?.responsible as string) || undefined,
        showResponsible: rawType === 'step',
        position: {
          x: screenPos.x + dims.w / 2,
          y: screenPos.y,
        },
      });
    },
    [reactFlowInstance]
  );

  // ── Node edit save ───────────────────────────────────────────────────────
  const onNodeEditSave = useCallback(
    (nodeId: string, label: string, responsible?: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label, responsible } } : n))
      );
      setNodeEdit(null);
      setHasUnsavedChanges(true);
    },
    [setNodes]
  );

  // ── Click edge → edit label popup ────────────────────────────────────────
  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const isDecision = sourceNode?.type === 'pm_decision';

      setEdgeEdit({
        edgeId: edge.id,
        currentLabel: (edge.label as string) || undefined,
        isDecisionEdge: isDecision,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [nodes]
  );

  // ── Edge label save ──────────────────────────────────────────────────────
  const onEdgeLabelSave = useCallback(
    (edgeId: string, label: string) => {
      setEdges((eds) =>
        eds.map((e) => (e.id === edgeId ? { ...e, label: label || undefined } : e))
      );
      setEdgeEdit(null);
      pendingEdgeRef.current = null;
      setHasUnsavedChanges(true);
    },
    [setEdges]
  );

  const onEdgeLabelCancel = useCallback(() => {
    setEdgeEdit(null);
    pendingEdgeRef.current = null;
  }, []);

  // ── Delete handling ──────────────────────────────────────────────────────
  // Prevent deleting the start node
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const filtered = changes.filter((change) => {
        if (change.type === 'remove') {
          // Block deletion of the start node
          return change.id !== 'start';
        }
        return true;
      });

      // Track if any deletes happened
      const hasDelete = filtered.some((c) => c.type === 'remove');
      if (hasDelete) {
        setHasUnsavedChanges(true);
      }

      onNodesChange(filtered);
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      const hasDelete = changes.some((c) => c.type === 'remove');
      if (hasDelete) {
        setHasUnsavedChanges(true);
      }
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const data = stateToFlowData(nodes, edges);
      await onSave(data);
      setHasUnsavedChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, onSave]);

  // ── Auto-Layout ──────────────────────────────────────────────────────────
  const handleAutoLayout = useCallback(() => {
    const currentData = stateToFlowData(nodes, edges);
    // Force auto-layout by using calculateProcessLayout with forceAutoLayout=true
    const layout = calculateProcessLayout(currentData, true);
    const layoutNodes: Node[] = layout.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { ...n.data, isDark },
      style: n.style as Record<string, string | number> | undefined,
    }));
    setNodes(layoutNodes);
    // Preserve edges as-is (layout doesn't change connectivity)
    const layoutEdges: Edge[] = layout.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: e.type,
      style: e.style as Record<string, string | number> | undefined,
      labelStyle: e.labelStyle as Record<string, string | number> | undefined,
      labelBgStyle: e.labelBgStyle as Record<string, string | number> | undefined,
      labelBgPadding: e.labelBgPadding,
      markerEnd: e.markerEnd,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));
    setEdges(layoutEdges);
    setHasUnsavedChanges(true);
  }, [nodes, edges, isDark, setNodes, setEdges]);

  // ── Render ───────────────────────────────────────────────────────────────
  const bgColor = isDark ? 'var(--background)' : '#fafafa';
  const gridColor = 'var(--border)';

  return (
    <div className="flex flex-col gap-2">
      <ProcessMapToolbar
        activeNodeType={activeNodeType}
        onNodeTypeSelect={setActiveNodeType}
        onSave={handleSave}
        onAutoLayout={handleAutoLayout}
        onGenerateFromCharter={onGenerateFromCharter}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        isGenerating={isGenerating}
      />

      <div
        style={{ height, background: bgColor, borderRadius: 8 }}
        className={`border border-border ${activeNodeType ? 'cursor-crosshair' : ''}`}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStop={onNodeDragStop}
          onEdgeClick={onEdgeClick}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.3}
          maxZoom={2}
          colorMode={isDark ? 'dark' : 'light'}
          nodesDraggable
          nodesConnectable
          deleteKeyCode="Backspace"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={gridColor} />
          <Controls
            showInteractive={false}
            style={{
              backgroundColor: isDark ? 'var(--card)' : '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />
          <MiniMap
            style={{
              backgroundColor: isDark ? 'var(--card)' : '#f9fafb',
              border: '1px solid var(--border)',
            }}
            nodeStrokeWidth={2}
          />
        </ReactFlow>
      </div>

      {/* Node edit popup */}
      {nodeEdit && (
        <NodeEditPopup
          nodeId={nodeEdit.nodeId}
          label={nodeEdit.label}
          responsible={nodeEdit.responsible}
          showResponsible={nodeEdit.showResponsible}
          position={nodeEdit.position}
          onSave={onNodeEditSave}
          onCancel={() => setNodeEdit(null)}
        />
      )}

      {/* Edge label popup */}
      {edgeEdit && (
        <EdgeLabelPopup
          edgeId={edgeEdit.edgeId}
          currentLabel={edgeEdit.currentLabel}
          isDecisionEdge={edgeEdit.isDecisionEdge}
          position={edgeEdit.position}
          onSave={onEdgeLabelSave}
          onCancel={onEdgeLabelCancel}
        />
      )}
    </div>
  );
}

// ── Wrapper with ReactFlowProvider ───────────────────────────────────────────

export default function ProcessFlowCanvas(props: ProcessFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <ProcessFlowInner {...props} />
    </ReactFlowProvider>
  );
}
