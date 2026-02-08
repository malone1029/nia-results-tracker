"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStatus, getStatusColor, getStatusLabel, formatDate } from "@/lib/review-status";
import type { Metric } from "@/lib/types";
import Link from "next/link";

interface MetricRow extends Metric {
  process_id: number;
  process_name: string;
  is_key_process: boolean;
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
  is_key: boolean;
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

function groupByCategory(rows: MetricRow[]): CategoryGroup[] {
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
        is_key: row.is_key_process,
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

  return sorted;
}

export default function CategoriesPage() {
  const [allRows, setAllRows] = useState<MetricRow[]>([]);
  const [dbCategories, setDbCategories] = useState<{ id: number; display_name: string; sort_order: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKeyOnly, setShowKeyOnly] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [expandedProcesses, setExpandedProcesses] = useState<Set<number>>(new Set());

  useEffect(() => {
    document.title = "Categories | NIA Excellence Hub";
    async function fetch() {
      // Fetch all Baldrige categories from the table
      const { data: catData } = await supabase
        .from("categories")
        .select("id, display_name, sort_order")
        .order("sort_order");

      if (catData) {
        setDbCategories(catData);
      }

      const { data: metricsData } = await supabase
        .from("metrics")
        .select(`
          *,
          processes!inner (
            id,
            name,
            is_key,
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
          is_key_process: process.is_key as boolean,
          category_id: category.id as number,
          category_display_name: category.display_name as string,
          category_sort_order: category.sort_order as number,
          last_entry_date: latest?.date || null,
          last_entry_value: latest?.value || null,
          review_status: getReviewStatus(m.cadence as string, latest?.date || null),
        };
      });

      setAllRows(rows);
      setLoading(false);
    }
    fetch();
  }, []);

  // Derive categories from rows, applying key filter
  const filteredRows = showKeyOnly
    ? allRows.filter((r) => r.is_key_process)
    : allRows;
  const categoriesFromMetrics = groupByCategory(filteredRows);

  // Merge in empty categories from the database so all 6 Baldrige categories are visible
  const categories: CategoryGroup[] = dbCategories.map((dbCat) => {
    const existing = categoriesFromMetrics.find((c) => c.id === dbCat.id);
    if (existing) return existing;
    return {
      id: dbCat.id,
      display_name: dbCat.display_name,
      sort_order: dbCat.sort_order,
      processes: [],
      totalMetrics: 0,
      totalWithData: 0,
    };
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#324a4d]">Categories &amp; Processes</h1>
          <p className="text-gray-500 mt-1">
            Metrics organized by Baldrige Category and process
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

      {/* Category overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setExpandedCategories((prev) => {
                const next = new Set(prev);
                next.add(cat.id);
                return next;
              });
              setTimeout(() => {
                document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: "smooth" });
              }, 50);
            }}
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="text-xs text-gray-400 uppercase mb-1">
              Category {cat.sort_order}
            </div>
            <div className={`font-bold text-sm ${cat.totalMetrics === 0 ? "text-[#dc2626]" : "text-[#324a4d]"}`}>{cat.display_name}</div>
            {cat.totalMetrics === 0 ? (
              <div className="mt-2">
                <div className="text-lg font-bold text-[#dc2626]">0</div>
                <div className="text-xs text-[#dc2626]">No metrics</div>
              </div>
            ) : (
              <>
                <div className="mt-2">
                  <span className="text-lg font-bold text-[#324a4d]">
                    {cat.totalWithData}
                  </span>
                  <span className="text-gray-400 text-sm"> / {cat.totalMetrics}</span>
                </div>
                <div className="text-xs text-gray-400">metrics with data</div>
              </>
            )}
            {/* Progress bar */}
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${cat.totalMetrics > 0 ? (cat.totalWithData / cat.totalMetrics) * 100 : 0}%`,
                  backgroundColor: cat.totalWithData === cat.totalMetrics ? "#b1bd37" : "#f79935",
                }}
              />
            </div>
          </button>
        ))}
      </div>

      {/* Category sections — collapsible */}
      {categories.map((cat) => {
        const isCatExpanded = expandedCategories.has(cat.id);

        return (
          <div key={cat.id} id={`cat-${cat.id}`} className="bg-white rounded-lg shadow overflow-hidden border-l-4 border-[#f79935]">
            {/* Category header — clickable to expand */}
            <button
              onClick={() => toggleCategory(cat.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">
                  {isCatExpanded ? "▼" : "▶"}
                </span>
                <div>
                  <span className="text-lg font-bold text-[#324a4d]">
                    Category {cat.sort_order}: {cat.display_name}
                  </span>
                  <span className="text-sm text-gray-400 ml-3">
                    {cat.processes.length} process{cat.processes.length !== 1 ? "es" : ""} &middot;{" "}
                    {cat.totalWithData} of {cat.totalMetrics} metrics with data
                  </span>
                </div>
              </div>
            </button>

            {/* Expanded process list */}
            {isCatExpanded && (
              <div className="border-t border-gray-100 p-4 space-y-3">
                {cat.processes.length === 0 && (
                  <p className="text-sm text-gray-400 italic py-2">
                    No processes or metrics in this category yet. This is a gap to address.
                  </p>
                )}
                {cat.processes.map((proc) => {
                  const isExpanded = expandedProcesses.has(proc.id);
                  const needsAttention = proc.metrics.filter(
                    (m) => m.review_status === "overdue" || m.review_status === "no-data"
                  ).length;

                  return (
                    <div key={proc.id} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 border-l-4 border-l-[#f79935]">
                      {/* Process header — clickable to expand */}
                      <button
                        onClick={() => toggleProcess(proc.id)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-sm">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                          <span className="font-medium text-[#324a4d]">
                            {proc.is_key && <span className="text-[#f79935] mr-1">&#9733;</span>}
                            {proc.name}
                          </span>
                          <span className="text-sm text-gray-400">
                            {proc.withData} of {proc.total} metrics with data
                          </span>
                        </div>
                        {needsAttention > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#f79935]/10 text-[#f79935] font-medium">
                            {needsAttention} need attention
                          </span>
                        )}
                      </button>

                      {/* Expanded metric list */}
                      {isExpanded && (
                        <div className="border-t border-gray-200">
                          {/* Desktop table */}
                          <table className="hidden md:table w-full text-sm">
                            <thead>
                              <tr className="bg-gray-100 text-gray-500 text-left text-xs uppercase">
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
                                  className="border-t border-gray-200 hover:bg-gray-100"
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
                                    {formatDate(metric.last_entry_date)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {/* Mobile stacked cards */}
                          <div className="md:hidden divide-y divide-gray-200">
                            {proc.metrics.map((metric) => (
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
                                  <span className="capitalize">{metric.cadence}</span>
                                  {metric.data_source && <span>{metric.data_source}</span>}
                                  <span className="font-medium text-[#324a4d]">
                                    {metric.last_entry_value !== null
                                      ? `${metric.last_entry_value}${metric.unit === "%" ? "%" : ` ${metric.unit}`}`
                                      : "No data"}
                                    {metric.target_value !== null && (
                                      <span className="text-gray-400 font-normal"> / {metric.target_value}{metric.unit === "%" ? "%" : ` ${metric.unit}`}</span>
                                    )}
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
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
