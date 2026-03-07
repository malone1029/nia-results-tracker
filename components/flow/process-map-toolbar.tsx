'use client';

import { ProcessNodeType } from '@/lib/flow-types';

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

const NODE_BUTTONS: { type: ProcessNodeType; label: string; icon: string }[] = [
  { type: 'start', label: 'Start', icon: '▶' },
  { type: 'step', label: 'Step', icon: '■' },
  { type: 'decision', label: 'Decision', icon: '◆' },
  { type: 'input', label: 'Input', icon: '↓' },
  { type: 'output', label: 'Output', icon: '↑' },
  { type: 'end', label: 'End', icon: '⏹' },
];

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
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-card p-2 shadow-sm border border-border">
      {/* Node type buttons */}
      <div className="flex flex-wrap items-center gap-1 pr-3 border-r border-border">
        {NODE_BUTTONS.map(({ type, label, icon }) => {
          const isActive = activeNodeType === type;
          return (
            <button
              key={type}
              onClick={() => onNodeTypeSelect(isActive ? null : type)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-nia-green/20 text-nia-green border border-nia-green/40'
                  : 'text-text-secondary border border-transparent hover:bg-surface-hover'
              }`}
              title={`Add ${label} node`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onAutoLayout}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary border border-transparent hover:bg-surface-hover transition-colors"
        >
          Auto-Layout
        </button>

        <button
          onClick={onGenerateFromCharter}
          disabled={isGenerating}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary border border-transparent hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generating...' : 'Generate from Charter'}
        </button>

        <button
          onClick={onSave}
          disabled={!hasUnsavedChanges || isSaving}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
            hasUnsavedChanges
              ? 'bg-nia-green text-white hover:bg-nia-green/90'
              : 'bg-surface-hover text-text-muted'
          }`}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
