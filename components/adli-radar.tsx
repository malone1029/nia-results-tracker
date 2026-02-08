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
  const maxR = showLabels ? 65 : 80;

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
      {/* Grid diamonds */}
      {[0.25, 0.5, 0.75, 1].map((pct) => (
        <polygon
          key={pct}
          points={diamond(maxR * pct)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={pct === 1 ? "1.5" : "0.75"}
          strokeDasharray={pct < 1 ? "3 3" : undefined}
        />
      ))}

      {/* Axes */}
      <line x1={cx} y1={cy} x2={cx} y2={cy - maxR} stroke="#d1d5db" strokeWidth="0.75" />
      <line x1={cx} y1={cy} x2={cx + maxR} y2={cy} stroke="#d1d5db" strokeWidth="0.75" />
      <line x1={cx} y1={cy} x2={cx} y2={cy + maxR} stroke="#d1d5db" strokeWidth="0.75" />
      <line x1={cx} y1={cy} x2={cx - maxR} y2={cy} stroke="#d1d5db" strokeWidth="0.75" />

      {/* Score polygon + data dots — animated */}
      <g
        style={{
          transform: mounted ? "scale(1)" : "scale(0)",
          transformOrigin: `${cx}px ${cy}px`,
          transition: "transform 800ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <polygon
          points={scorePoints}
          fill={color}
          fillOpacity="0.15"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx={cx} cy={cy - aR} r="3.5" fill={color} />
        <circle cx={cx + dR} cy={cy} r="3.5" fill={color} />
        <circle cx={cx} cy={cy + lR} r="3.5" fill={color} />
        <circle cx={cx - iR} cy={cy} r="3.5" fill={color} />
      </g>

      {/* Labels with scores */}
      {showLabels && (
        <>
          {/* Approach — top */}
          <text x={cx} y={18} textAnchor="middle" fontSize="11" fontWeight="600" fill="#6b7280">
            A
          </text>
          <text x={cx} y={29} textAnchor="middle" fontSize="9" fill="#9ca3af">
            {approach}%
          </text>

          {/* Deployment — right */}
          <text x={180} y={cy - 2} textAnchor="end" fontSize="11" fontWeight="600" fill="#6b7280">
            D
          </text>
          <text x={180} y={cy + 10} textAnchor="end" fontSize="9" fill="#9ca3af">
            {deployment}%
          </text>

          {/* Learning — bottom */}
          <text x={cx} y={183} textAnchor="middle" fontSize="11" fontWeight="600" fill="#6b7280">
            L
          </text>
          <text x={cx} y={194} textAnchor="middle" fontSize="9" fill="#9ca3af">
            {learning}%
          </text>

          {/* Integration — left */}
          <text x={20} y={cy - 2} textAnchor="start" fontSize="11" fontWeight="600" fill="#6b7280">
            I
          </text>
          <text x={20} y={cy + 10} textAnchor="start" fontSize="9" fill="#9ca3af">
            {integration}%
          </text>
        </>
      )}
    </svg>
  );
}
