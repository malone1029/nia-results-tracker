'use client';

import { useEffect, useRef, useState } from 'react';

interface NodeEditPopupProps {
  nodeId: string;
  label: string;
  responsible?: string;
  showResponsible: boolean;
  position: { x: number; y: number };
  onSave: (nodeId: string, label: string, responsible?: string) => void;
  onCancel: () => void;
}

export default function NodeEditPopup({
  nodeId,
  label: initialLabel,
  responsible: initialResponsible,
  showResponsible,
  position,
  onSave,
  onCancel,
}: NodeEditPopupProps) {
  const [label, setLabel] = useState(initialLabel);
  const [responsible, setResponsible] = useState(initialResponsible ?? '');
  const popupRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus and select all text on mount
  useEffect(() => {
    if (labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, []);

  // Click outside → cancel
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onCancel]);

  function handleSave() {
    const trimmed = label.trim();
    if (!trimmed) return;
    onSave(nodeId, trimmed, showResponsible ? responsible.trim() || undefined : undefined);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }

  return (
    <div
      ref={popupRef}
      className="bg-card border border-border rounded-lg shadow-xl"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 100,
        minWidth: 220,
        padding: 12,
      }}
    >
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-secondary">Label</label>
        <input
          ref={labelInputRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-md border border-border bg-background text-foreground px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nia-green"
        />

        {showResponsible && (
          <>
            <label className="text-xs font-medium text-text-secondary">Owner</label>
            <input
              type="text"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Director of Finance"
              className="w-full rounded-md border border-border bg-background text-foreground px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nia-green"
            />
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1 text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="rounded-md bg-nia-green px-3 py-1 text-sm font-medium text-white hover:bg-nia-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
