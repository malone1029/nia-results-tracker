"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStatus, getStatusColor, getStatusLabel } from "@/lib/review-status";
import type { Metric, Entry } from "@/lib/types";
import Link from "next/link";

interface MetricRow extends Metric {
  process_name: string;
  category_display_name: string;
  last_entry_date: string | null;
  last_entry_value: number | null;
  review_status: "current" | "due-soon" | "overdue" | "no-data";
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
  const [loading, setLoading] = useState(true);
  const [logForm, setLogForm] = useState<LogFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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
    if (entriesData) {
      for (const entry of entriesData) {
        if (!latestEntries.has(entry.metric_id)) {
          latestEntries.set(entry.metric_id, {
            value: entry.value,
            date: entry.date,
          });
        }
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
    setLoading(false);
  }

  useEffect(() => {
    fetchMetrics();
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

      {/* Inline log form */}
      {logForm && (
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-[#f79935]">
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
          onLogClick={(id) =>
            setLogForm({
              metricId: id,
              value: "",
              date: today,
              noteAnalysis: "",
              noteCourseCorrection: "",
            })
          }
        />
      )}

      {/* Due Soon section */}
      {dueSoon.length > 0 && (
        <MetricSection
          title="Due Soon"
          subtitle="These metrics are due for review within the next 7 days"
          metrics={dueSoon}
          onLogClick={(id) =>
            setLogForm({
              metricId: id,
              value: "",
              date: today,
              noteAnalysis: "",
              noteCourseCorrection: "",
            })
          }
        />
      )}

      {/* No Data section — collapsed by default */}
      {noData.length > 0 && (
        <MetricSection
          title="No Data Yet"
          subtitle="These metrics have never been logged"
          metrics={noData}
          defaultOpen={false}
          onLogClick={(id) =>
            setLogForm({
              metricId: id,
              value: "",
              date: today,
              noteAnalysis: "",
              noteCourseCorrection: "",
            })
          }
        />
      )}

      {/* Current section — collapsed by default */}
      {current.length > 0 && (
        <MetricSection
          title="Current"
          subtitle="These metrics are up to date"
          metrics={current}
          defaultOpen={false}
          onLogClick={(id) =>
            setLogForm({
              metricId: id,
              value: "",
              date: today,
              noteAnalysis: "",
              noteCourseCorrection: "",
            })
          }
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
  onLogClick,
  defaultOpen = true,
}: {
  title: string;
  subtitle: string;
  metrics: MetricRow[];
  onLogClick: (metricId: number) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
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
                {metric.last_entry_value !== null && (
                  <div className="text-right">
                    <div className="font-medium text-[#324a4d]">
                      {metric.last_entry_value}
                      {metric.unit === "%" ? "%" : ` ${metric.unit}`}
                    </div>
                    <div className="text-xs text-gray-400">
                      {metric.last_entry_date}
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
