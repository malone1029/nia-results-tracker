"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";

interface ClassificationResult {
  process_id: number;
  name: string;
  category: string;
  current_type: string;
  suggestion: "key" | "support";
  rationale: string;
}

type Status = "idle" | "loading" | "ready" | "applying" | "done" | "error";

export default function ClassifyProcessesCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  async function runClassification() {
    setStatus("loading");
    setResults([]);
    setSelected(new Set());
    setErrorMsg(null);
    setApplyMsg(null);

    try {
      const res = await fetch("/api/processes/classify", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Classification failed");
        setStatus("error");
        return;
      }

      const suggestions: ClassificationResult[] = data.suggestions || [];
      setResults(suggestions);

      // Pre-select processes where AI suggestion differs from current
      const diffIds = new Set(
        suggestions
          .filter((r) => r.suggestion !== r.current_type)
          .map((r) => r.process_id)
      );
      setSelected(diffIds);
      setStatus("ready");
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(results.map((r) => r.process_id)));
  }

  function selectChanged() {
    setSelected(
      new Set(
        results.filter((r) => r.suggestion !== r.current_type).map((r) => r.process_id)
      )
    );
  }

  async function applySelected() {
    if (selected.size === 0) return;
    setStatus("applying");
    setApplyMsg(null);

    const updates = results
      .filter((r) => selected.has(r.process_id))
      .map((r) => ({ processId: r.process_id, processType: r.suggestion }));

    try {
      const res = await fetch("/api/processes/bulk-update-type", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Apply failed");
        setStatus("ready");
        return;
      }

      setApplyMsg(
        `Updated ${data.summary.updated} of ${data.summary.total} processes.${
          data.summary.failed > 0 ? ` ${data.summary.failed} failed.` : ""
        }`
      );
      setStatus("done");
    } catch {
      setErrorMsg("Network error applying changes.");
      setStatus("ready");
    }
  }

  const changedCount = results.filter((r) => r.suggestion !== r.current_type).length;

  return (
    <Card padding="md">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-nia-orange/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-nia-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-nia-dark">Key Process Classifier</h2>
          <p className="text-sm text-text-tertiary mt-0.5">
            AI uses Baldrige 6.1/6.2 definitions to classify processes as Key or Support.
          </p>
        </div>
      </div>

      <Button
        onClick={runClassification}
        disabled={status === "loading" || status === "applying"}
        loading={status === "loading"}
        size="sm"
      >
        {status === "loading"
          ? "Classifying..."
          : status === "ready" || status === "done"
          ? "Re-run Classification"
          : "Run Classification"}
      </Button>

      {errorMsg && (
        <div className="mt-4 rounded-lg p-3 text-sm bg-nia-red/10 border border-nia-red/30 text-nia-red">
          {errorMsg}
        </div>
      )}

      {applyMsg && (
        <div className="mt-4 rounded-lg p-3 text-sm bg-nia-green/20 border border-nia-green text-nia-dark">
          {applyMsg}
        </div>
      )}

      {/* Results table */}
      {(status === "ready" || status === "applying" || status === "done") && results.length > 0 && (
        <div className="mt-4 space-y-3">
          {/* Summary + quick-select */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              {results.length} processes classified
              {changedCount > 0 && (
                <span className="ml-2 text-nia-orange font-medium">
                  ({changedCount} suggestions differ)
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={selectChanged}
                className="text-xs text-text-secondary hover:text-nia-dark transition-colors"
              >
                Select changed
              </button>
              <span className="text-text-muted">·</span>
              <button
                onClick={selectAll}
                className="text-xs text-text-secondary hover:text-nia-dark transition-colors"
              >
                Select all
              </button>
              <span className="text-text-muted">·</span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-text-secondary hover:text-nia-dark transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-hover border-b border-border">
                    <th className="w-8 py-2 px-3"></th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-text-secondary">Process</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-text-secondary hidden md:table-cell">Category</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-text-secondary">Current</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-text-secondary">AI Suggests</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-text-secondary hidden lg:table-cell">Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const changed = r.suggestion !== r.current_type;
                    const isSelected = selected.has(r.process_id);

                    return (
                      <tr
                        key={r.process_id}
                        onClick={() => toggleSelect(r.process_id)}
                        className={`border-b border-border-light last:border-0 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-nia-green/5"
                            : changed
                            ? "bg-amber-50/50"
                            : "hover:bg-surface-hover"
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(r.process_id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-border accent-nia-dark"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-medium text-nia-dark">
                          {r.name}
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary hidden md:table-cell">
                          {r.category}
                        </td>
                        <td className="py-2.5 px-3">
                          <TypeBadge type={r.current_type} />
                        </td>
                        <td className="py-2.5 px-3">
                          <TypeBadge type={r.suggestion} highlight={changed} />
                        </td>
                        <td className="py-2.5 px-3 text-text-tertiary text-xs max-w-xs hidden lg:table-cell">
                          <span className="line-clamp-2">{r.rationale}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Apply buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={applySelected}
              disabled={selected.size === 0 || status === "applying"}
              loading={status === "applying"}
              size="sm"
            >
              Apply Selected ({selected.size})
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function TypeBadge({ type, highlight }: { type: string; highlight?: boolean }) {
  const isKey = type === "key";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isKey
          ? highlight
            ? "bg-nia-dark text-white"
            : "bg-nia-dark/10 text-nia-dark"
          : highlight
          ? "bg-nia-orange text-white"
          : "bg-border text-text-secondary"
      }`}
    >
      {isKey ? "Key" : type === "support" ? "Support" : type || "Unclassified"}
    </span>
  );
}
