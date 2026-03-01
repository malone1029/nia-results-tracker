'use client';

// React Flow canvas for individual process maps (Process Map tab on process pages).
// Renders start/end, step, decision, input, and output nodes with BFS-based layout.

import { useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react';

import { PROCESS_NODE_TYPES } from './process-nodes';
import { calculateProcessLayout } from '@/lib/flow-layout';
import type { ProcessMapFlowData } from '@/lib/flow-types';

// nodeTypes MUST be module-level — never redefine inside a component body
const nodeTypes = PROCESS_NODE_TYPES;

interface ProcessFlowCanvasProps {
  flowData: ProcessMapFlowData;
  height?: number;
}

function ProcessFlowInner({ flowData, height = 520 }: ProcessFlowCanvasProps) {
  const [isDark, setIsDark] = useState(false);

  // Detect dark mode from data-theme attribute
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

  // Calculate layout (memoized — only recalculates when flowData changes)
  const layout = useMemo(() => calculateProcessLayout(flowData), [flowData]);

  // Inject isDark into node data so custom nodes adapt their colors
  const nodesWithTheme = useMemo(
    () =>
      layout.nodes.map((n) => ({
        ...n,
        data: { ...n.data, isDark },
      })),
    [layout.nodes, isDark]
  );

  const [nodes, , onNodesChange] = useNodesState(nodesWithTheme);
  const [edges, , onEdgesChange] = useEdgesState(layout.edges);

  const bgColor = isDark ? '#111111' : '#fafafa';
  const gridColor = isDark ? '#2e2e2e' : '#e5e7eb';

  return (
    <div style={{ height, background: bgColor, borderRadius: 8 }} className="border border-border">
      <ReactFlow
        nodes={nodesWithTheme}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.3}
        maxZoom={2}
        colorMode={isDark ? 'dark' : 'light'}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={gridColor} />
        <Controls
          showInteractive={false}
          style={{
            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
            border: `1px solid ${isDark ? '#2e2e2e' : '#e5e7eb'}`,
            borderRadius: 8,
          }}
        />
        <MiniMap
          style={{
            backgroundColor: isDark ? '#1a1a1a' : '#f9fafb',
            border: `1px solid ${isDark ? '#2e2e2e' : '#e5e7eb'}`,
          }}
          nodeStrokeWidth={2}
        />
      </ReactFlow>
    </div>
  );
}

export default function ProcessFlowCanvas(props: ProcessFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <ProcessFlowInner {...props} />
    </ReactFlowProvider>
  );
}
