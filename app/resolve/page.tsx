"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";

type ComputedMetrics = {
  techAvgResolution: number | null;
  techSatisfaction: number | null;
  hrAvgResolution: number | null;
  hrSatisfaction: number | null;
  techTicketCount: number;
  hrTicketCount: number;
  techSentimentCount: number;
  hrSentimentCount: number;
};

function defaultMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h * 10) / 10}h`;
  return `${Math.round((h / 24) * 10) / 10}d`;
}

type Row = {
  label: string;
  value: number | null;
  display: string;
  basis: string;
  target: number;
  isHigherBetter: boolean;
};

function metricsToRows(m: ComputedMetrics): Row[] {
  return [
    {
      label: "Technology: Avg Resolution Time",
      value: m.techAvgResolution,
      display: m.techAvgResolution != null ? formatHours(m.techAvgResolution) : "—",
      basis: `${m.techTicketCount} ticket${m.techTicketCount !== 1 ? "s" : ""}`,
      target: 24,
      isHigherBetter: false,
    },
    {
      label: "Technology: Customer Satisfaction",
      value: m.techSatisfaction,
      display: m.techSatisfaction != null ? `${m.techSatisfaction}/5` : "—",
      basis: `${m.techSentimentCount} response${m.techSentimentCount !== 1 ? "s" : ""}`,
      target: 4.5,
      isHigherBetter: true,
    },
    {
      label: "HR: Avg Resolution Time",
      value: m.hrAvgResolution,
      display: m.hrAvgResolution != null ? formatHours(m.hrAvgResolution) : "—",
      basis: `${m.hrTicketCount} ticket${m.hrTicketCount !== 1 ? "s" : ""}`,
      target: 24,
      isHigherBetter: false,
    },
    {
      label: "HR: Customer Satisfaction",
      value: m.hrSatisfaction,
      display: m.hrSatisfaction != null ? `${m.hrSatisfaction}/5` : "—",
      basis: `${m.hrSentimentCount} response${m.hrSentimentCount !== 1 ? "s" : ""}`,
      target: 4.5,
      isHigherBetter: true,
    },
  ];
}

function statusColor(row: Row) {
  if (row.value == null) return "text-text-tertiary";
  const meetsTarget = row.isHigherBetter
    ? row.value >= row.target
    : row.value <= row.target;
  return meetsTarget ? "text-nia-green" : "text-amber-500";
}

export default function ResolveSyncPage() {
  const [month, setMonth] = useState(defaultMonth);
  const [preview, setPreview] = useState<ComputedMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadPreview() {
    setLoading(true);
    setPreview(null);
    setSuccessMsg(null);
    setErrorMsg(null);
    const res = await fetch(`/api/resolve/sync?month=${month}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setErrorMsg(json.error ?? "Failed to load preview.");
      return;
    }
    setPreview(json.metrics);
  }

  async function syncToHub() {
    setSyncing(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    const res = await fetch("/api/resolve/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const json = await res.json();
    setSyncing(false);
    if (!res.ok) {
      setErrorMsg(json.error ?? "Sync failed.");
      return;
    }
    if (json.synced === 0) {
      setSuccessMsg("Nothing to sync — no data available for this month.");
    } else {
      setSuccessMsg(
        `${json.synced} metric entr${json.synced !== 1 ? "ies" : "y"} written to Hub for ${month}.`
      );
    }
  }

  const rows = preview ? metricsToRows(preview) : [];
  const hasData = rows.some((r) => r.value != null);

  return (
    <div className="min-h-screen bg-surface p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-xs text-text-tertiary hover:text-nia-dark transition-colors mb-3 inline-block"
          >
            ← Back to Hub
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-teal-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-nia-dark">Resolve → Hub Sync</h1>
          </div>
          <p className="text-sm text-text-secondary">
            Pull monthly help desk metrics from Resolve into Hub process measurements.
          </p>
        </div>

        {/* Month picker */}
        <Card padding="md" className="mb-4">
          <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
            Month to sync
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setPreview(null);
                setSuccessMsg(null);
                setErrorMsg(null);
              }}
              className="border border-border-subtle rounded-lg px-3 py-2 text-sm text-gray-900 bg-surface focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={loadPreview}
              disabled={loading}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Loading…" : "Preview"}
            </button>
          </div>
        </Card>

        {/* Error */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
            {errorMsg}
          </div>
        )}

        {/* Success */}
        {successMsg && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-700 mb-4">
            ✓ {successMsg}
          </div>
        )}

        {/* Preview table */}
        {preview && (
          <Card padding="md" className="mb-4">
            <h2 className="text-sm font-semibold text-nia-dark mb-3">
              Preview —{" "}
              {new Date(`${month}-15`).toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-tertiary border-b border-border-subtle">
                  <th className="pb-2 font-medium">Metric</th>
                  <th className="pb-2 font-medium text-right">Value</th>
                  <th className="pb-2 font-medium text-right">Target</th>
                  <th className="pb-2 font-medium text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td className="py-2.5 text-text-secondary">{row.label}</td>
                    <td className={`py-2.5 text-right font-semibold ${statusColor(row)}`}>
                      {row.display}
                    </td>
                    <td className="py-2.5 text-right text-text-tertiary">
                      {row.isHigherBetter ? `≥ ${row.target}` : `≤ ${row.target}h`}
                    </td>
                    <td className="py-2.5 text-right text-text-tertiary text-xs">{row.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {hasData ? (
              <button
                onClick={syncToHub}
                disabled={syncing}
                className="mt-4 w-full py-2.5 bg-nia-dark-solid text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {syncing ? "Syncing…" : `Sync ${month} to Hub`}
              </button>
            ) : (
              <p className="mt-4 text-xs text-text-tertiary text-center">
                No data available for this month — nothing to sync.
              </p>
            )}
          </Card>
        )}

        {/* Legend */}
        <div className="text-xs text-text-tertiary space-y-1.5 mt-2">
          <p>• Resolution time uses tickets <em>created</em> this month that are already resolved.</p>
          <p>• Satisfaction uses survey responses on tickets created this month.</p>
          <p>• Re-syncing overwrites previous entries for the same month.</p>
          <p>
            • View synced data on the{" "}
            <Link href="/processes" className="underline hover:text-nia-dark transition-colors">
              Processes
            </Link>{" "}
            page under Technology Support and HR Support.
          </p>
        </div>
      </div>
    </div>
  );
}
