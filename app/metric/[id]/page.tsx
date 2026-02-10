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
import { Card, Badge, Button, Input } from "@/components/ui";
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

interface LinkedProcessInfo {
  id: number;
  name: string;
  category_display_name: string;
}

interface MetricDetail extends Metric {
  linked_processes: LinkedProcessInfo[];
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

  // Inline edit state
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ value: "", date: "", noteAnalysis: "", noteCorrection: "" });
  const [editSaving, setEditSaving] = useState(false);

  async function fetchData() {
    const { data: metricData } = await supabase
      .from("metrics")
      .select("*")
      .eq("id", metricId)
      .single();

    if (metricData) {
      const name = metricData.name as string;
      document.title = `${name} | NIA Excellence Hub`;

      // Fetch linked processes via junction table
      const { data: processLinks } = await supabase
        .from("metric_processes")
        .select(`
          process_id,
          processes!inner ( id, name, categories!inner ( display_name ) )
        `)
        .eq("metric_id", metricId);

      const linkedProcs: LinkedProcessInfo[] = (processLinks || []).map((link) => {
        const proc = link.processes as unknown as { id: number; name: string; categories: { display_name: string } };
        return {
          id: proc.id,
          name: proc.name,
          category_display_name: proc.categories.display_name,
        };
      });

      setMetric({
        ...(metricData as unknown as Metric),
        linked_processes: linkedProcs,
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

  function startEditEntry(entry: Entry) {
    setEditingEntryId(entry.id);
    setEditForm({
      value: String(entry.value),
      date: entry.date,
      noteAnalysis: entry.note_analysis || "",
      noteCorrection: entry.note_course_correction || "",
    });
  }

  async function handleEditSave() {
    if (editingEntryId === null) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("entries")
      .update({
        value: parseFloat(editForm.value),
        date: editForm.date,
        note_analysis: editForm.noteAnalysis || null,
        note_course_correction: editForm.noteCorrection || null,
      })
      .eq("id", editingEntryId);

    if (error) {
      alert("Failed to update: " + error.message);
    } else {
      setEditingEntryId(null);
      setSuccessMessage("Entry updated");
      await fetchData();
      setTimeout(() => setSuccessMessage(""), 3000);
    }
    setEditSaving(false);
  }

  if (loading) return <DetailSkeleton sections={3} />;

  if (!metric) {
    return (
      <div className="text-center py-20">
        <div className="text-red-600 text-lg">Metric not found</div>
        <Link href="/" className="text-nia-grey-blue hover:underline mt-2 inline-block">
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
        <div className="success-celebrate bg-nia-green/20 border border-nia-green text-nia-dark px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <Link href="/" className="hover:text-nia-grey-blue">
          Dashboard
        </Link>
        {" / "}
        {metric.linked_processes.length > 0 ? (
          <>
            <Link href={`/processes/${metric.linked_processes[0].id}`} className="hover:text-nia-grey-blue">
              {metric.linked_processes[0].name}
            </Link>
            {metric.linked_processes.length > 1 && (
              <span className="text-gray-400"> (+{metric.linked_processes.length - 1} more)</span>
            )}
          </>
        ) : (
          <span className="text-gray-400">Unlinked</span>
        )}
        {" / "}
        <span className="text-nia-dark">{metric.name}</span>
      </div>

      {/* Header */}
      <Card padding="lg">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-nia-dark">{metric.name}</h1>
            <p className="text-gray-500 mt-1">
              {metric.linked_processes.length > 0
                ? metric.linked_processes.map((p) => p.name).join(", ")
                : "No linked processes"}
            </p>
            {metric.description && (
              <p className="text-sm text-gray-400 mt-2">{metric.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Badge
              color={reviewStatus === "current" ? "green" : reviewStatus === "overdue" ? "red" : reviewStatus === "due-soon" ? "orange" : "gray"}
              size="sm"
            >
              {getStatusLabel(reviewStatus)}
            </Badge>
            <Button variant="ghost" size="sm" href={`/metric/${metricId}/edit`}>Edit</Button>
            <Button size="sm" onClick={() => setShowLogForm(!showLogForm)}>Log New Value</Button>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase">Cadence</div>
            <div className="font-medium text-nia-dark capitalize">{metric.cadence}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase">Last Value</div>
            <div className="font-medium text-nia-dark">
              {lastEntry ? formatValue(lastEntry.value, metric.unit) : "—"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase">Target</div>
            <div className="font-medium text-nia-dark">
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
            <div className="font-medium text-nia-dark text-sm">{metric.data_source || "—"}</div>
          </div>
        </div>

        {/* Target nudge */}
        {metric.target_value === null && (
          <div className="mt-4 bg-nia-orange/10 border border-nia-orange/30 rounded-lg px-4 py-3 text-sm text-nia-dark flex items-center justify-between">
            <span>No target set — setting a target helps evaluate whether results are meeting expectations.</span>
            <Link
              href={`/metric/${metricId}/edit`}
              className="text-nia-orange font-medium hover:underline whitespace-nowrap ml-4"
            >
              Set Target
            </Link>
          </div>
        )}
      </Card>

      {/* Log form */}
      {showLogForm && (
        <Card accent="orange" padding="lg">
          <h3 className="font-bold text-nia-dark mb-4">Log New Value</h3>
          <form onSubmit={handleLogSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Value *" type="number" step="any" required value={logValue} onChange={(e) => setLogValue(e.target.value)} />
              <Input label="Date *" type="date" required value={logDate} onChange={(e) => setLogDate(e.target.value)} />
            </div>
            <Input label="Analysis Note" hint="context" value={logAnalysis} onChange={(e) => setLogAnalysis(e.target.value)} />
            <Input label="Course Correction" hint="action if missing target" value={logCorrection} onChange={(e) => setLogCorrection(e.target.value)} />
            <div className="flex gap-3">
              <Button type="submit" loading={saving}>{saving ? "Saving..." : "Save Entry"}</Button>
              <Button variant="ghost" onClick={() => setShowLogForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Trend Chart */}
      {entries.length > 0 && (
        <Card padding="lg">
          <h2 className="text-xl font-bold text-nia-dark mb-4">Trend Chart</h2>
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
        </Card>
      )}

      {/* LeTCI Assessment */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-nia-dark">LeTCI Assessment</h2>
          <span className="text-sm font-medium text-nia-grey-blue">
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
      </Card>

      {/* Entry History */}
      <Card padding="lg">
        <h2 className="text-xl font-bold text-nia-dark mb-4">Entry History</h2>
        {entries.length === 0 ? (
          <p className="text-gray-500 text-sm">No entries yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-nia-dark text-white text-left">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Fiscal Year</th>
                <th className="px-4 py-2 text-right">Value</th>
                <th className="px-4 py-2">Analysis Note</th>
                <th className="px-4 py-2">Course Correction</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((entry) =>
                editingEntryId === entry.id ? (
                  <tr key={entry.id} className="border-t border-nia-orange/30 bg-nia-orange/5">
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-nia-orange/50"
                      />
                    </td>
                    <td className="px-4 py-2 text-gray-400">{toFiscalYear(editForm.date)}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="any"
                        value={editForm.value}
                        onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-nia-orange/50"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editForm.noteAnalysis}
                        onChange={(e) => setEditForm({ ...editForm, noteAnalysis: e.target.value })}
                        placeholder="Analysis note"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-nia-orange/50"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={editForm.noteCorrection}
                        onChange={(e) => setEditForm({ ...editForm, noteCorrection: e.target.value })}
                        placeholder="Course correction"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-nia-orange/50"
                      />
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={handleEditSave}
                        disabled={editSaving}
                        className="text-nia-green hover:text-nia-green/80 text-xs font-medium mr-2"
                      >
                        {editSaving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingEntryId(null)}
                        className="text-gray-400 hover:text-gray-600 text-xs"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={entry.id} className="border-t border-gray-100 group">
                    <td className="px-4 py-2 text-gray-600">{formatDate(entry.date)}</td>
                    <td className="px-4 py-2 text-gray-400">{toFiscalYear(entry.date)}</td>
                    <td className="px-4 py-2 text-right font-medium text-nia-dark">
                      {formatValue(entry.value, metric.unit)}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{entry.note_analysis || "—"}</td>
                    <td className="px-4 py-2">
                      {entry.note_course_correction ? (
                        <span className="inline-block border-l-2 border-nia-orange pl-2 text-gray-600">
                          {entry.note_course_correction}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => startEditEntry(entry)}
                        className="text-gray-300 hover:text-nia-grey-blue text-xs opacity-0 group-hover:opacity-100 transition-opacity mr-2"
                        title="Edit this entry"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-gray-300 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete this entry"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </Card>
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
        ready ? "border-nia-green bg-nia-green/5" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
            ready ? "bg-nia-green" : "bg-gray-300"
          }`}
        >
          {letter}
        </div>
        <div>
          <div className="font-medium text-nia-dark">{title}</div>
          <div className="text-xs text-gray-400">{description}</div>
        </div>
      </div>
      <p className="text-sm text-gray-600 ml-13">{detail}</p>
    </div>
  );
}
