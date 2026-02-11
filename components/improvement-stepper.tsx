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
  const progressPct = isComplete ? 100 : Math.round((currentIndex / (STEPS.length - 1)) * 100);

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border-light overflow-hidden">
      {/* Header bar */}
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-nia-dark/5 flex items-center justify-center">
            <svg className="w-4 h-4 text-nia-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-nia-dark uppercase tracking-wider">Improvement Cycle</span>
        </div>
        {isComplete ? (
          <span className="text-xs font-semibold text-nia-green bg-nia-green/10 px-2.5 py-1 rounded-full">
            Complete
          </span>
        ) : (
          <span className="text-xs text-text-muted tabular-nums">
            Step {currentIndex + 1} of {STEPS.length}
          </span>
        )}
      </div>

      {/* ── Mobile layout: progress bar + current step name ── */}
      <div className="sm:hidden px-4 pb-3">
        {/* Progress bar */}
        <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progressPct}%`,
              background: isComplete
                ? "var(--nia-green)"
                : "linear-gradient(90deg, var(--nia-green), var(--nia-grey-blue))",
            }}
          />
        </div>

        {/* Step pills — scrollable row showing all steps */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentIndex || isComplete;
            const isActive = idx === currentIndex && !isComplete;

            return (
              <button
                key={step.key}
                onClick={() => onStepClick?.(step.key)}
                disabled={!onStepClick}
                className={`flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2.5 py-1 transition-colors ${
                  isActive
                    ? "bg-nia-dark-solid text-white"
                    : isCompleted
                    ? "bg-nia-green/10 text-nia-green"
                    : "bg-surface-hover text-text-muted"
                } ${onStepClick ? "cursor-pointer" : "cursor-default"}`}
              >
                {isCompleted && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}
                {step.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Desktop layout: dot timeline ── */}
      <div className="hidden sm:block px-5 pb-4">
        <div className="relative">
          {/* Background track */}
          <div className="h-1 bg-surface-subtle rounded-full" />
          {/* Filled track */}
          <div
            className="absolute top-0 left-0 h-1 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progressPct}%`,
              background: isComplete
                ? "var(--nia-green)"
                : "linear-gradient(90deg, var(--nia-green), var(--nia-grey-blue))",
            }}
          />
          {/* Step dots on the track */}
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between">
            {STEPS.map((step, idx) => {
              const isCompleted = idx < currentIndex || isComplete;
              const isActive = idx === currentIndex && !isComplete;

              return (
                <button
                  key={step.key}
                  onClick={() => onStepClick?.(step.key)}
                  disabled={!onStepClick}
                  className={`relative group flex flex-col items-center ${onStepClick ? "cursor-pointer" : "cursor-default"}`}
                  title={step.label}
                >
                  {/* Pulse ring on active */}
                  {isActive && (
                    <span className="absolute w-6 h-6 rounded-full bg-nia-dark/10 stepper-pulse" />
                  )}
                  {/* Dot */}
                  <span
                    className={`relative w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${
                      isActive
                        ? "bg-nia-dark-solid border-nia-dark-solid shadow-md scale-125"
                        : isCompleted
                        ? "bg-nia-green border-nia-green"
                        : "bg-card border-border group-hover:border-text-muted"
                    }`}
                  >
                    {isCompleted && (
                      <svg className="absolute inset-0 w-full h-full p-[1px] text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                  </span>
                  {/* Label below dot */}
                  <span
                    className={`mt-2 text-[10px] font-medium leading-tight transition-colors ${
                      isActive
                        ? "text-nia-dark font-semibold"
                        : isCompleted
                        ? "text-nia-green"
                        : "text-text-muted group-hover:text-text-tertiary"
                    }`}
                  >
                    {step.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Spacer for desktop step labels */}
      <div className="h-5 hidden sm:block" />

      {/* Action buttons for current step */}
      {onAction && !isComplete && (
        <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-border-light">
          <StepActionButtons
            step={STEPS[currentIndex]}
            onAction={onAction}
          />
        </div>
      )}
    </div>
  );
}

function StepActionButtons({
  step,
  onAction,
}: {
  step: (typeof STEPS)[number];
  onAction: (step: string, actionKey: string, prompt: string) => void;
}) {
  const isMuted = step.prominence === "muted";
  const isAssessment = step.key === "assessment";
  const primaryActions = isAssessment ? step.actions.slice(0, 2) : step.actions.slice(0, 1);
  const secondaryActions = isAssessment ? step.actions.slice(2) : step.actions.slice(1);

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {primaryActions.map((action) => (
        <button
          key={action.key}
          onClick={(e) => {
            e.stopPropagation();
            onAction(step.key, action.key, action.prompt);
          }}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3.5 py-2 transition-all duration-150 ${
            !isMuted
              ? "bg-nia-dark-solid text-white hover:bg-nia-grey-blue shadow-sm hover:shadow"
              : "bg-surface-subtle text-nia-dark hover:bg-surface-muted"
          }`}
          title={action.description}
        >
          <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="hidden sm:inline">{action.label}</span>
          <span className="sm:hidden">{action.shortLabel}</span>
        </button>
      ))}

      {secondaryActions.map((action) => (
        <button
          key={action.key}
          onClick={(e) => {
            e.stopPropagation();
            onAction(step.key, action.key, action.prompt);
          }}
          className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-2 text-text-tertiary hover:text-nia-dark hover:bg-surface-hover transition-all duration-150"
          title={action.description}
        >
          <span className="hidden sm:inline">{action.label}</span>
          <span className="sm:hidden">{action.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
