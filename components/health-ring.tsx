// Circular progress ring showing a 0-100 health score with color coding.
// The arc draws in via CSS transition; the number counts up via requestAnimationFrame.

'use client';

import { memo, useEffect, useRef, useState } from 'react';

interface HealthRingProps {
  score: number; // 0-100
  color: string; // hex color
  size?: number; // diameter in px
  strokeWidth?: number;
  showLabel?: boolean; // show score number in center
  animate?: boolean; // count-up animation (default true)
  className?: string;
}

const HealthRing = memo(function HealthRing({
  score,
  color,
  size = 44,
  strokeWidth = 4,
  showLabel = true,
  animate = true,
  className = '',
}: HealthRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  // Count-up animation for the label number
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);
  const animatedRef = useRef(false);

  useEffect(() => {
    if (!animate || score === 0 || animatedRef.current) {
      setDisplayScore(score);
      return;
    }
    animatedRef.current = true;

    const duration = 600; // ms
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  }, [score, animate]);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          style={{ stroke: 'var(--grid-line)' }}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {showLabel && (
        <span className="absolute text-xs font-bold" style={{ color }}>
          {displayScore}
        </span>
      )}
    </div>
  );
});

export default HealthRing;
