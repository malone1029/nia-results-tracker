"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getTrendDirection } from "@/lib/review-status";
import type { Metric } from "@/lib/types";
import Link from "next/link";

interface MetricLeTCI extends Metric {
  process_name: string;
  category_display_name: string;
  category_sort_order: number;
  entry_count: number;
  has_level: boolean;
  has_trend: boolean;
  trend_direction: "improving" | "declining" | "flat" | "insufficient";
  has_comparison: boolean;
  has_integration: boolean; // always true
  letci_score: number; // 0-4
}

export default function LeTCIPage() {
  const [metrics, setMetrics] = useState<MetricLeTCI[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("letci_score");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    document.title = "LeTCI Summary | NIA Results Tracker";
    async function fetch() {
      const { data: metricsData } = await supabase
        .from("metrics")
        .select(`
          *,
          processes!inner (
            name,
            categories!inner ( display_name, sort_order )
          )
        `);

      const { data: entriesData } = await supabase
        .from("entries")
        .select("metric_id, value, date")
        .order("date", { ascending: true });

      // Group entries by metric
      const entriesByMetric = new Map<number, { value: number; date: string }[]>();
      if (entriesData) {
        for (const entry of entriesData) {
          if (!entriesByMetric.has(entry.metric_id)) {
            entriesByMetric.set(entry.metric_id, []);
          }
          entriesByMetric.get(entry.metric_id)!.push({
            value: entry.value,
            date: entry.date,
          });
        }
      }

      const rows: MetricLeTCI[] = (metricsData || []).map((m: Record<string, unknown>) => {
        const process = m.processes as Record<string, unknown>;
        const category = process.categories as Record<string, unknown>;
        const entries = entriesByMetric.get(m.id as number) || [];
        const values = entries.map((e) => e.value);

        const hasLevel = entries.length >= 1;
        const hasTrend = entries.length >= 3;
        const hasComparison = m.comparison_value !== null;
        const hasIntegration = true;
        const trendDir = getTrendDirection(values, m.is_higher_better as boolean);

        return {
          ...(m as unknown as Metric),
          process_name: process.name as string,
          category_display_name: category.display_name as string,
          category_sort_order: category.sort_order as number,
          entry_count: entries.length,
          has_level: hasLevel,
          has_trend: hasTrend,
          trend_direction: trendDir,
          has_comparison: hasComparison,
          has_integration: hasIntegration,
          letci_score: [hasLevel, hasTrend, hasComparison, hasIntegration].filter(Boolean).length,
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
        <div className="text-[#55787c] text-lg">Loading LeTCI summary...</div>
      </div>
    );
  }

  // Get unique categories for filter
  const categoryOptions = Array.from(
    new Set(metrics.map((m) => m.category_display_name))
  ).sort();

  // Filter
  const filtered =
    filterCategory === "all"
      ? metrics
      : metrics.filter((m) => m.category_display_name === filterCategory);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "process":
        cmp = a.process_name.localeCompare(b.process_name);
        break;
      case "category":
        cmp = a.category_sort_order - b.category_sort_order;
        break;
      case "letci_score":
        cmp = a.letci_score - b.letci_score;
        break;
      case "level":
        cmp = Number(a.has_level) - Number(b.has_level);
        break;
      case "trend":
        cmp = Number(a.has_trend) - Number(b.has_trend);
        break;
      case "comparison":
        cmp = Number(a.has_comparison) - Number(b.has_comparison);
        break;
      default:
        cmp = a.letci_score - b.letci_score;
    }
    return sortAsc ? cmp : -cmp;
  });

  // Summary counts
  const total = filtered.length;
  const withLevel = filtered.filter((m) => m.has_level).length;
  const withTrend = filtered.filter((m) => m.has_trend).length;
  const withComparison = filtered.filter((m) => m.has_comparison).length;
  const withIntegration = filtered.filter((m) => m.has_integration).length;
  const fullLeTCI = filtered.filter((m) => m.letci_score === 4).length;

  function handleSort(field: string) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  function SortHeader({ field, label }: { field: string; label: string }) {
    const isActive = sortField === field;
    return (
      <th
        className="px-3 py-2 cursor-pointer hover:text-[#f79935] transition-colors select-none"
        onClick={() => handleSort(field)}
      >
        {label} {isActive ? (sortAsc ? "▲" : "▼") : ""}
      </th>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#324a4d]">LeTCI Summary</h1>
        <p className="text-gray-500 mt-1">
          Baldrige readiness across all metrics — Levels, Trends, Comparisons, Integration
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-[#324a4d]">{total}</div>
          <div className="text-xs text-gray-400">Total Metrics</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-[#b1bd37]">{withLevel}</div>
          <div className="text-xs text-gray-400">Have Levels</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: withTrend > 0 ? "#b1bd37" : "#dc2626" }}>
            {withTrend}
          </div>
          <div className="text-xs text-gray-400">Have Trends</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: withComparison > 0 ? "#b1bd37" : "#dc2626" }}>
            {withComparison}
          </div>
          <div className="text-xs text-gray-400">Have Comparisons</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-[#b1bd37]">{withIntegration}</div>
          <div className="text-xs text-gray-400">Have Integration</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center border-2 border-[#b1bd37]">
          <div className="text-2xl font-bold text-[#b1bd37]">{fullLeTCI}</div>
          <div className="text-xs text-gray-400">Full LeTCI (4/4)</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-[#324a4d]">Filter by category:</label>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#55787c]"
        >
          <option value="all">All Categories</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-400">
          Click column headers to sort
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#324a4d] text-white text-left text-xs uppercase">
                <SortHeader field="name" label="Metric" />
                <SortHeader field="process" label="Process" />
                <SortHeader field="category" label="Category" />
                <SortHeader field="level" label="Level" />
                <SortHeader field="trend" label="Trend" />
                <SortHeader field="comparison" label="Comparison" />
                <th className="px-3 py-2">Integration</th>
                <SortHeader field="letci_score" label="Score" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((metric) => (
                <tr key={metric.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/metric/${metric.id}`}
                      className="text-[#324a4d] font-medium hover:text-[#f79935] transition-colors"
                    >
                      {metric.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{metric.process_name}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{metric.category_display_name}</td>
                  <td className="px-3 py-2 text-center">
                    <LetciDot ready={metric.has_level} detail={`${metric.entry_count} entries`} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <LetciDot
                      ready={metric.has_trend}
                      detail={
                        metric.has_trend
                          ? metric.trend_direction
                          : `${metric.entry_count}/3 needed`
                      }
                      trendDirection={metric.has_trend ? metric.trend_direction : undefined}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <LetciDot
                      ready={metric.has_comparison}
                      detail={
                        metric.has_comparison
                          ? `${metric.comparison_value} (${metric.comparison_source})`
                          : "Not set"
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <LetciDot ready={metric.has_integration} detail={metric.process_name} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm"
                      style={{
                        backgroundColor:
                          metric.letci_score === 4
                            ? "#b1bd37"
                            : metric.letci_score >= 2
                              ? "#f79935"
                              : "#dc2626",
                      }}
                    >
                      {metric.letci_score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LetciDot({
  ready,
  detail,
  trendDirection,
}: {
  ready: boolean;
  detail: string;
  trendDirection?: "improving" | "declining" | "flat" | "insufficient";
}) {
  const trendColors: Record<string, string> = {
    improving: "#b1bd37",
    declining: "#dc2626",
    flat: "#55787c",
  };

  return (
    <div className="flex flex-col items-center gap-0.5" title={detail}>
      <div
        className="w-4 h-4 rounded-full"
        style={{
          backgroundColor: ready
            ? trendDirection
              ? trendColors[trendDirection] || "#b1bd37"
              : "#b1bd37"
            : "#e5e7eb",
        }}
      />
      <span className="text-[10px] text-gray-400 leading-tight">
        {trendDirection && ready ? trendDirection.slice(0, 3) : ""}
      </span>
    </div>
  );
}
