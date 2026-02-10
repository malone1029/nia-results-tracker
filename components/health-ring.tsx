// Circular progress ring showing a 0-100 health score with color coding

interface HealthRingProps {
  score: number; // 0-100
  color: string; // hex color
  size?: number; // diameter in px
  strokeWidth?: number;
  showLabel?: boolean; // show score number in center
  className?: string;
}

export default function HealthRing({
  score,
  color,
  size = 44,
  strokeWidth = 4,
  showLabel = true,
  className = "",
}: HealthRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
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
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showLabel && (
        <span
          className="absolute text-xs font-bold"
          style={{ color }}
        >
          {score}
        </span>
      )}
    </div>
  );
}
