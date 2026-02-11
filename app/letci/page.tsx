"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getTrendDirection } from "@/lib/review-status";
import { ListPageSkeleton } from "@/components/skeleton";
import type { Metric } from "@/lib/types";
import Link from "next/link";
import { Card, Button, Select } from "@/components/ui";

interface MetricLeTCI extends Metric {
  process_name: string;
  is_key_process: boolean;
  category_display_name: string;
  category_sort_order: number;
  entry_count: number;
  has_level: boolean;
  has_trend: boolean;
  trend_direction: "improving" | "declining" | "flat" | "insufficient";
  has_comparison: boolean;
  has_integration: boolean;
  linked_requirements: string[]; // requirement names
  letci_score: number; // 0-4
}

export default function LeTCIPage() {
  const [metrics, setMetrics] = useState<MetricLeTCI[]>([]);
  const [allCategoryOptions, setAllCategoryOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showKeyOnly, setShowKeyOnly] = useState(false);
  const [sortField, setSortField] = useState<string>("letci_score");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    document.title = "LeTCI Summary | NIA Excellence Hub";
    async function fetch() {
      // Fetch all Baldrige categories for the filter dropdown
      const { data: catData } = await supabase
        .from("categories")
        .select("display_name")
        .order("sort_order");

      if (catData) {
        setAllCategoryOptions(catData.map((c: { display_name: string }) => c.display_name));
      }

      // Fetch metrics, junction links, and processes separately
      const [metricsRes, linksRes, processesRes] = await Promise.all([
        supabase.from("metrics").select("*"),
        supabase.from("metric_processes").select("metric_id, process_id"),
        supabase.from("processes").select("id, name, is_key, categories!inner ( display_name, sort_order )"),
      ]);

      const metricsData = metricsRes.data;

      // Build process lookup
      const processMap = new Map<number, { name: string; is_key: boolean; category_display_name: string; category_sort_order: number }>();
      for (const p of (processesRes.data || []) as Record<string, unknown>[]) {
        const cat = p.categories as Record<string, unknown>;
        processMap.set(p.id as number, {
          name: p.name as string,
          is_key: p.is_key as boolean,
          category_display_name: cat.display_name as string,
          category_sort_order: cat.sort_order as number,
        });
      }

      // Build metric -> first linked process lookup (for display)
      const metricFirstProcess = new Map<number, { name: string; is_key: boolean; category_display_name: string; category_sort_order: number }>();
      for (const link of linksRes.data || []) {
        if (metricFirstProcess.has(link.metric_id)) continue;
        const proc = processMap.get(link.process_id);
        if (proc) metricFirstProcess.set(link.metric_id, proc);
      }

      const { data: entriesData } = await supabase
        .from("entries")
        .select("metric_id, value, date")
        .order("date", { ascending: true });

      // Fetch metric-requirement links with requirement names
      const { data: reqLinkData } = await supabase
        .from("metric_requirements")
        .select(`
          metric_id,
          key_requirements!inner ( requirement )
        `);

      // Build map of metric_id -> requirement names
      const reqsByMetric = new Map<number, string[]>();
      if (reqLinkData) {
        for (const link of reqLinkData) {
          const reqName = (link.key_requirements as unknown as { requirement: string }).requirement;
          if (!reqsByMetric.has(link.metric_id)) {
            reqsByMetric.set(link.metric_id, []);
          }
          reqsByMetric.get(link.metric_id)!.push(reqName);
        }
      }

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
        const proc = metricFirstProcess.get(m.id as number);
        const entries = entriesByMetric.get(m.id as number) || [];
        const values = entries.map((e) => e.value);

        const hasLevel = entries.length >= 1;
        const hasTrend = entries.length >= 3;
        const hasComparison = m.comparison_value !== null;
        const linkedReqs = reqsByMetric.get(m.id as number) || [];
        const hasIntegration = linkedReqs.length > 0;
        const trendDir = getTrendDirection(values, m.is_higher_better as boolean);

        return {
          ...(m as unknown as Metric),
          process_name: proc?.name || "Unlinked",
          is_key_process: proc?.is_key || false,
          category_display_name: proc?.category_display_name || "—",
          category_sort_order: proc?.category_sort_order || 99,
          entry_count: entries.length,
          has_level: hasLevel,
          has_trend: hasTrend,
          trend_direction: trendDir,
          has_comparison: hasComparison,
          has_integration: hasIntegration,
          linked_requirements: linkedReqs,
          letci_score: [hasLevel, hasTrend, hasComparison, hasIntegration].filter(Boolean).length,
        };
      });

      setMetrics(rows);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) return <ListPageSkeleton showStats statCount={6} />;

  // Use all categories from database (not just ones with metrics)
  const categoryOptions = allCategoryOptions;

  // Filter
  let filtered =
    filterCategory === "all"
      ? metrics
      : metrics.filter((m) => m.category_display_name === filterCategory);
  if (showKeyOnly) {
    filtered = filtered.filter((m) => m.is_key_process);
  }

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
      case "integration":
        cmp = Number(a.has_integration) - Number(b.has_integration);
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
        className="px-3 py-2 cursor-pointer hover:text-nia-orange transition-colors select-none"
        onClick={() => handleSort(field)}
      >
        {label} {isActive ? (sortAsc ? "▲" : "▼") : ""}
      </th>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-nia-dark">LeTCI Summary</h1>
        <p className="text-text-tertiary mt-1">
          Baldrige readiness across all metrics — Levels, Trends, Comparisons, Integration
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card variant="interactive" accent="dark" padding="sm" className="text-center">
          <div className="text-2xl font-bold font-display number-pop text-nia-dark">{total}</div>
          <div className="text-xs text-text-muted">Total Metrics</div>
        </Card>
        <Card variant="interactive" accent="green" padding="sm" className="text-center">
          <div className="text-2xl font-bold font-display number-pop text-nia-green">{withLevel}</div>
          <div className="text-xs text-text-muted">Have Levels</div>
        </Card>
        {[
          { val: withTrend, label: "Have Trends" },
          { val: withComparison, label: "Have Comparisons" },
          { val: withIntegration, label: "Have Integration" },
        ].map(({ val, label }) => (
          <Card key={label} variant="interactive" accent={val > 0 ? "green" : "red"} padding="sm" className="text-center">
            <div className={`text-2xl font-bold font-display number-pop ${val > 0 ? "text-nia-green" : "text-nia-red"}`}>{val}</div>
            <div className="text-xs text-text-muted">{label}</div>
          </Card>
        ))}
        <Card variant="interactive" accent="green" padding="sm" className="text-center">
          <div className="text-2xl font-bold font-display number-pop text-nia-green">{fullLeTCI}</div>
          <div className="text-xs text-text-muted">Full LeTCI (4/4)</div>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Button
          variant={showKeyOnly ? "accent" : "ghost"}
          size="sm"
          onClick={() => setShowKeyOnly(!showKeyOnly)}
        >
          {showKeyOnly ? "\u2605 Key Only" : "\u2606 Key Only"}
        </Button>
        <Select
          label=""
          size="sm"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-auto"
        >
          <option value="all">All Categories</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>
        <span className="text-sm text-text-muted">
          Click column headers to sort
        </span>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-nia-dark-solid text-white text-left text-xs uppercase">
                <SortHeader field="name" label="Metric" />
                <SortHeader field="process" label="Process" />
                <SortHeader field="category" label="Category" />
                <SortHeader field="level" label="Level" />
                <SortHeader field="trend" label="Trend" />
                <SortHeader field="comparison" label="Comparison" />
                <SortHeader field="integration" label="Integration" />
                <SortHeader field="letci_score" label="Score" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((metric) => (
                <tr key={metric.id} className="border-t border-border-light hover:bg-surface-hover">
                  <td className="px-3 py-2">
                    <Link
                      href={`/metric/${metric.id}`}
                      className="text-nia-dark font-medium hover:text-nia-orange transition-colors"
                    >
                      {metric.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-text-tertiary">
                    {metric.is_key_process && <span className="text-nia-orange mr-1">&#9733;</span>}
                    {metric.process_name}
                  </td>
                  <td className="px-3 py-2 text-text-muted text-xs">{metric.category_display_name}</td>
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
                    <div className="flex flex-col items-center gap-0.5">
                      <LetciDot
                        ready={metric.has_integration}
                        detail={metric.has_integration ? metric.linked_requirements.join(", ") : "Not yet integrated"}
                      />
                      {metric.has_integration && (
                        <Link
                          href="/requirements"
                          className="text-[10px] text-nia-grey-blue hover:text-nia-orange leading-tight"
                        >
                          {metric.linked_requirements.length} req{metric.linked_requirements.length !== 1 ? "s" : ""}
                        </Link>
                      )}
                    </div>
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
      </Card>
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
            : "var(--grid-line)",
        }}
      />
      <span className="text-[10px] text-text-muted leading-tight">
        {trendDirection && ready ? trendDirection.slice(0, 3) : ""}
      </span>
    </div>
  );
}
