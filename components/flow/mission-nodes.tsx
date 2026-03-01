'use client';

// Custom React Flow node types for the Mission Workflow Diagram.
// All node type registrations must be MODULE-LEVEL constants (not inside components)
// to avoid React Flow's infinite re-render warning.

import { Handle, Position } from '@xyflow/react';
import { NIA_COLORS } from '@/lib/colors';

// ── Baldrige category colors ──────────────────────────────────────────────────
// Each of the 6 Baldrige categories gets a distinct color palette.
// These are NOT NIA brand colors — they're chosen to visually distinguish
// the categories in the Mission Workflow Diagram.

const BALDRIGE_CATEGORY_COLORS = {
  1: { bg: '#f0f9ff', border: '#bae6fd', label: '#0369a1' }, // Leadership — sky blue
  2: { bg: '#f0fdf4', border: '#bbf7d0', label: '#15803d' }, // Strategy — green
  3: { bg: '#fff7ed', border: '#fed7aa', label: '#c2410c' }, // Customers — orange
  4: { bg: '#faf5ff', border: '#e9d5ff', label: '#7c3aed' }, // Measurement — purple
  5: { bg: '#fefce8', border: '#fef08a', label: '#a16207' }, // Workforce — yellow
  6: { bg: '#f8fafc', border: '#e2e8f0', label: '#475569' }, // Operations — slate
} as const;

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
  const num = data.number as keyof typeof BALDRIGE_CATEGORY_COLORS;
  const cat = BALDRIGE_CATEGORY_COLORS[num];
  const bg = data.isDark ? '#1a1a1a' : (cat?.bg ?? '#f9fafb');
  const border = data.isDark ? 'var(--border)' : (cat?.border ?? NIA_COLORS.border);
  const labelColor = data.isDark ? NIA_COLORS.border : (cat?.label ?? '#374151');

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
          backgroundColor: data.isDark ? 'var(--surface-subtle)' : 'rgba(255,255,255,0.6)',
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
    data.priority === 'high'
      ? NIA_COLORS.red
      : data.priority === 'medium'
        ? NIA_COLORS.orange
        : NIA_COLORS.muted;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: data.isDark ? '#1c1400' : '#fff7ed', // amber tint — gap warning
        color: data.isDark ? '#fbbf24' : '#92400e', // amber text — gap warning
        border: `1.5px dashed ${NIA_COLORS.orange}`,
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
