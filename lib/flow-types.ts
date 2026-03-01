// Shared types for React Flow diagrams (Mission Workflow + Individual Process Maps)

// ── Mission Workflow (Command Center) ─────────────────────────────────────────

export type AdliClass =
  | 'integrated' // 70–100%
  | 'aligned' // 50–69%
  | 'early' // 30–49%
  | 'reacting' // 0–29%
  | 'unscored' // no ADLI data
  | 'gap'; // missing process

export interface MissionFlowNode {
  id: string; // "p5", "g1"
  label: string; // max 22 chars
  adliClass: AdliClass;
  adliScore?: number;
  baldrigeCategory: number; // 1–6
  isGap: boolean;
  priority?: 'high' | 'medium' | 'low';
}

export interface MissionFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface MissionFlowData {
  nodes: MissionFlowNode[];
  edges: MissionFlowEdge[];
}

// ── Individual Process Map ────────────────────────────────────────────────────

export type ProcessNodeType = 'start' | 'end' | 'step' | 'decision' | 'input' | 'output';

export interface ProcessMapNode {
  id: string;
  type: ProcessNodeType;
  label: string;
  responsible?: string;
  notes?: string;
}

export interface ProcessMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ProcessMapFlowData {
  nodes: ProcessMapNode[];
  edges: ProcessMapEdge[];
}
