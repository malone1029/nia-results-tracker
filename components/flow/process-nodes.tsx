'use client';

// Custom React Flow node types for individual process map diagrams.
// All node type registrations must be MODULE-LEVEL constants.

import { Handle, Position } from '@xyflow/react';

// ── Flowchart node colors ─────────────────────────────────────────────────────
// These are standard flowchart semantic colors, NOT NIA brand colors.
// Green = start, red = end, teal = step, amber = decision, blue = input, purple = output.

const NODE_COLORS = {
  start: { bg: '#15803d', border: '#166534' },
  end: { bg: '#b91c1c', border: '#991b1b' },
  step: {
    light: { bg: '#e8f4f5', text: '#324a4d', border: '#9ac5c9' },
    dark: { bg: '#1e3a3f', text: '#b8cdd0', border: '#324a4d' },
  },
  decision: {
    light: { bg: '#fff7ed', border: '#f79935', text: '#92400e' },
    dark: { bg: '#3a2a00', border: '#f59e0b', text: '#fbbf24' },
  },
  input: {
    light: { bg: '#eff6ff', text: '#1e40af', border: '#93c5fd' },
    dark: { bg: '#0f172a', text: '#93c5fd', border: '#1e40af' },
  },
  output: {
    light: { bg: '#faf5ff', text: '#6d28d9', border: '#c4b5fd' },
    dark: { bg: '#1a0f2e', text: '#c4b5fd', border: '#7c3aed' },
  },
} as const;

// ── StartEndNode ──────────────────────────────────────────────────────────────
// Pill-shaped terminal nodes (green for start, red for end).

interface StartEndData {
  label: string;
  isEnd?: boolean;
  isDark?: boolean;
}

export function StartNode({ data }: { data: StartEndData }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: NODE_COLORS.start.bg,
        color: '#ffffff',
        border: `2px solid ${NODE_COLORS.start.border}`,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        textAlign: 'center',
        padding: '0 12px',
      }}
    >
      {data.label}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

export function EndNode({ data }: { data: StartEndData }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: NODE_COLORS.end.bg,
        color: '#ffffff',
        border: `2px solid ${NODE_COLORS.end.border}`,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        textAlign: 'center',
        padding: '0 12px',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {data.label}
    </div>
  );
}

// ── StepNode ──────────────────────────────────────────────────────────────────
// Standard rectangular process step.

interface StepData {
  label: string;
  responsible?: string;
  notes?: string;
  isDark?: boolean;
}

export function StepNode({ data }: { data: StepData }) {
  const isDark = data.isDark;
  const s = isDark ? NODE_COLORS.step.dark : NODE_COLORS.step.light;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: s.bg,
        color: s.text,
        border: `1.5px solid ${s.border}`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 10px',
        textAlign: 'center',
        gap: 2,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{data.label}</span>
      {data.responsible && (
        <span style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.2 }}>{data.responsible}</span>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

// ── DecisionNode ──────────────────────────────────────────────────────────────
// Diamond-shaped decision node using a rotated square behind the text.

interface DecisionData {
  label: string;
  isDark?: boolean;
}

export function DecisionNode({ data }: { data: DecisionData }) {
  const isDark = data.isDark;
  const d = isDark ? NODE_COLORS.decision.dark : NODE_COLORS.decision.light;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Diamond background — rotated square */}
      <div
        style={{
          position: 'absolute',
          width: '72%',
          height: '72%',
          backgroundColor: d.bg,
          border: `2px solid ${d.border}`,
          transform: 'rotate(45deg)',
          borderRadius: 4,
        }}
      />
      {/* Text overlay — centered above the diamond */}
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 11,
          fontWeight: 600,
          color: d.text,
          textAlign: 'center',
          lineHeight: 1.3,
          maxWidth: '80%',
          wordBreak: 'break-word',
        }}
      >
        {data.label}
      </span>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="yes" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="no" style={{ opacity: 0 }} />
    </div>
  );
}

// ── InputOutputNode ───────────────────────────────────────────────────────────
// Slightly offset parallelogram shape for inputs/outputs.

interface IOData {
  label: string;
  isOutput?: boolean;
  isDark?: boolean;
}

export function InputNode({ data }: { data: IOData }) {
  const isDark = data.isDark;
  const inp = isDark ? NODE_COLORS.input.dark : NODE_COLORS.input.light;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: inp.bg,
        color: inp.text,
        border: `1.5px solid ${inp.border}`,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        textAlign: 'center',
        padding: '4px 10px',
        transform: 'skewX(-8deg)',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, transform: 'skewX(8deg)' }}
      />
      <span style={{ transform: 'skewX(8deg)', lineHeight: 1.3 }}>{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, transform: 'skewX(8deg)' }}
      />
    </div>
  );
}

export function OutputNode({ data }: { data: IOData }) {
  const isDark = data.isDark;
  const out = isDark ? NODE_COLORS.output.dark : NODE_COLORS.output.light;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: out.bg,
        color: out.text,
        border: `1.5px solid ${out.border}`,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        textAlign: 'center',
        padding: '4px 10px',
        transform: 'skewX(8deg)',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, transform: 'skewX(-8deg)' }}
      />
      <span style={{ transform: 'skewX(-8deg)', lineHeight: 1.3 }}>{data.label}</span>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, transform: 'skewX(-8deg)' }}
      />
    </div>
  );
}

// ── NODE TYPE MAP — module-level constant (NEVER define inside a component) ───

export const PROCESS_NODE_TYPES = {
  pm_start: StartNode,
  pm_end: EndNode,
  pm_step: StepNode,
  pm_decision: DecisionNode,
  pm_input: InputNode,
  pm_output: OutputNode,
};
