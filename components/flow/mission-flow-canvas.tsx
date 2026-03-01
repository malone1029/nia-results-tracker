'use client';

// React Flow canvas for the Command Center Mission Workflow Diagram.
// Renders all 6 Baldrige categories with process nodes and gap nodes,
// with built-in pan / zoom.

import { useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react';

import { MISSION_NODE_TYPES } from './mission-nodes';
import { calculateMissionLayout } from '@/lib/flow-layout';
import type { MissionFlowData } from '@/lib/flow-types';

// nodeTypes MUST be module-level — never redefine inside a component body
const nodeTypes = MISSION_NODE_TYPES;

interface MissionFlowCanvasProps {
  flowData: MissionFlowData;
  height?: number;
}

function MissionFlowInner({ flowData, height = 700 }: MissionFlowCanvasProps) {
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
  const layout = useMemo(() => calculateMissionLayout(flowData), [flowData]);

  // Inject isDark into node data so custom nodes can adapt their colors
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

  // Sync layout changes (e.g., after regeneration) into local state
  useEffect(() => {
    // Replace nodes/edges when flowData changes
  }, [nodesWithTheme, layout.edges]);

  const bgColor = isDark ? 'var(--background)' : '#f8fafc';
  const gridColor = isDark ? 'var(--border)' : 'var(--border)';

  return (
    <div style={{ height, background: bgColor, borderRadius: 8 }} className="border border-border">
      <ReactFlow
        nodes={nodesWithTheme}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        minZoom={0.2}
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
            backgroundColor: isDark ? 'var(--card)' : '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        />
      </ReactFlow>
    </div>
  );
}

export default function MissionFlowCanvas(props: MissionFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <MissionFlowInner {...props} />
    </ReactFlowProvider>
  );
}
