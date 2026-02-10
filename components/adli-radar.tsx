"use client";

import { useEffect, useState } from "react";

interface AdliRadarProps {
  approach: number;
  deployment: number;
  learning: number;
  integration: number;
  size?: number;
  showLabels?: boolean;
  color?: string;
}

const DIMENSION_COLORS = {
  approach: "#f79935",
  deployment: "#55787c",
  learning: "#b1bd37",
  integration: "#324a4d",
};

export default function AdliRadar({
  approach,
  deployment,
  learning,
  integration,
  size = 200,
  showLabels = true,
  color = "#55787c",
}: AdliRadarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const cx = 100;
  const cy = 100;
  const maxR = showLabels ? 60 : 80;

  function diamond(r: number) {
    return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
  }

  const aR = (approach / 100) * maxR;
  const dR = (deployment / 100) * maxR;
  const lR = (learning / 100) * maxR;
  const iR = (integration / 100) * maxR;
  const scorePoints = `${cx},${cy - aR} ${cx + dR},${cy} ${cx},${cy + lR} ${cx - iR},${cy}`;

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="block">
      <defs>
        {/* Gradient fill for the score polygon */}
        <linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={DIMENSION_COLORS.approach} stopOpacity="0.15" />
          <stop offset="50%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={DIMENSION_COLORS.learning} stopOpacity="0.15" />
        </linearGradient>
        {/* Glow filter for the data polygon */}
        <filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Subtle center dot */}
      <circle cx={cx} cy={cy} r="2" fill="#e5e7eb" />

      {/* Grid diamonds — refined lines */}
      {[0.25, 0.5, 0.75, 1].map((pct) => (
        <polygon
          key={pct}
          points={diamond(maxR * pct)}
          fill="none"
          stroke={pct === 1 ? "#d1d5db" : "#e5e7eb"}
          strokeWidth={pct === 1 ? "1" : "0.5"}
          strokeDasharray={pct < 1 ? "2 4" : undefined}
        />
      ))}

      {/* Axes — lighter, more refined */}
      <line x1={cx} y1={cy} x2={cx} y2={cy - maxR} stroke="#e5e7eb" strokeWidth="0.5" />
      <line x1={cx} y1={cy} x2={cx + maxR} y2={cy} stroke="#e5e7eb" strokeWidth="0.5" />
      <line x1={cx} y1={cy} x2={cx} y2={cy + maxR} stroke="#e5e7eb" strokeWidth="0.5" />
      <line x1={cx} y1={cy} x2={cx - maxR} y2={cy} stroke="#e5e7eb" strokeWidth="0.5" />

      {/* Score polygon + data dots — animated */}
      <g
        style={{
          transform: mounted ? "scale(1)" : "scale(0)",
          transformOrigin: `${cx}px ${cy}px`,
          transition: "transform 800ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Glow polygon (behind) */}
        <polygon
          points={scorePoints}
          fill="url(#radar-fill)"
          stroke="none"
          filter="url(#radar-glow)"
        />
        {/* Main polygon */}
        <polygon
          points={scorePoints}
          fill="url(#radar-fill)"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Data dots with dimension-specific colors */}
        <circle cx={cx} cy={cy - aR} r="3" fill={DIMENSION_COLORS.approach} stroke="white" strokeWidth="1.5" />
        <circle cx={cx + dR} cy={cy} r="3" fill={DIMENSION_COLORS.deployment} stroke="white" strokeWidth="1.5" />
        <circle cx={cx} cy={cy + lR} r="3" fill={DIMENSION_COLORS.learning} stroke="white" strokeWidth="1.5" />
        <circle cx={cx - iR} cy={cy} r="3" fill={DIMENSION_COLORS.integration} stroke="white" strokeWidth="1.5" />
      </g>

      {/* Labels with scores — dimension-colored */}
      {showLabels && (
        <>
          {/* Approach — top */}
          <text x={cx} y={20} textAnchor="middle" fontSize="10" fontWeight="700" fill={DIMENSION_COLORS.approach}>
            A
          </text>
          <text x={cx} y={31} textAnchor="middle" fontSize="9" fontWeight="500" fill="#9ca3af">
            {approach}
          </text>

          {/* Deployment — right */}
          <text x={175} y={cy - 1} textAnchor="end" fontSize="10" fontWeight="700" fill={DIMENSION_COLORS.deployment}>
            D
          </text>
          <text x={175} y={cy + 10} textAnchor="end" fontSize="9" fontWeight="500" fill="#9ca3af">
            {deployment}
          </text>

          {/* Learning — bottom */}
          <text x={cx} y={177} textAnchor="middle" fontSize="10" fontWeight="700" fill={DIMENSION_COLORS.learning}>
            L
          </text>
          <text x={cx} y={188} textAnchor="middle" fontSize="9" fontWeight="500" fill="#9ca3af">
            {learning}
          </text>

          {/* Integration — left */}
          <text x={25} y={cy - 1} textAnchor="start" fontSize="10" fontWeight="700" fill={DIMENSION_COLORS.integration}>
            I
          </text>
          <text x={25} y={cy + 10} textAnchor="start" fontSize="9" fontWeight="500" fill="#9ca3af">
            {integration}
          </text>
        </>
      )}
    </svg>
  );
}
