"use client";

import { useEffect, useState } from "react";
import type { HealthResult } from "@/lib/process-health";

interface MilestoneToastProps {
  processId: number;
  processName: string;
  health: HealthResult | null;
  hasImprovements: boolean;
  hasAsanaLink: boolean;
  allMetricsCurrent: boolean; // true if all linked metrics have current data
}

interface ToastMessage {
  key: string;
  text: string;
}

// Check sessionStorage for already-shown milestones this session
function wasShown(processId: number, milestoneKey: string): boolean {
  try {
    const shown = JSON.parse(sessionStorage.getItem("milestones_shown") || "{}");
    return !!shown[`${processId}_${milestoneKey}`];
  } catch {
    return false;
  }
}

function markShown(processId: number, milestoneKey: string) {
  try {
    const shown = JSON.parse(sessionStorage.getItem("milestones_shown") || "{}");
    shown[`${processId}_${milestoneKey}`] = true;
    sessionStorage.setItem("milestones_shown", JSON.stringify(shown));
  } catch {
    // ignore
  }
}

export default function MilestoneToast({
  processId,
  processName,
  health,
  hasImprovements,
  hasAsanaLink,
  allMetricsCurrent,
}: MilestoneToastProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    if (!health) return;

    const newToasts: ToastMessage[] = [];
    const name = processName.length > 30 ? processName.slice(0, 30) + "..." : processName;

    // 1. Baldrige Ready (80+ health)
    if (health.total >= 80 && !wasShown(processId, "baldrige_ready")) {
      newToasts.push({
        key: "baldrige_ready",
        text: `${name} just hit Baldrige Ready status \u2014 great work!`,
      });
    }

    // 2. All ADLI sections completed (documentation = 25/25)
    if (health.dimensions.documentation.score === 25 && !wasShown(processId, "docs_complete")) {
      newToasts.push({
        key: "docs_complete",
        text: `All documentation complete for ${name} \u2014 well documented!`,
      });
    }

    // 3. First improvement cycle completed
    if (hasImprovements && !wasShown(processId, "first_improvement")) {
      newToasts.push({
        key: "first_improvement",
        text: `First improvement cycle completed for ${name}!`,
      });
    }

    // 4. Linked to Asana for the first time
    if (hasAsanaLink && !wasShown(processId, "asana_linked")) {
      newToasts.push({
        key: "asana_linked",
        text: `${name} is now linked to Asana \u2014 operations connected!`,
      });
    }

    // 5. All linked metrics have current data
    if (allMetricsCurrent && !wasShown(processId, "metrics_current")) {
      newToasts.push({
        key: "metrics_current",
        text: `All metrics are current for ${name} \u2014 data is flowing!`,
      });
    }

    if (newToasts.length > 0) {
      // Mark all as shown
      for (const t of newToasts) {
        markShown(processId, t.key);
      }
      // Show only the most impactful one (first match)
      setToasts([newToasts[0]]);

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => setToasts([]), 5000);
      return () => clearTimeout(timer);
    }
  }, [health, processId, processName, hasImprovements, hasAsanaLink, allMetricsCurrent]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 animate-slide-up">
      {toasts.map((toast) => (
        <div
          key={toast.key}
          className="flex items-center gap-3 bg-white border border-nia-green/30 rounded-xl shadow-lg px-5 py-3.5 max-w-sm"
        >
          <span className="text-xl flex-shrink-0">{"\u2728"}</span>
          <span className="text-sm text-nia-dark font-medium">{toast.text}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.key !== toast.key))}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0 ml-1"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
