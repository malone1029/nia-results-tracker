"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStatus, getStatusColor, getStatusLabel, formatDate } from "@/lib/review-status";
import type { Metric } from "@/lib/types";
import Link from "next/link";

interface MetricRow extends Metric {
  process_name: string;
  is_key_process: boolean;
  category_display_name: string;
  last_entry_date: string | null;
  last_entry_value: number | null;
  review_status: "current" | "due-soon" | "overdue" | "no-data";
}

const CADENCE_ORDER = ["monthly", "quarterly", "semi-annual", "annual"] as const;
const CADENCE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  "semi-annual": "Semi-Annual",
  annual: "Annual",
};
const CADENCE_DESCRIPTIONS: Record<string, string> = {
  monthly: "Review these metrics every 30 days",
  quarterly: "Review these metrics every 90 days",
  "semi-annual": "Review these metrics every 6 months",
  annual: "Review these metrics once per fiscal year",
};

export default function SchedulePage() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKeyOnly, setShowKeyOnly] = useState(false);

  useEffect(() => {
    document.title = "Review Schedule | NIA Excellence Hub";
    async function fetch() {
      const { data: metricsData } = await supabase
        .from("metrics")
        .select(`
          *,
          processes!inner (
            name,
            is_key,
            categories!inner ( display_name )
          )
        `);

      const { data: entriesData } = await supabase
        .from("entries")
        .select("metric_id, value, date")
        .order("date", { ascending: false });

      const latestEntries = new Map<number, { value: number; date: string }>();
      if (entriesData) {
        for (const entry of entriesData) {
          if (!latestEntries.has(entry.metric_id)) {
            latestEntries.set(entry.metric_id, { value: entry.value, date: entry.date });
          }
        }
      }

      const rows: MetricRow[] = (metricsData || []).map((m: Record<string, unknown>) => {
        const process = m.processes as Record<string, unknown>;
        const category = process.categories as Record<string, unknown>;
        const latest = latestEntries.get(m.id as number);
        return {
          ...(m as unknown as Metric),
          process_name: process.name as string,
          is_key_process: process.is_key as boolean,
          category_display_name: category.display_name as string,
          last_entry_date: latest?.date || null,
          last_entry_value: latest?.value || null,
          review_status: getReviewStatus(m.cadence as string, latest?.date || null),
        };
      });

      setMetrics(rows);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#55787c] text-lg">Loading schedule...</div>
      </div>
    );
  }

  // Filter by key process if active
  const filteredMetrics = showKeyOnly
    ? metrics.filter((m) => m.is_key_process)
    : metrics;

  // Group by cadence
  const grouped = new Map<string, MetricRow[]>();
  for (const cadence of CADENCE_ORDER) {
    grouped.set(cadence, []);
  }
  for (const metric of filteredMetrics) {
    const list = grouped.get(metric.cadence);
    if (list) list.push(metric);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#324a4d]">Review Schedule</h1>
          <p className="text-gray-500 mt-1">
            Metrics organized by how often they need to be reviewed
          </p>
        </div>
        <button
          onClick={() => setShowKeyOnly(!showKeyOnly)}
          className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors self-start ${
            showKeyOnly
              ? "bg-[#f79935] text-white"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          {showKeyOnly ? "\u2605 Key Only" : "\u2606 Key Only"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CADENCE_ORDER.map((cadence) => {
          const list = grouped.get(cadence) || [];
          const needsAttention = list.filter(
            (m) => m.review_status === "overdue" || m.review_status === "no-data"
          ).length;
          return (
            <a
              key={cadence}
              href={`#${cadence}`}
              className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md transition-shadow"
            >
              <div className="text-2xl font-bold text-[#324a4d]">{list.length}</div>
              <div className="text-sm font-medium text-[#55787c]">
                {CADENCE_LABELS[cadence]}
              </div>
              {needsAttention > 0 && (
                <div className="text-xs text-[#f79935] font-medium mt-1">
                  {needsAttention} need attention
                </div>
              )}
            </a>
          );
        })}
      </div>

      {/* Cadence sections */}
      {CADENCE_ORDER.map((cadence) => {
        const list = grouped.get(cadence) || [];
        if (list.length === 0) return null;

        // Sort: overdue/no-data first, then due-soon, then current
        const statusOrder = { overdue: 0, "no-data": 1, "due-soon": 2, current: 3 };
        list.sort((a, b) => statusOrder[a.review_status] - statusOrder[b.review_status]);

        const needsAttention = list.filter(
          (m) => m.review_status === "overdue" || m.review_status === "due-soon"
        ).length;

        return (
          <CadenceSection
            key={cadence}
            id={cadence}
            label={CADENCE_LABELS[cadence]}
            description={CADENCE_DESCRIPTIONS[cadence]}
            metrics={list}
            needsAttention={needsAttention}
            defaultOpen={false}
          />
        );
      })}
    </div>
  );
}

function CadenceSection({
  id,
  label,
  description,
  metrics,
  needsAttention,
  defaultOpen,
}: {
  id: string;
  label: string;
  description: string;
  metrics: MetricRow[];
  needsAttention: number;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div id={id} className="bg-white rounded-lg shadow overflow-hidden border-l-4 border-[#f79935]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">
            {isOpen ? "▼" : "▶"}
          </span>
          <div>
            <span className="text-lg font-bold text-[#324a4d]">{label}</span>
            <span className="text-sm text-gray-400 ml-3">
              {metrics.length} metric{metrics.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {needsAttention > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f79935]/10 text-[#f79935] font-medium">
              {needsAttention} need attention
            </span>
          )}
          <span className="text-xs text-gray-400">{description}</span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100">
          {/* Desktop table */}
          <table className="hidden md:table w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left text-xs uppercase">
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Metric</th>
                <th className="px-4 py-2">Process</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2 text-right">Last Value</th>
                <th className="px-4 py-2 text-right">Last Logged</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: getStatusColor(metric.review_status) + "20",
                        color: getStatusColor(metric.review_status),
                      }}
                    >
                      {getStatusLabel(metric.review_status)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/metric/${metric.id}`}
                      className="text-[#324a4d] font-medium hover:text-[#f79935] transition-colors"
                    >
                      {metric.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {metric.is_key_process && <span className="text-[#f79935] mr-1">&#9733;</span>}
                    {metric.process_name}
                  </td>
                  <td className="px-4 py-2 text-gray-400">{metric.data_source || "—"}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {metric.last_entry_value !== null
                      ? `${metric.last_entry_value}${metric.unit === "%" ? "%" : ` ${metric.unit}`}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-400">
                    {formatDate(metric.last_entry_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile stacked cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {metrics.map((metric) => (
              <div key={metric.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/metric/${metric.id}`}
                    className="text-[#324a4d] font-medium hover:text-[#f79935] transition-colors text-sm"
                  >
                    {metric.name}
                  </Link>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: getStatusColor(metric.review_status) + "20",
                      color: getStatusColor(metric.review_status),
                    }}
                  >
                    {getStatusLabel(metric.review_status)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
                  <span>
                    {metric.is_key_process && <span className="text-[#f79935] mr-0.5">&#9733;</span>}
                    {metric.process_name}
                  </span>
                  {metric.data_source && <span>{metric.data_source}</span>}
                  <span className="font-medium text-[#324a4d]">
                    {metric.last_entry_value !== null
                      ? `${metric.last_entry_value}${metric.unit === "%" ? "%" : ` ${metric.unit}`}`
                      : "No data"}
                  </span>
                  <span>{formatDate(metric.last_entry_date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
