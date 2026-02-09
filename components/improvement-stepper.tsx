"use client";

interface ImprovementStepperProps {
  currentStep: string;
  onStepClick?: (step: string) => void;
}

const STEPS = [
  { key: "start", label: "Start", shortLabel: "Start" },
  { key: "charter", label: "Charter", shortLabel: "Charter" },
  { key: "assessment", label: "Assessment", shortLabel: "Assess" },
  { key: "deep_dive", label: "Deep Dive", shortLabel: "Dive" },
  { key: "tasks", label: "Tasks", shortLabel: "Tasks" },
  { key: "export", label: "Export", shortLabel: "Export" },
];

function getStepIndex(step: string): number {
  const idx = STEPS.findIndex((s) => s.key === step);
  return idx >= 0 ? idx : 0;
}

export default function ImprovementStepper({ currentStep, onStepClick }: ImprovementStepperProps) {
  const currentIndex = getStepIndex(currentStep === "complete" ? "export" : currentStep);
  const isComplete = currentStep === "complete";

  return (
    <div className="bg-white rounded-lg shadow px-4 py-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-medium text-gray-500 uppercase tracking-wider">Improvement Cycle</span>
        {isComplete && (
          <span className="text-nia-green font-semibold">Cycle Complete</span>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex || isComplete;
          const isActive = idx === currentIndex && !isComplete;
          const isFuture = idx > currentIndex && !isComplete;

          return (
            <div key={step.key} className="flex items-center flex-1">
              {/* Step indicator */}
              <button
                onClick={() => onStepClick?.(step.key)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors w-full justify-center ${
                  isActive
                    ? "bg-[#2d3436] text-white"
                    : isCompleted
                    ? "bg-[#b1bd37]/15 text-[#b1bd37] hover:bg-[#b1bd37]/25"
                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                } ${onStepClick ? "cursor-pointer" : "cursor-default"}`}
                disabled={!onStepClick}
                title={step.label}
              >
                {isCompleted ? (
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                ) : (
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    isActive ? "bg-white/20" : "bg-gray-300/50"
                  }`}>
                    {idx + 1}
                  </span>
                )}
                <span className={`text-xs font-medium hidden sm:inline ${isFuture ? "text-gray-400" : ""}`}>
                  {step.label}
                </span>
                <span className="text-xs font-medium sm:hidden">
                  {step.shortLabel}
                </span>
              </button>

              {/* Connector line between steps */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-1.5 flex-shrink-0 ${
                    idx < currentIndex || isComplete ? "bg-[#b1bd37]" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
