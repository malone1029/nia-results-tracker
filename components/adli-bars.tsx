import { getMaturityLevel } from "@/lib/colors";

export function DimBar({ label, score }: { label: string; score: number }) {
  const level = getMaturityLevel(score);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-nia-dark">{label}</span>
        <span className="text-sm font-bold" style={{ color: level.color }}>
          {score}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: level.bgColor }}
        />
      </div>
    </div>
  );
}

export function MiniBar({ label, score }: { label: string; score: number }) {
  const level = getMaturityLevel(score);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-400 w-3">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: level.bgColor }}
        />
      </div>
      <span className="text-[10px] text-gray-500 w-6 text-right">{score}%</span>
    </div>
  );
}
