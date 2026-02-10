"use client";

import { useState } from "react";
import { PDCA_SECTIONS } from "@/lib/pdca";
import type { PdcaSection } from "@/lib/types";
import { FIELD_LABELS, type CoachSuggestion } from "@/lib/ai-parsers";

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string; border: string; cardBg: string }> = {
  "quick-win": { bg: "bg-nia-green/15", text: "text-nia-green", label: "Quick Win", border: "#b1bd37", cardBg: "rgba(177,189,55,0.04)" },
  "important": { bg: "bg-nia-orange/15", text: "text-nia-orange", label: "Important", border: "#f79935", cardBg: "rgba(247,153,53,0.04)" },
  "long-term": { bg: "bg-nia-grey-blue/15", text: "text-nia-grey-blue", label: "Long-term", border: "#55787c", cardBg: "rgba(85,120,124,0.04)" },
};

const EFFORT_LABELS: Record<string, string> = {
  minimal: "< 30 min",
  moderate: "1-2 hours",
  substantial: "Half day+",
};

export default function CoachSuggestionCard({
  suggestion,
  onApply,
  onTellMore,
  isApplying,
}: {
  suggestion: CoachSuggestion;
  onApply: () => void;
  onTellMore: () => void;
  isApplying: boolean;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const priority = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES["important"];
  const fieldLabel = FIELD_LABELS[suggestion.field] || suggestion.field;
  const effortLabel = EFFORT_LABELS[suggestion.effort] || suggestion.effort;

  // Build preview entries from content
  const previewEntries: { label: string; text: string }[] = [];
  if (typeof suggestion.content === "object") {
    for (const [key, value] of Object.entries(suggestion.content)) {
      previewEntries.push({ label: FIELD_LABELS[key] || key, text: value });
    }
  } else if (typeof suggestion.content === "string") {
    previewEntries.push({ label: fieldLabel, text: suggestion.content });
  }

  return (
    <div
      className="rounded-lg shadow-sm overflow-hidden border-l-4"
      style={{ borderLeftColor: priority.border, backgroundColor: priority.cardBg, borderTop: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}
    >
      {/* Header with badges */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
            {priority.label}
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {effortLabel}
          </span>
          <span className="text-xs text-gray-400 ml-auto">{fieldLabel}</span>
        </div>
        <p className="text-sm font-semibold text-nia-dark">{suggestion.title}</p>
      </div>

      {/* Why it matters + preview */}
      <div className="px-3 py-2 space-y-1.5">
        <p className="text-xs text-gray-600 italic">{suggestion.whyMatters}</p>
        <p className="text-xs text-gray-500">{suggestion.preview}</p>
        {/* Show affected fields for cleanup suggestions */}
        {suggestion.field === "charter_cleanup" && typeof suggestion.content === "object" && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.keys(suggestion.content).map((key) => (
              <span key={key} className="text-[10px] px-1.5 py-0.5 rounded bg-nia-grey-blue/10 text-nia-grey-blue font-medium">
                {FIELD_LABELS[key] || key}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content preview — expandable */}
      {previewEntries.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-nia-grey-blue hover:text-nia-dark transition-colors"
          >
            <span>{showPreview ? "Hide Preview" : "Preview Changes"}</span>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${showPreview ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showPreview && (
            <div className="px-3 pb-3 space-y-3">
              {previewEntries.map(({ label, text }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                  <div className="text-xs text-gray-700 bg-white rounded border border-gray-200 p-2 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {text.length > 800 ? text.slice(0, 800) + "\n\n..." : text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task preview — shows proposed PDCA tasks if present */}
      {suggestion.tasks && suggestion.tasks.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            Tasks ({suggestion.tasks.length})
          </p>
          <div className="space-y-1">
            {suggestion.tasks.map((task, idx) => {
              const section = PDCA_SECTIONS[task.pdcaSection as PdcaSection];
              return (
                <div key={idx} className="flex items-start gap-1.5">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 text-white"
                    style={{ backgroundColor: section?.color || "#6b7280" }}
                  >
                    {section?.label || task.pdcaSection}
                  </span>
                  <span className="text-xs text-gray-600">{task.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={onApply}
          disabled={isApplying}
          className="text-xs bg-nia-dark text-white rounded px-3 py-1.5 font-medium hover:bg-nia-grey-blue disabled:opacity-50 transition-colors"
        >
          {isApplying ? "Applying..." : suggestion.field === "charter_cleanup"
            ? `Clean Up${typeof suggestion.content === "object" ? ` ${Object.keys(suggestion.content).length} Sections` : ""}`
            : `Apply${suggestion.tasks?.length ? ` + Queue ${suggestion.tasks.length} Task${suggestion.tasks.length !== 1 ? "s" : ""}` : ""}`}
        </button>
        <button
          onClick={onTellMore}
          className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium px-2 py-1.5 transition-colors"
        >
          Tell Me More
        </button>
      </div>
    </div>
  );
}
