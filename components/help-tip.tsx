'use client';

import { useState, useRef, useEffect } from 'react';

interface HelpTipProps {
  text: string;
  position?: 'top' | 'bottom';
}

export default function HelpTip({ text, position }: HelpTipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<'top' | 'bottom'>(position || 'top');
  const tipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Auto-detect position if not specified
  useEffect(() => {
    if (show && !position && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos(rect.top < 120 ? 'bottom' : 'top');
    }
  }, [show, position]);

  // Close on outside click
  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      if (
        tipRef.current &&
        !tipRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [show]);

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        onClick={() => setShow(!show)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="help-tip-trigger"
        aria-label="Help"
      >
        ?
      </button>
      {show && (
        <div
          ref={tipRef}
          className={`help-tip-popover ${pos === 'top' ? 'help-tip-top' : 'help-tip-bottom'}`}
        >
          {text}
        </div>
      )}
    </span>
  );
}
