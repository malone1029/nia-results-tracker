"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DetailSkeleton } from "@/components/skeleton";
import {
  getReviewStatus,
  getStatusColor,
  getStatusLabel,
  toFiscalYear,
  getTrendDirection,
  formatDate,
  formatValue,
} from "@/lib/review-status";
import type { Metric, Entry } from "@/lib/types";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface MetricDetail extends Metric {
  process_name: string;
  category_display_name: string;
}

export default function MetricDetailPage() {
  const params = useParams();
  const metricId = Number(params.id);

  const [metric, setMetric] = useState<MetricDetail | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [linkedRequirements, setLinkedRequirements] = useState<{ id: number; requirement: string; stakeholder_group: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Log form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [logValue, setLogValue] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logAnalysis, setLogAnalysis] = useState("");
  const [logCorrection, setLogCorrection] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  async function fetchData() {
    const { data: metricData } = await supabase
      .from("metrics")
      .select(`
        *,
        processes!inner (
          name,
          categories!inner ( display_name )
        )
      `)
      .eq("id", metricId)
      .single();

    if (metricData) {
      const process = metricData.processes as Record<string, unknown>;
      const category = process.categories as Record<string, unknown>;
      const name = metricData.name as string;
      document.title = `${name} | NIA Excellence Hub`;
      setMetric({
        ...(metricData as unknown as Metric),
        process_name: process.name as string,
        category_display_name: category.display_name as string,
      });
    }

    const { data: entriesData } = await supabase
      .from("entries")
      .select("*")
      .eq("metric_id", metricId)
      .order("date", { ascending: true });

    setEntries(entriesData || []);

    // Fetch linked requirements for LeTCI Integration
    const { data: reqLinks } = await supabase
      .from("metric_requirements")
      .select(`
        requirement_id,
        key_requirements!inner ( id, requirement, stakeholder_group )
      `)
      .eq("metric_id", metricId);

    if (reqLinks) {
      setLinkedRequirements(
        reqLinks.map((link) => {
          const req = link.key_requirements as unknown as { id: number; requirement: string; stakeholder_group: string };
          return req;
        })
      );
    } else {
      setLinkedRequirements([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [metricId]);

  async function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("entries").insert({
      metric_id: metricId,
      value: parseFloat(logValue),
      date: logDate,
      note_analysis: logAnalysis || null,
      note_course_correction: logCorrection || null,
    });

    if (error) {
      alert("Failed to save: " + error.message);
    } else {
      setSuccessMessage("Entry saved successfully");
      setShowLogForm(false);
      setLogValue("");
      setLogAnalysis("");
      setLogCorrection("");
      await fetchData();
      setTimeout(() => setSuccessMessage(""), 3000);
    }
    setSaving(false);
  }

  async function handleDeleteEntry(entryId: number) {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    const { error } = await supabase.from("entries").delete().eq("id", entryId);
    if (error) {
      alert("Failed to delete: " + error.message);
    } else {
      await fetchData();
    }
  }

  if (loading) return <DetailSkeleton sections={3} />;

  if (!metric) {
    return (
      <div className="text-center py-20">
        <div className="text-red-600 text-lg">Metric not found</div>
        <Link href="/" className="text-[#55787c] hover:underline mt-2 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const reviewStatus = getReviewStatus(metric.cadence, lastEntry?.date || null);
  const values = entries.map((e) => e.value);
  const trendDirection = getTrendDirection(values, metric.is_higher_better);

  // Chart data
  const chartData = entries.map((e) => ({
    date: e.date,
    label: toFiscalYear(e.date),
    value: e.value,
  }));

  // LeTCI assessment
  const letci = {
    level: entries.length >= 1,
    trend: entries.length >= 3,
    comparison: metric.comparison_value !== null,
    integration: linkedRequirements.length > 0,
  };
  const letciCount = [letci.level, letci.trend, letci.comparison, letci.integration].filter(Boolean).length;

  // Trend display
  const trendEmoji: Record<string, string> = {
    improving: "↑",
    declining: "↓",
    flat: "→",
    insufficient: "—",
  };
  const trendColor: Record<string, string> = {
    improving: "#b1bd37",
    declining: "#dc2626",
    flat: "#55787c",
    insufficient: "#9ca3af",
  };

  return (
    <div className="space-y-6">
      {/* Success message */}
      {successMessage && (
        <div className="bg-[#b1bd37]/20 border border-[#b1bd37] text-[#324a4d] px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <Link href="/" className="hover:text-[#55787c]">
          Dashboard
        </Link>
        {" / "}
        <Link href="/categories" className="hover:text-[#55787c]">
          {metric.category_display_name}
        </Link>
        {" / "}
        <span className="text-[#324a4d]">{metric.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#324a4d]">{metric.name}</h1>
            <p className="text-gray-500 mt-1">
              {metric.category_display_name} &middot; {metric.process_name}
            </p>
            {metric.description && (
              <p className="text-sm text-gray-400 mt-2">{metric.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{
                backgroundColor: getStatusColor(reviewStatus) + "20",
                color: getStatusColor(reviewStatus),
              }}
            >
              {getStatusLabel(reviewStatus)}
            </span>
            <Link
              href={`/metric/${metricId}/edit`}
              className="bg-gray-200 text-[#324a4d] text-sm rounded-lg py-2 px-4 hover:bg-gray-300 inline-flex items-center"
            >
              Edit
            </Link>
            <button
              onClick={() => setShowLogForm(!showLogForm)}
              className="bg-[#324a4d] text-white text-sm rounded-lg py-2 px-4 hover:opacity-90"
            >
              Log New Value
            </button>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase">Cadence</div>
            <div className="font-medium text-[#324a4d] capitalize">{metric.cadence}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase">Last Value</div>
            <div className="font-medium text-[#324a4d]">
              {lastEntry ? formatValue(lastEntry.value, metric.unit) : "—"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase">Target</div>
            <div className="font-medium text-[#324a4d]">
              {metric.target_value !== null
                ? formatValue(metric.target_value, metric.unit)
                : "Not set"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase">Trend</div>
            <div className="font-medium" style={{ color: trendColor[trendDirection] }}>
              {trendEmoji[trendDirection]} {trendDirection === "insufficient" ? "Need 3+ points" : trendDirection}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase">Data Source</div>
            <div className="font-medium text-[#324a4d] text-sm">{metric.data_source || "—"}</div>
          </div>
        </div>

        {/* Target nudge */}
        {metric.target_value === null && (
          <div className="mt-4 bg-[#f79935]/10 border border-[#f79935]/30 rounded-lg px-4 py-3 text-sm text-[#324a4d] flex items-center justify-between">
            <span>No target set — setting a target helps evaluate whether results are meeting expectations.</span>
            <Link
              href={`/metric/${metricId}/edit`}
              className="text-[#f79935] font-medium hover:underline whitespace-nowrap ml-4"
            >
              Set Target
            </Link>
          </div>
        )}
      </div>

      {/* Log form */}
      {showLogForm && (
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-[#f79935]">
          <h3 className="font-bold text-[#324a4d] mb-4">Log New Value</h3>
          <form onSubmit={handleLogSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#324a4d] mb-1">Value *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={logValue}
                  onChange={(e) => setLogValue(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#324a4d] mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#324a4d] mb-1">
                Analysis Note <span className="text-gray-400 font-normal">(context)</span>
              </label>
              <input
                type="text"
                value={logAnalysis}
                onChange={(e) => setLogAnalysis(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#324a4d] mb-1">
                Course Correction <span className="text-gray-400 font-normal">(action if missing target)</span>
              </label>
              <input
                type="text"
                value={logCorrection}
                onChange={(e) => setLogCorrection(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#55787c]"
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
                onClick={() => setShowLogForm(false)}
                className="bg-gray-200 text-[#324a4d] rounded-lg py-2 px-4 hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Trend Chart */}
      {entries.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-[#324a4d] mb-4">Trend Chart</h2>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#324a4d", fontSize: 12 }}
              />
              <YAxis
                tick={{ fill: "#324a4d", fontSize: 12 }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
                formatter={(value: unknown) => [
                  formatValue(value as number, metric.unit),
                  metric.name,
                ]}
                labelFormatter={(label: unknown) => String(label)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#324a4d"
                strokeWidth={2}
                dot={{ fill: "#324a4d", r: 5 }}
                activeDot={{ fill: "#f79935", r: 7 }}
                name="Actual"
              />
              {metric.target_value !== null && (
                <ReferenceLine
                  y={metric.target_value}
                  stroke="#b1bd37"
                  strokeDasharray="8 4"
                  strokeWidth={2}
                  label={{
                    value: `Target: ${metric.target_value}`,
                    fill: "#b1bd37",
                    fontSize: 12,
                    position: "right",
                  }}
                />
              )}
              {metric.comparison_value !== null && (
                <ReferenceLine
                  y={metric.comparison_value}
                  stroke="#f79935"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `${metric.comparison_source || "Comparison"}: ${metric.comparison_value}`,
                    fill: "#f79935",
                    fontSize: 12,
                    position: "right",
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* LeTCI Assessment */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#324a4d]">LeTCI Assessment</h2>
          <span className="text-sm font-medium text-[#55787c]">
            {letciCount} of 4 dimensions ready
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Baldrige evaluates results on four dimensions: Levels, Trends, Comparisons, and Integration.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LeTCICard
            letter="Le"
            title="Levels"
            description="Current performance on a meaningful measurement scale"
            ready={letci.level}
            detail={
              letci.level
                ? `${entries.length} data point${entries.length !== 1 ? "s" : ""} recorded. Latest: ${formatValue(lastEntry?.value ?? null, metric.unit)}`
                : "No data logged yet. Use the Log New Value button to add your first entry."
            }
          />
          <LeTCICard
            letter="T"
            title="Trends"
            description="Rate of improvement or sustained good performance over time"
            ready={letci.trend}
            detail={
              letci.trend
                ? `${entries.length} data points. Trend is ${trendDirection} ${trendEmoji[trendDirection]}`
                : `Only ${entries.length} data point${entries.length !== 1 ? "s" : ""}. Need at least 3 to show a trend.`
            }
          />
          <LeTCICard
            letter="C"
            title="Comparisons"
            description="Performance relative to benchmarks, peers, or industry standards"
            ready={letci.comparison}
            detail={
              letci.comparison
                ? `Comparison: ${formatValue(metric.comparison_value, metric.unit)} (${metric.comparison_source})`
                : "No comparison value set. Add a benchmark, industry standard, or peer comparison to strengthen this dimension."
            }
          />
          <LeTCICard
            letter="I"
            title="Integration"
            description="Results used in decision-making and connected to organizational priorities"
            ready={letci.integration}
            detail={
              letci.integration
                ? `Linked to ${linkedRequirements.length} Key Requirement${linkedRequirements.length !== 1 ? "s" : ""}: ${linkedRequirements.map((r) => `${r.requirement} (${r.stakeholder_group})`).join(", ")}`
                : "No Key Requirements linked. Edit this metric to link it to stakeholder requirements and demonstrate Integration."
            }
          />
        </div>
      </div>

      {/* Entry History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-[#324a4d] mb-4">Entry History</h2>
        {entries.length === 0 ? (
          <p className="text-gray-500 text-sm">No entries yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#324a4d] text-white text-left">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Fiscal Year</th>
                <th className="px-4 py-2 text-right">Value</th>
                <th className="px-4 py-2">Analysis Note</th>
                <th className="px-4 py-2">Course Correction</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((entry) => (
                <tr key={entry.id} className="border-t border-gray-100 group">
                  <td className="px-4 py-2 text-gray-600">{formatDate(entry.date)}</td>
                  <td className="px-4 py-2 text-gray-400">{toFiscalYear(entry.date)}</td>
                  <td className="px-4 py-2 text-right font-medium text-[#324a4d]">
                    {formatValue(entry.value, metric.unit)}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{entry.note_analysis || "—"}</td>
                  <td className="px-4 py-2">
                    {entry.note_course_correction ? (
                      <span className="inline-block border-l-2 border-[#f79935] pl-2 text-gray-600">
                        {entry.note_course_correction}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-gray-300 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete this entry"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LeTCICard({
  letter,
  title,
  description,
  ready,
  detail,
}: {
  letter: string;
  title: string;
  description: string;
  ready: boolean;
  detail: string;
}) {
  return (
    <div
      className={`rounded-lg border-2 p-4 ${
        ready ? "border-[#b1bd37] bg-[#b1bd37]/5" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
            ready ? "bg-[#b1bd37]" : "bg-gray-300"
          }`}
        >
          {letter}
        </div>
        <div>
          <div className="font-medium text-[#324a4d]">{title}</div>
          <div className="text-xs text-gray-400">{description}</div>
        </div>
      </div>
      <p className="text-sm text-gray-600 ml-13">{detail}</p>
    </div>
  );
}
