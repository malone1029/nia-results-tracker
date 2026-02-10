"use client";

import { useState } from "react";
import type { MetricSuggestion } from "@/lib/ai-parsers";

export default function MetricSuggestionCard({
  suggestion,
  onAction,
  isLoading,
}: {
  suggestion: MetricSuggestion;
  onAction: (edited?: Partial<MetricSuggestion>) => void;
  isLoading: boolean;
}) {
  const isCreate = suggestion.action === "create";
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(suggestion.name);
  const [unit, setUnit] = useState(suggestion.unit);
  const [cadence, setCadence] = useState(suggestion.cadence);
  const [targetValue, setTargetValue] = useState(
    suggestion.targetValue != null ? String(suggestion.targetValue) : ""
  );

  function handleConfirm() {
    if (isCreate) {
      onAction({
        name,
        unit,
        cadence,
        targetValue: targetValue ? parseFloat(targetValue) : null,
      });
    } else {
      onAction();
    }
  }

  return (
    <div
      className="rounded-lg shadow-sm overflow-hidden border-l-4"
      style={{
        borderLeftColor: "#b1bd37",
        backgroundColor: "rgba(177,189,55,0.04)",
        borderTop: "1px solid #e5e7eb",
        borderRight: "1px solid #e5e7eb",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-nia-green/15 text-nia-green">
            {isCreate ? "New Metric" : "Link Existing"}
          </span>
        </div>
        {!editing ? (
          <p className="text-sm font-semibold text-nia-dark">{suggestion.name}</p>
        ) : (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm font-semibold text-nia-dark w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-nia-green"
          />
        )}
      </div>

      {/* Details */}
      <div className="px-3 py-2 space-y-1.5">
        <p className="text-xs text-gray-600 italic">{suggestion.reason}</p>

        {!editing ? (
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            <span>Unit: <strong className="text-nia-dark">{suggestion.unit}</strong></span>
            <span>Cadence: <strong className="text-nia-dark">{suggestion.cadence}</strong></span>
            {suggestion.targetValue != null && (
              <span>Target: <strong className="text-nia-dark">{suggestion.targetValue}</strong></span>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unit</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-nia-green"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cadence</label>
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-nia-green bg-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target Value (optional)</label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="e.g. 95"
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-nia-green"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className="text-xs bg-nia-green text-white rounded px-3 py-1.5 font-medium hover:bg-nia-green/80 disabled:opacity-50 transition-colors"
        >
          {isLoading
            ? "Processing..."
            : isCreate
            ? "Create & Link"
            : "Link to Process"}
        </button>
        {isCreate && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium px-2 py-1.5 transition-colors"
          >
            Edit First
          </button>
        )}
        {isCreate && editing && (
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium px-2 py-1.5 transition-colors"
          >
            Cancel Edit
          </button>
        )}
      </div>
    </div>
  );
}
