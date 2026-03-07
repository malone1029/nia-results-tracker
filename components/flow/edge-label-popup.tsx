'use client';

import { useEffect, useRef, useState } from 'react';

interface EdgeLabelPopupProps {
  edgeId: string;
  currentLabel?: string;
  isDecisionEdge: boolean;
  position: { x: number; y: number };
  onSave: (edgeId: string, label: string) => void;
  onCancel: () => void;
}

export default function EdgeLabelPopup({
  edgeId,
  currentLabel,
  isDecisionEdge,
  position,
  onSave,
  onCancel,
}: EdgeLabelPopupProps) {
  const [label, setLabel] = useState(currentLabel ?? '');
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus text input for non-decision edges
  useEffect(() => {
    if (!isDecisionEdge && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isDecisionEdge]);

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(edgeId, label.trim());
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }

  // Decision edge: Yes / No button picker
  if (isDecisionEdge) {
    const selected = currentLabel?.toLowerCase();
    return (
      <div
        ref={popupRef}
        className="bg-card border border-border rounded-lg shadow-xl"
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 100,
          padding: 8,
        }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSave(edgeId, 'Yes')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              selected === 'yes'
                ? 'bg-nia-green text-white'
                : 'border border-nia-green text-nia-green hover:bg-nia-green/10'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => onSave(edgeId, 'No')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              selected === 'no'
                ? 'bg-nia-red text-white'
                : 'border border-nia-red text-nia-red hover:bg-nia-red/10'
            }`}
          >
            No
          </button>
        </div>
      </div>
    );
  }

  // Non-decision edge: free text input
  return (
    <div
      ref={popupRef}
      className="bg-card border border-border rounded-lg shadow-xl"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
        minWidth: 180,
        padding: 8,
      }}
    >
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Edge label"
          className="flex-1 rounded-md border border-border bg-background text-foreground px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nia-green"
        />
        <button
          onClick={() => onSave(edgeId, label.trim())}
          className="rounded-md bg-nia-green px-3 py-1.5 text-sm font-medium text-white hover:bg-nia-green/90 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
