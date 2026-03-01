'use client';

// Custom React Flow node types for the Mission Workflow Diagram.
// All node type registrations must be MODULE-LEVEL constants (not inside components)
// to avoid React Flow's infinite re-render warning.

import { Handle, Position } from '@xyflow/react';

// ── Color helpers ─────────────────────────────────────────────────────────────

const CAT_BG: Record<number, string> = {
  1: '#f0f9ff', // Leadership — sky
  2: '#f0fdf4', // Strategy — green
  3: '#fff7ed', // Customers — orange
  4: '#faf5ff', // Measurement — purple
  5: '#fefce8', // Workforce — yellow
  6: '#f8fafc', // Operations — slate
};
const CAT_BORDER: Record<number, string> = {
  1: '#bae6fd',
  2: '#bbf7d0',
  3: '#fed7aa',
  4: '#e9d5ff',
  5: '#fef08a',
  6: '#e2e8f0',
};
const CAT_LABEL: Record<number, string> = {
  1: '#0369a1',
  2: '#15803d',
  3: '#c2410c',
  4: '#7c3aed',
  5: '#a16207',
  6: '#475569',
};

// ── CategoryGroupNode ─────────────────────────────────────────────────────────
// A background container that groups processes in one Baldrige category.
// Must NOT have Handles since it's not a source/target of edges.

interface CategoryGroupData {
  label: string;
  number: number;
  isDark?: boolean;
}

export function CategoryGroupNode({
  data,
  style,
}: {
  data: CategoryGroupData;
  style?: React.CSSProperties;
}) {
  const num = data.number as number;
  const bg = data.isDark ? '#1a1a1a' : (CAT_BG[num] ?? '#f9fafb');
  const border = data.isDark ? '#2e2e2e' : (CAT_BORDER[num] ?? '#e5e7eb');
  const labelColor = data.isDark ? '#e5e7eb' : (CAT_LABEL[num] ?? '#374151');

  return (
    <div
      style={{
        ...style,
        backgroundColor: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {/* Category title bar */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 14,
          borderBottom: `1px solid ${border}`,
          backgroundColor: data.isDark ? '#222' : 'rgba(255,255,255,0.6)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.03em',
            color: labelColor,
            textTransform: 'uppercase',
          }}
        >
          {data.label}
        </span>
      </div>
    </div>
  );
}

// ── ProcessNode ───────────────────────────────────────────────────────────────
// A colored rectangle representing a documented key process.

interface ProcessNodeData {
  label: string;
  adliClass: string;
  adliScore?: number;
  bg: string;
  text: string;
  border: string;
  isDark?: boolean;
}

export function ProcessNode({ data }: { data: ProcessNodeData }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: data.bg,
        color: data.text,
        border: `1.5px solid ${data.border}`,
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 8px',
        textAlign: 'center',
        cursor: 'default',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{data.label}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

// ── GapNode ───────────────────────────────────────────────────────────────────
// An amber dashed rectangle representing a missing (gap) process.

interface GapNodeData {
  label: string;
  priority?: 'high' | 'medium' | 'low';
  isDark?: boolean;
}

export function GapNode({ data }: { data: GapNodeData }) {
  const priorityDot =
    data.priority === 'high' ? '#ef4444' : data.priority === 'medium' ? '#f59e0b' : '#9ca3af';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: data.isDark ? '#1c1400' : '#fff7ed',
        color: data.isDark ? '#fbbf24' : '#92400e',
        border: '1.5px dashed #f59e0b',
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 8px',
        textAlign: 'center',
        cursor: 'default',
        gap: 2,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10 }}>⚠</span>
        <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{data.label}</span>
      </div>
      {data.priority && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: priorityDot,
            }}
          />
          <span style={{ fontSize: 9, opacity: 0.8 }}>{data.priority}</span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

// ── NODE TYPE MAP — module-level constant (NEVER define inside a component) ───

export const MISSION_NODE_TYPES = {
  categoryGroup: CategoryGroupNode,
  processNode: ProcessNode,
  gapNode: GapNode,
};
