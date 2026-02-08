"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStatus, getStatusColor, getStatusLabel, formatDate } from "@/lib/review-status";
import type { Metric, Entry } from "@/lib/types";
import Link from "next/link";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface MetricRow extends Metric {
  process_name: string;
  category_display_name: string;
  last_entry_date: string | null;
  last_entry_value: number | null;
  review_status: "current" | "due-soon" | "overdue" | "no-data";
}

interface KeyProcessSummary {
  total: number;
  key: number;
  keyApproved: number;
  keyInProgress: number;
  keyDraft: number;
}

interface LogFormData {
  metricId: number;
  value: string;
  date: string;
  noteAnalysis: string;
  noteCourseCorrection: string;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [sparklineData, setSparklineData] = useState<Map<number, number[]>>(new Map());
  const [processSummary, setProcessSummary] = useState<KeyProcessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [logForm, setLogForm] = useState<LogFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const logFormRef = useRef<HTMLDivElement>(null);

  async function fetchMetrics() {
    // Fetch all metrics with their process and category names
    const { data: metricsData, error: metricsError } = await supabase
      .from("metrics")
      .select(`
        *,
        processes!inner (
          name,
          categories!inner (
            display_name
          )
        )
      `);

    if (metricsError) {
      console.error("Error fetching metrics:", metricsError);
      setLoading(false);
      return;
    }

    // Fetch the latest entry for each metric
    const { data: entriesData, error: entriesError } = await supabase
      .from("entries")
      .select("metric_id, value, date")
      .order("date", { ascending: false });

    if (entriesError) {
      console.error("Error fetching entries:", entriesError);
    }

    // Build a map of metric_id -> latest entry
    const latestEntries = new Map<number, { value: number; date: string }>();
    // Build sparkline data: last 6 values per metric in chronological order
    const sparklines = new Map<number, number[]>();
    if (entriesData) {
      for (const entry of entriesData) {
        if (!latestEntries.has(entry.metric_id)) {
          latestEntries.set(entry.metric_id, {
            value: entry.value,
            date: entry.date,
          });
        }
        // Collect up to 6 entries per metric (data is desc, so we reverse later)
        const existing = sparklines.get(entry.metric_id) || [];
        if (existing.length < 6) {
          existing.push(entry.value);
          sparklines.set(entry.metric_id, existing);
        }
      }
      // Reverse each array to chronological order (oldest first)
      for (const [id, values] of sparklines) {
        sparklines.set(id, values.reverse());
      }
    }

    // Combine metrics with their status
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
        review_status: getReviewStatus(
          m.cadence as string,
          latest?.date || null
        ),
      };
    });

    // Sort: overdue first, then due-soon, then no-data, then current
    const statusOrder = { overdue: 0, "due-soon": 1, "no-data": 2, current: 3 };
    rows.sort(
      (a, b) => statusOrder[a.review_status] - statusOrder[b.review_status]
    );

    setMetrics(rows);
    setSparklineData(sparklines);
    setLoading(false);
  }

  useEffect(() => {
    document.title = "Results Dashboard | NIA Excellence Hub";
    fetchMetrics();

    async function fetchProcessSummary() {
      const { data } = await supabase
        .from("processes")
        .select("is_key, status");
      if (data) {
        const all = data as { is_key: boolean; status: string }[];
        const keyProcs = all.filter((p) => p.is_key);
        setProcessSummary({
          total: all.length,
          key: keyProcs.length,
          keyApproved: keyProcs.filter((p) => p.status === "approved").length,
          keyInProgress: keyProcs.filter((p) =>
            ["ready_for_review", "in_review", "revisions_needed"].includes(p.status)
          ).length,
          keyDraft: keyProcs.filter((p) => p.status === "draft").length,
        });
      }
    }
    fetchProcessSummary();
  }, []);

  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!logForm) return;

    setSaving(true);
    const { error } = await supabase.from("entries").insert({
      metric_id: logForm.metricId,
      value: parseFloat(logForm.value),
      date: logForm.date,
      note_analysis: logForm.noteAnalysis || null,
      note_course_correction: logForm.noteCourseCorrection || null,
    });

    if (error) {
      console.error("Error saving entry:", error);
      alert("Failed to save: " + error.message);
    } else {
      setSuccessMessage(
        `Logged ${logForm.value} for ${metrics.find((m) => m.id === logForm.metricId)?.name}`
      );
      setLogForm(null);
      // Refresh the data
      await fetchMetrics();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    }
    setSaving(false);
  }

  function openLogForm(metricId: number) {
    setLogForm({
      metricId,
      value: "",
      date: new Date().toISOString().split("T")[0],
      noteAnalysis: "",
      noteCourseCorrection: "",
    });
    setTimeout(() => {
      logFormRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  const today = new Date().toISOString().split("T")[0];
  const overdue = metrics.filter((m) => m.review_status === "overdue");
  const dueSoon = metrics.filter((m) => m.review_status === "due-soon");
  const noData = metrics.filter((m) => m.review_status === "no-data");
  const current = metrics.filter((m) => m.review_status === "current");
  const needsTargets = metrics.filter((m) => m.target_value === null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#55787c] text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success message */}
      {successMessage && (
        <div className="bg-[#b1bd37]/20 border border-[#b1bd37] text-[#324a4d] px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Metrics" value={metrics.length} color="#324a4d" />
        <StatCard
          label="With Data"
          value={metrics.length - noData.length}
          color="#b1bd37"
        />
        <StatCard label="Due Soon" value={dueSoon.length} color="#f79935" />
        <StatCard label="Overdue" value={overdue.length} color="#dc2626" />
        <StatCard
          label="Need Targets"
          value={needsTargets.length}
          color="#55787c"
        />
      </div>

      {/* Key Process Summary */}
      {processSummary && processSummary.key > 0 && (
        <Link
          href="/processes"
          className="block bg-white rounded-lg shadow p-4 border-l-4 border-[#f79935] hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Key Processes
              </h2>
              <p className="text-[#324a4d] mt-1">
                <span className="text-2xl font-bold">{processSummary.key}</span>
                <span className="text-gray-400 text-sm"> of {processSummary.total} processes marked as key</span>
              </p>
            </div>
            <div className="flex gap-4 text-center">
              {processSummary.keyApproved > 0 && (
                <div>
                  <div className="text-lg font-bold text-[#b1bd37]">{processSummary.keyApproved}</div>
                  <div className="text-xs text-gray-400">Approved</div>
                </div>
              )}
              {processSummary.keyInProgress > 0 && (
                <div>
                  <div className="text-lg font-bold text-[#f79935]">{processSummary.keyInProgress}</div>
                  <div className="text-xs text-gray-400">In Review</div>
                </div>
              )}
              {processSummary.keyDraft > 0 && (
                <div>
                  <div className="text-lg font-bold text-gray-400">{processSummary.keyDraft}</div>
                  <div className="text-xs text-gray-400">Draft</div>
                </div>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* Inline log form */}
      {logForm && (
        <div ref={logFormRef} className="bg-white rounded-lg shadow p-6 border-l-4 border-[#f79935]">
          <h3 className="font-bold text-[#324a4d] mb-4">
            Log Value:{" "}
            {metrics.find((m) => m.id === logForm.metricId)?.name}
          </h3>
          <form onSubmit={handleLogSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#324a4d] mb-1">
                  Value *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={logForm.value}
                  onChange={(e) =>
                    setLogForm({ ...logForm, value: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                  placeholder="Enter value"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#324a4d] mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={logForm.date}
                  onChange={(e) =>
                    setLogForm({ ...logForm, date: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#324a4d] mb-1">
                Analysis Note{" "}
                <span className="text-gray-400 font-normal">
                  (context or explanation)
                </span>
              </label>
              <input
                type="text"
                value={logForm.noteAnalysis}
                onChange={(e) =>
                  setLogForm({ ...logForm, noteAnalysis: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                placeholder="e.g., New survey methodology used this cycle"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#324a4d] mb-1">
                Course Correction{" "}
                <span className="text-gray-400 font-normal">
                  (action taken if missing target)
                </span>
              </label>
              <input
                type="text"
                value={logForm.noteCourseCorrection}
                onChange={(e) =>
                  setLogForm({
                    ...logForm,
                    noteCourseCorrection: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                placeholder="e.g., Added mandatory re-training for repeat offenders"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-[#324a4d] text-white rounded-lg py-2 px-4 hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Entry"}
              </button>
              <button
                type="button"
                onClick={() => setLogForm(null)}
                className="bg-gray-200 text-[#324a4d] rounded-lg py-2 px-4 hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Overdue section */}
      {overdue.length > 0 && (
        <MetricSection
          title="Overdue"
          subtitle="These metrics are past their review date"
          metrics={overdue}
          sparklineData={sparklineData}
          onLogClick={openLogForm}
          accent
        />
      )}

      {/* Due Soon section */}
      {dueSoon.length > 0 && (
        <MetricSection
          title="Due Soon"
          subtitle="These metrics are due for review within the next 7 days"
          metrics={dueSoon}
          sparklineData={sparklineData}
          onLogClick={openLogForm}
          accent
        />
      )}

      {/* All caught up empty state */}
      {overdue.length === 0 && dueSoon.length === 0 && (
        <div className="bg-[#b1bd37]/10 border border-[#b1bd37]/30 rounded-lg px-6 py-8 text-center">
          <div className="text-2xl mb-2">All caught up!</div>
          <p className="text-[#324a4d] text-sm">
            No metrics are overdue or due soon. Check back later or{" "}
            <Link href="/log" className="text-[#f79935] hover:underline font-medium">log new data</Link>.
          </p>
        </div>
      )}

      {/* No Data section — collapsed by default */}
      {noData.length > 0 && (
        <MetricSection
          title="No Data Yet"
          subtitle="These metrics have never been logged"
          metrics={noData}
          sparklineData={sparklineData}
          defaultOpen={false}
          onLogClick={openLogForm}
          accent
        />
      )}

      {/* Current section — collapsed by default */}
      {current.length > 0 && (
        <MetricSection
          title="Current"
          subtitle="These metrics are up to date"
          metrics={current}
          sparklineData={sparklineData}
          defaultOpen={false}
          onLogClick={openLogForm}
          accent
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 text-center">
      <div className="text-3xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function MetricSection({
  title,
  subtitle,
  metrics,
  sparklineData,
  onLogClick,
  defaultOpen = true,
  accent = false,
}: {
  title: string;
  subtitle: string;
  metrics: MetricRow[];
  sparklineData: Map<number, number[]>;
  onLogClick: (metricId: number) => void;
  defaultOpen?: boolean;
  accent?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${accent ? "border-l-4 border-[#f79935]" : ""}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">
            {isOpen ? "▼" : "▶"}
          </span>
          <div>
            <span className="text-lg font-bold text-[#324a4d]">{title}</span>
            <span className="text-sm text-gray-400 ml-3">
              {metrics.length} metric{metrics.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <span className="text-xs text-gray-400">{subtitle}</span>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 space-y-0">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className="px-4 py-3 flex items-center justify-between border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: getStatusColor(metric.review_status),
                  }}
                />
                <div>
                  <Link href={`/metric/${metric.id}`} className="font-medium text-[#324a4d] hover:text-[#f79935] transition-colors">
                    {metric.name}
                  </Link>
                  <div className="text-sm text-gray-500">
                    {metric.category_display_name} &middot; {metric.process_name}{" "}
                    &middot; {metric.cadence}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Sparkline
                  values={sparklineData.get(metric.id) || []}
                  isHigherBetter={metric.is_higher_better}
                />
                {metric.last_entry_value !== null && (
                  <div className="text-right">
                    <div className="font-medium text-[#324a4d]">
                      {metric.last_entry_value}
                      {metric.unit === "%" ? "%" : ` ${metric.unit}`}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(metric.last_entry_date)}
                    </div>
                  </div>
                )}
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor:
                      getStatusColor(metric.review_status) + "20",
                    color: getStatusColor(metric.review_status),
                  }}
                >
                  {getStatusLabel(metric.review_status)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLogClick(metric.id);
                  }}
                  className="bg-[#324a4d] text-white text-sm rounded-lg py-1.5 px-3 hover:opacity-90"
                >
                  Log Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Sparkline({ values, isHigherBetter }: { values: number[]; isHigherBetter: boolean }) {
  if (values.length < 2) {
    return <span className="text-gray-300 text-xs w-16 text-center inline-block">&mdash;</span>;
  }

  const first = values[0];
  const last = values[values.length - 1];
  const trend = last > first ? "up" : last < first ? "down" : "flat";
  const improving = (trend === "up" && isHigherBetter) || (trend === "down" && !isHigherBetter);
  const color = improving ? "#b1bd37" : trend === "flat" ? "#55787c" : "#dc2626";
  const data = values.map((v, i) => ({ i, v }));

  return (
    <div className="w-16 h-6 flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
