'use client';

// Custom React Flow node types for individual process map diagrams.
// All node type registrations must be MODULE-LEVEL constants.

import { Handle, Position } from '@xyflow/react';

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
        backgroundColor: '#15803d',
        color: '#ffffff',
        border: '2px solid #166534',
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
        backgroundColor: '#b91c1c',
        color: '#ffffff',
        border: '2px solid #991b1b',
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
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: isDark ? '#1e3a3f' : '#e8f4f5',
        color: isDark ? '#b8cdd0' : '#324a4d',
        border: `1.5px solid ${isDark ? '#324a4d' : '#9ac5c9'}`,
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
          backgroundColor: isDark ? '#3a2a00' : '#fff7ed',
          border: `2px solid ${isDark ? '#f59e0b' : '#f79935'}`,
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
          color: isDark ? '#fbbf24' : '#92400e',
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
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: isDark ? '#0f172a' : '#eff6ff',
        color: isDark ? '#93c5fd' : '#1e40af',
        border: `1.5px solid ${isDark ? '#1e40af' : '#93c5fd'}`,
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
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: isDark ? '#1a0f2e' : '#faf5ff',
        color: isDark ? '#c4b5fd' : '#6d28d9',
        border: `1.5px solid ${isDark ? '#7c3aed' : '#c4b5fd'}`,
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
