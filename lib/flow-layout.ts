// Pure layout functions — calculate (x, y) positions from flow node data.
// Returns plain objects compatible with @xyflow/react Node/Edge shapes.

import type { MissionFlowData, ProcessMapFlowData } from './flow-types';
import { MarkerType } from '@xyflow/react';

// ── Shared layout constants ────────────────────────────────────────────────

const NODE_W = 180;
const NODE_H = 60;
const GAP_X = 24;
const GAP_Y = 20;
const NODE_COLS = 3;

// ── Mission Workflow layout ────────────────────────────────────────────────

const CAT_HEADER_H = 44;
const CAT_PAD_X = 16;
const CAT_PAD_Y = 14;
const CAT_BETWEEN = 24;
export const CAT_WIDTH = NODE_COLS * NODE_W + (NODE_COLS - 1) * GAP_X + CAT_PAD_X * 2;

const BALDRIGE_NAMES = [
  '1. Leadership',
  '2. Strategy',
  '3. Customers',
  '4. Measurement',
  '5. Workforce',
  '6. Operations',
];

const ADLI_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  integrated: { bg: '#324a4d', text: '#ffffff', border: '#2a3d40' },
  aligned: { bg: '#b1bd37', text: '#000000', border: '#9aab2c' },
  early: { bg: '#f79935', text: '#000000', border: '#e08820' },
  reacting: { bg: '#dc2626', text: '#ffffff', border: '#b91c1c' },
  unscored: { bg: '#9ca3af', text: '#ffffff', border: '#6b7280' },
  gap: { bg: '#fff7ed', text: '#92400e', border: '#f59e0b' },
};

export function getAdliColor(cls: string) {
  return ADLI_COLORS[cls] ?? ADLI_COLORS.unscored;
}

function catContentHeight(nodeCount: number): number {
  const rows = Math.max(1, Math.ceil(nodeCount / NODE_COLS));
  return rows * NODE_H + (rows - 1) * GAP_Y;
}

function catHeight(nodeCount: number): number {
  return CAT_HEADER_H + CAT_PAD_Y + catContentHeight(nodeCount) + CAT_PAD_Y;
}

export interface RFNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  parentId?: string;
  extent?: 'parent';
  data: Record<string, unknown>;
  style?: Record<string, unknown>;
  draggable?: boolean;
}

export interface RFEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  style?: Record<string, unknown>;
  labelStyle?: Record<string, unknown>;
  markerEnd?: { type: MarkerType };
}

export function calculateMissionLayout(flowData: MissionFlowData): {
  nodes: RFNode[];
  edges: RFEdge[];
  totalHeight: number;
} {
  const rfNodes: RFNode[] = [];
  const rfEdges: RFEdge[] = [];

  // Group nodes by category (1–6)
  const nodesByCategory = new Map<number, MissionFlowData['nodes']>();
  for (let i = 1; i <= 6; i++) nodesByCategory.set(i, []);
  for (const node of flowData.nodes) {
    const list = nodesByCategory.get(node.baldrigeCategory);
    if (list) list.push(node);
  }

  let currentY = 0;

  for (let catNum = 1; catNum <= 6; catNum++) {
    const catNodes = nodesByCategory.get(catNum) || [];
    const catId = `_cat${catNum}`;
    const catH = catHeight(catNodes.length);

    // Category group node (background container)
    rfNodes.push({
      id: catId,
      type: 'categoryGroup',
      position: { x: 0, y: currentY },
      data: {
        label: BALDRIGE_NAMES[catNum - 1],
        number: catNum,
      },
      style: { width: CAT_WIDTH, height: catH },
      draggable: false,
    });

    // Child nodes (positioned relative to parent)
    catNodes.forEach((node, idx) => {
      const col = idx % NODE_COLS;
      const row = Math.floor(idx / NODE_COLS);
      const nodeX = CAT_PAD_X + col * (NODE_W + GAP_X);
      const nodeY = CAT_HEADER_H + CAT_PAD_Y + row * (NODE_H + GAP_Y);
      const colors = getAdliColor(node.adliClass);

      rfNodes.push({
        id: node.id,
        type: node.isGap ? 'gapNode' : 'processNode',
        position: { x: nodeX, y: nodeY },
        parentId: catId,
        extent: 'parent',
        data: {
          label: node.label,
          adliClass: node.adliClass,
          adliScore: node.adliScore,
          isGap: node.isGap,
          priority: node.priority,
          bg: colors.bg,
          text: colors.text,
          border: colors.border,
        },
        style: { width: NODE_W, height: NODE_H },
      });
    });

    currentY += catH + CAT_BETWEEN;
  }

  // Edges
  for (const edge of flowData.edges) {
    rfEdges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      style: { stroke: '#9ca3af', strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: '#6b7280' },
    });
  }

  return { nodes: rfNodes, edges: rfEdges, totalHeight: currentY };
}

// ── Process Map layout (BFS top-down) ─────────────────────────────────────

const PM_LEVEL_H = 130;
const PM_NODE_SPACING = 220;
const PM_CANVAS_CENTER = 450;
const PM_DECISION_W = 130;
const PM_DECISION_H = 130;
const PM_STEP_W = 180;
const PM_STEP_H = 60;
const PM_START_END_W = 140;
const PM_START_END_H = 44;

export function calculateProcessLayout(flowData: ProcessMapFlowData): {
  nodes: RFNode[];
  edges: RFEdge[];
} {
  const rfNodes: RFNode[] = [];
  const rfEdges: RFEdge[] = [];

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const edge of flowData.edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  // BFS from start node
  const startNode = flowData.nodes.find((n) => n.type === 'start');
  const startId = startNode?.id ?? flowData.nodes[0]?.id;

  const levels = new Map<string, number>();
  if (startId) {
    const queue: string[] = [startId];
    levels.set(startId, 0);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curLevel = levels.get(cur)!;
      for (const next of adjacency.get(cur) || []) {
        if (!levels.has(next)) {
          levels.set(next, curLevel + 1);
          queue.push(next);
        }
      }
    }
  }

  // Assign unreachable nodes to a fallback level
  const maxLevel = Math.max(0, ...levels.values());
  for (const node of flowData.nodes) {
    if (!levels.has(node.id)) levels.set(node.id, maxLevel + 1);
  }

  // Group by level
  const nodesByLevel = new Map<number, string[]>();
  for (const [id, lvl] of levels) {
    if (!nodesByLevel.has(lvl)) nodesByLevel.set(lvl, []);
    nodesByLevel.get(lvl)!.push(id);
  }

  // Position map
  const posMap = new Map<string, { x: number; y: number }>();
  for (const [lvl, ids] of nodesByLevel) {
    const totalWidth = ids.length * PM_NODE_SPACING;
    const startX = PM_CANVAS_CENTER - totalWidth / 2 + PM_NODE_SPACING / 2;
    ids.forEach((id, i) => {
      posMap.set(id, { x: startX + i * PM_NODE_SPACING, y: lvl * PM_LEVEL_H });
    });
  }

  // Build React Flow nodes
  for (const node of flowData.nodes) {
    const pos = posMap.get(node.id) ?? { x: 0, y: 0 };
    const isDecision = node.type === 'decision';
    const isStartEnd = node.type === 'start' || node.type === 'end';
    const w = isDecision ? PM_DECISION_W : isStartEnd ? PM_START_END_W : PM_STEP_W;
    const h = isDecision ? PM_DECISION_H : isStartEnd ? PM_START_END_H : PM_STEP_H;

    rfNodes.push({
      id: node.id,
      type: `pm_${node.type}`,
      position: { x: pos.x - w / 2, y: pos.y },
      data: {
        label: node.label,
        responsible: node.responsible,
        notes: node.notes,
      },
      style: { width: w, height: h },
    });
  }

  // Build edges
  for (const edge of flowData.edges) {
    rfEdges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#55787c', strokeWidth: 2 },
      labelStyle: { fontSize: 11, fill: '#55787c', fontWeight: 500 },
    });
  }

  return { nodes: rfNodes, edges: rfEdges };
}
