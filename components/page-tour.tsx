"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TourStep {
  target: string;       // data-tour attribute value
  title: string;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "stat-cards",
    title: "Stat Cards",
    description: "Your at-a-glance health metrics. Readiness, Baldrige Ready count, attention items, overdue, and active tasks.",
  },
  {
    target: "task-hub",
    title: "Task Hub",
    description: "Your cross-process task queue. Tasks are grouped by urgency — overdue, due soon, and recently completed.",
  },
  {
    target: "process-list",
    title: "Process List",
    description: "All processes with health scores. Click any process to see details, run assessments, and manage tasks.",
  },
  {
    target: "ai-help",
    title: "AI Help",
    description: "Click anytime to ask a question about using the Hub. The AI knows all pages and features.",
  },
  {
    target: "sidebar-nav",
    title: "Sidebar Navigation",
    description: "Jump between pages from the sidebar. On mobile, tap the hamburger menu to open it.",
  },
];

const STORAGE_KEY = "tour-completed";

export default function PageTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Check if tour should auto-start
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (completed) return;

    // Check if tour=true is in the URL
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "true") {
      setActive(true);
      // Clean up the URL
      params.delete("tour");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      return;
    }

    // Auto-start after onboarding
    const onboardingDone = localStorage.getItem("onboarding-completed");
    const tourPending = localStorage.getItem("tour-pending");
    if (onboardingDone && tourPending) {
      localStorage.removeItem("tour-pending");
      // Small delay to let the page render
      setTimeout(() => setActive(true), 500);
    }
  }, []);

  const updateRect = useCallback(() => {
    if (!active) return;
    const target = TOUR_STEPS[step]?.target;
    if (!target) return;
    const el = document.querySelector(`[data-tour="${target}"]`);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [active, step]);

  useEffect(() => {
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [updateRect]);

  function next() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  function finish() {
    localStorage.setItem(STORAGE_KEY, "true");
    setActive(false);
    setStep(0);
  }

  if (!active) return null;

  const currentStep = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const padding = 8;

  // Spotlight clip-path
  const clipPath = rect
    ? `polygon(
        0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
        ${rect.left - padding}px ${rect.top - padding}px,
        ${rect.left - padding}px ${rect.bottom + padding}px,
        ${rect.right + padding}px ${rect.bottom + padding}px,
        ${rect.right + padding}px ${rect.top - padding}px,
        ${rect.left - padding}px ${rect.top - padding}px
      )`
    : undefined;

  // Position tooltip near the target
  let tooltipStyle: React.CSSProperties = {};
  if (rect) {
    const viewportWidth = window.innerWidth;
    const tooltipWidth = 320;

    // Vertical: below the target if there's room, otherwise above
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow > 200) {
      tooltipStyle.top = rect.bottom + padding + 12;
    } else {
      tooltipStyle.bottom = window.innerHeight - rect.top + padding + 12;
    }

    // Horizontal: center on target, clamped to viewport
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(16, Math.min(left, viewportWidth - tooltipWidth - 16));
    tooltipStyle.left = left;
  } else {
    // Fallback: center of screen
    tooltipStyle.top = "50%";
    tooltipStyle.left = "50%";
    tooltipStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999]"
      onClick={(e) => {
        if (e.target === overlayRef.current) finish();
      }}
    >
      {/* Overlay with spotlight cutout */}
      <div
        className="absolute inset-0 bg-black/60 transition-all duration-300"
        style={{ clipPath }}
      />

      {/* Spotlight border */}
      {rect && (
        <div
          className="absolute border-2 border-white/40 rounded-lg pointer-events-none transition-all duration-300"
          style={{
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute bg-card rounded-xl shadow-2xl border border-border p-5 w-80 transition-all duration-300"
        style={tooltipStyle}
      >
        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-3">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-nia-orange" : i < step ? "bg-nia-green" : "bg-surface-subtle"
              }`}
            />
          ))}
          <span className="text-[10px] text-text-muted ml-auto">
            {step + 1} of {TOUR_STEPS.length}
          </span>
        </div>

        <h3 className="text-base font-semibold text-foreground mb-1">
          {currentStep.title}
        </h3>
        <p className="text-sm text-text-muted mb-4">
          {currentStep.description}
        </p>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={finish}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-foreground border border-border rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="px-3 py-1.5 text-sm font-medium text-white bg-nia-dark-solid hover:bg-nia-grey-blue rounded-lg transition-colors"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Reset tour state so it can be restarted */
export function resetTour() {
  localStorage.removeItem(STORAGE_KEY);
}
