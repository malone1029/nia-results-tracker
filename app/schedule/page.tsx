"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStatus, getStatusColor, getStatusLabel } from "@/lib/review-status";
import type { Metric } from "@/lib/types";
import Link from "next/link";

interface MetricRow extends Metric {
  process_name: string;
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

  useEffect(() => {
    async function fetch() {
      const { data: metricsData } = await supabase
        .from("metrics")
        .select(`
          *,
          processes!inner (
            name,
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

  // Group by cadence
  const grouped = new Map<string, MetricRow[]>();
  for (const cadence of CADENCE_ORDER) {
    grouped.set(cadence, []);
  }
  for (const metric of metrics) {
    const list = grouped.get(metric.cadence);
    if (list) list.push(metric);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#324a4d]">Review Schedule</h1>
        <p className="text-gray-500 mt-1">
          Metrics organized by how often they need to be reviewed
        </p>
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
                <div className="text-xs text-red-600 mt-1">
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

        return (
          <div key={cadence} id={cadence}>
            <div className="flex items-baseline gap-3 mb-1">
              <h2 className="text-lg font-bold text-[#324a4d]">
                {CADENCE_LABELS[cadence]}
              </h2>
              <span className="text-sm text-gray-400">
                {list.length} metric{list.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              {CADENCE_DESCRIPTIONS[cadence]}
            </p>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#324a4d] text-white text-left">
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Metric</th>
                    <th className="px-4 py-2">Process</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2 text-right">Last Value</th>
                    <th className="px-4 py-2 text-right">Last Logged</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((metric) => (
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
                      <td className="px-4 py-2 text-gray-500">{metric.process_name}</td>
                      <td className="px-4 py-2 text-gray-400">{metric.data_source || "—"}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {metric.last_entry_value !== null
                          ? `${metric.last_entry_value}${metric.unit === "%" ? "%" : ` ${metric.unit}`}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400">
                        {metric.last_entry_date || "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
