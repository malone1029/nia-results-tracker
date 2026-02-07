"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStatus, getStatusColor, getStatusLabel } from "@/lib/review-status";
import type { Metric } from "@/lib/types";
import Link from "next/link";

interface MetricRow extends Metric {
  process_id: number;
  process_name: string;
  category_id: number;
  category_display_name: string;
  category_sort_order: number;
  last_entry_date: string | null;
  last_entry_value: number | null;
  review_status: "current" | "due-soon" | "overdue" | "no-data";
}

interface ProcessGroup {
  id: number;
  name: string;
  metrics: MetricRow[];
  withData: number;
  total: number;
}

interface CategoryGroup {
  id: number;
  display_name: string;
  sort_order: number;
  processes: ProcessGroup[];
  totalMetrics: number;
  totalWithData: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedProcesses, setExpandedProcesses] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetch() {
      const { data: metricsData } = await supabase
        .from("metrics")
        .select(`
          *,
          processes!inner (
            id,
            name,
            categories!inner ( id, display_name, sort_order )
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

      // Build metric rows
      const rows: MetricRow[] = (metricsData || []).map((m: Record<string, unknown>) => {
        const process = m.processes as Record<string, unknown>;
        const category = process.categories as Record<string, unknown>;
        const latest = latestEntries.get(m.id as number);
        return {
          ...(m as unknown as Metric),
          process_id: process.id as number,
          process_name: process.name as string,
          category_id: category.id as number,
          category_display_name: category.display_name as string,
          category_sort_order: category.sort_order as number,
          last_entry_date: latest?.date || null,
          last_entry_value: latest?.value || null,
          review_status: getReviewStatus(m.cadence as string, latest?.date || null),
        };
      });

      // Group by category, then by process
      const categoryMap = new Map<number, CategoryGroup>();

      for (const row of rows) {
        if (!categoryMap.has(row.category_id)) {
          categoryMap.set(row.category_id, {
            id: row.category_id,
            display_name: row.category_display_name,
            sort_order: row.category_sort_order,
            processes: [],
            totalMetrics: 0,
            totalWithData: 0,
          });
        }
        const cat = categoryMap.get(row.category_id)!;

        let proc = cat.processes.find((p) => p.id === row.process_id);
        if (!proc) {
          proc = {
            id: row.process_id,
            name: row.process_name,
            metrics: [],
            withData: 0,
            total: 0,
          };
          cat.processes.push(proc);
        }

        proc.metrics.push(row);
        proc.total++;
        cat.totalMetrics++;

        if (row.review_status !== "no-data") {
          proc.withData++;
          cat.totalWithData++;
        }
      }

      // Sort categories by sort_order, processes alphabetically
      const sorted = Array.from(categoryMap.values()).sort(
        (a, b) => a.sort_order - b.sort_order
      );
      for (const cat of sorted) {
        cat.processes.sort((a, b) => a.name.localeCompare(b.name));
        for (const proc of cat.processes) {
          const statusOrder = { overdue: 0, "no-data": 1, "due-soon": 2, current: 3 };
          proc.metrics.sort(
            (a, b) => statusOrder[a.review_status] - statusOrder[b.review_status]
          );
        }
      }

      setCategories(sorted);
      setLoading(false);
    }
    fetch();
  }, []);

  function toggleCategory(categoryId: number) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function toggleProcess(processId: number) {
    setExpandedProcesses((prev) => {
      const next = new Set(prev);
      if (next.has(processId)) {
        next.delete(processId);
      } else {
        next.add(processId);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#55787c] text-lg">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#324a4d]">Categories &amp; Processes</h1>
        <p className="text-gray-500 mt-1">
          Metrics organized by Baldrige Category and process
        </p>
      </div>

      {/* Category overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((cat) => (
          <a
            key={cat.id}
            href={`#cat-${cat.id}`}
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="text-xs text-gray-400 uppercase mb-1">
              Category {cat.sort_order}
            </div>
            <div className="font-bold text-[#324a4d] text-sm">{cat.display_name}</div>
            <div className="mt-2">
              <span className="text-lg font-bold text-[#324a4d]">
                {cat.totalWithData}
              </span>
              <span className="text-gray-400 text-sm"> / {cat.totalMetrics}</span>
            </div>
            <div className="text-xs text-gray-400">metrics with data</div>
          </a>
        ))}
      </div>

      {/* Category sections — collapsible */}
      {categories.map((cat) => {
        const isCatExpanded = expandedCategories.has(cat.id);
        const catNeedsAttention = cat.processes.reduce(
          (sum, proc) =>
            sum + proc.metrics.filter((m) => m.review_status === "overdue" || m.review_status === "due-soon").length,
          0
        );

        return (
          <div key={cat.id} id={`cat-${cat.id}`} className="space-y-4">
            {/* Category header — clickable to expand */}
            <button
              onClick={() => toggleCategory(cat.id)}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">
                  {isCatExpanded ? "▼" : "▶"}
                </span>
                <h2 className="text-lg font-bold text-[#324a4d] group-hover:text-[#f79935] transition-colors">
                  Category {cat.sort_order}: {cat.display_name}
                </h2>
                <span className="text-sm text-gray-400">
                  {cat.processes.length} process{cat.processes.length !== 1 ? "es" : ""} &middot;{" "}
                  {cat.totalWithData} of {cat.totalMetrics} metrics with data
                </span>
              </div>
              <div className="flex items-center gap-3">
                {catNeedsAttention > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                    {catNeedsAttention} need attention
                  </span>
                )}
                {/* Mini progress bar */}
                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${cat.totalMetrics > 0 ? (cat.totalWithData / cat.totalMetrics) * 100 : 0}%`,
                      backgroundColor: cat.totalWithData === cat.totalMetrics ? "#b1bd37" : "#f79935",
                    }}
                  />
                </div>
              </div>
            </button>

            {/* Expanded process list */}
            {isCatExpanded && cat.processes.map((proc) => {
              const isExpanded = expandedProcesses.has(proc.id);
              const needsAttention = proc.metrics.filter(
                (m) => m.review_status === "overdue" || m.review_status === "no-data"
              ).length;

              return (
                <div key={proc.id} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Process header — clickable to expand */}
                  <button
                    onClick={() => toggleProcess(proc.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm">
                        {isExpanded ? "▼" : "▶"}
                      </span>
                      <div>
                        <span className="font-medium text-[#324a4d]">{proc.name}</span>
                        <span className="text-sm text-gray-400 ml-3">
                          {proc.withData} of {proc.total} metrics with data
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {needsAttention > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                          {needsAttention} need attention
                        </span>
                      )}
                      {/* Mini progress bar */}
                      <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${proc.total > 0 ? (proc.withData / proc.total) * 100 : 0}%`,
                            backgroundColor: proc.withData === proc.total ? "#b1bd37" : "#f79935",
                          }}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Expanded metric list */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 text-left text-xs uppercase">
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Metric</th>
                            <th className="px-4 py-2">Cadence</th>
                            <th className="px-4 py-2">Source</th>
                            <th className="px-4 py-2 text-right">Last Value</th>
                            <th className="px-4 py-2 text-right">Target</th>
                            <th className="px-4 py-2 text-right">Last Logged</th>
                          </tr>
                        </thead>
                        <tbody>
                          {proc.metrics.map((metric) => (
                            <tr
                              key={metric.id}
                              className="border-t border-gray-50 hover:bg-gray-50"
                            >
                              <td className="px-4 py-2">
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{
                                    backgroundColor:
                                      getStatusColor(metric.review_status) + "20",
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
                              <td className="px-4 py-2 text-gray-500 capitalize">
                                {metric.cadence}
                              </td>
                              <td className="px-4 py-2 text-gray-400">
                                {metric.data_source || "—"}
                              </td>
                              <td className="px-4 py-2 text-right font-medium">
                                {metric.last_entry_value !== null
                                  ? `${metric.last_entry_value}${metric.unit === "%" ? "%" : ` ${metric.unit}`}`
                                  : "—"}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-400">
                                {metric.target_value !== null
                                  ? `${metric.target_value}${metric.unit === "%" ? "%" : ` ${metric.unit}`}`
                                  : "TBD"}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-400">
                                {metric.last_entry_date || "Never"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
