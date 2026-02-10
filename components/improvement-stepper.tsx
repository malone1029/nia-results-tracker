"use client";

import { STEPS, getStepIndex } from "@/lib/step-actions";

interface ImprovementStepperProps {
  currentStep: string;
  onStepClick?: (step: string) => void;
  onAction?: (step: string, actionKey: string, prompt: string) => void;
}

export default function ImprovementStepper({ currentStep, onStepClick, onAction }: ImprovementStepperProps) {
  const currentIndex = getStepIndex(currentStep === "complete" ? "export" : currentStep);
  const isComplete = currentStep === "complete";

  return (
    <div className="bg-white rounded-lg shadow px-4 py-3 space-y-2">
      {/* Step progress bar */}
      <div className="flex items-center justify-between text-xs mb-1">
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

      {/* Action buttons for current step */}
      {onAction && !isComplete && (
        <StepActionButtons
          step={STEPS[currentIndex]}
          isActive={true}
          onAction={onAction}
        />
      )}
    </div>
  );
}

function StepActionButtons({
  step,
  isActive,
  onAction,
}: {
  step: (typeof STEPS)[number];
  isActive: boolean;
  onAction: (step: string, actionKey: string, prompt: string) => void;
}) {
  const isMuted = step.prominence === "muted";
  // For assessment step: first two actions (assessment + metrics) are both primary
  const isAssessment = step.key === "assessment";
  const primaryActions = isAssessment ? step.actions.slice(0, 2) : step.actions.slice(0, 1);
  const secondaryActions = isAssessment ? step.actions.slice(2) : step.actions.slice(1);

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {/* Primary action button(s) */}
      {primaryActions.map((action) => (
        <button
          key={action.key}
          onClick={(e) => {
            e.stopPropagation();
            onAction(step.key, action.key, action.prompt);
          }}
          className={`text-xs font-medium rounded-full px-3 py-1.5 transition-colors ${
            isActive && !isMuted
              ? "bg-nia-dark text-white hover:bg-nia-grey-blue"
              : isActive && isMuted
              ? "bg-nia-dark/10 text-nia-dark hover:bg-nia-dark/20"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
          title={action.description}
        >
          <span className="hidden sm:inline">{action.label}</span>
          <span className="sm:hidden">{action.shortLabel}</span>
        </button>
      ))}

      {/* Secondary action buttons */}
      {secondaryActions.map((action) => (
        <button
          key={action.key}
          onClick={(e) => {
            e.stopPropagation();
            onAction(step.key, action.key, action.prompt);
          }}
          className="text-xs font-medium rounded-full px-3 py-1.5 border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-nia-dark transition-colors"
          title={action.description}
        >
          <span className="hidden sm:inline">{action.label}</span>
          <span className="sm:hidden">{action.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
