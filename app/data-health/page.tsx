"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStatus, getStatusColor, getStatusLabel, formatDate, formatValue } from "@/lib/review-status";
import { DashboardSkeleton } from "@/components/skeleton";
import type { Metric, Entry } from "@/lib/types";
import Link from "next/link";
import EmptyState from "@/components/empty-state";
import { Card, CardHeader, CardBody, Badge, Button, Input } from "@/components/ui";
import { useRole } from "@/lib/use-role";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import HelpTip from "@/components/help-tip";

interface MetricRow extends Metric {
  process_names: string;
  category_display_names: string;
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

// Bulk-editable metric fields and their input types
const BULK_FIELDS: { value: string; label: string; type: "select" | "text" | "number" | "toggle" }[] = [
  { value: "cadence", label: "Cadence", type: "select" },
  { value: "unit", label: "Unit", type: "select" },
  { value: "is_higher_better", label: "Trend Direction", type: "toggle" },
  { value: "target_value", label: "Target Value", type: "number" },
  { value: "data_source", label: "Data Source", type: "text" },
  { value: "collection_method", label: "Collection Method", type: "text" },
];

const CADENCE_OPTIONS = ["daily", "weekly", "monthly", "quarterly", "semi-annual", "annual"];
const UNIT_OPTIONS = ["%", "score", "count", "currency", "days", "rate"];

export default function DataHealthPage() {
  const { isAdmin } = useRole();
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [sparklineData, setSparklineData] = useState<Map<number, number[]>>(new Map());
  const [processSummary, setProcessSummary] = useState<KeyProcessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [logForm, setLogForm] = useState<LogFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "key" | "support">("all");
  const [keyMetricIds, setKeyMetricIds] = useState<Set<number>>(new Set());
  const [supportMetricIds, setSupportMetricIds] = useState<Set<number>>(new Set());
  const logFormRef = useRef<HTMLDivElement>(null);

  // Bulk edit state
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkField, setBulkField] = useState("cadence");
  const [bulkValue, setBulkValue] = useState("");
  const [updating, setUpdating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function fetchMetrics() {
    // Fetch metrics, junction links, and processes separately
    const [metricsRes, linksRes, processesRes, entriesRes] = await Promise.all([
      supabase.from("metrics").select("*"),
      supabase.from("metric_processes").select("metric_id, process_id"),
      supabase.from("processes").select("id, name, process_type, categories!inner ( display_name )"),
      supabase.from("entries").select("metric_id, value, date").order("date", { ascending: false }),
    ]);

    if (metricsRes.error) {
      console.error("Error fetching metrics:", metricsRes.error);
      setLoading(false);
      return;
    }

    if (entriesRes.error) {
      console.error("Error fetching entries:", entriesRes.error);
    }

    // Build process lookup
    const processMap = new Map<number, { name: string; process_type: string; category_display_name: string }>();
    for (const p of (processesRes.data || []) as Record<string, unknown>[]) {
      const cat = p.categories as Record<string, unknown>;
      processMap.set(p.id as number, {
        name: p.name as string,
        process_type: (p.process_type as string) || "unclassified",
        category_display_name: cat.display_name as string,
      });
    }

    // Build metric -> process names lookup via junction table
    // Also track which metrics are linked to key processes
    const metricProcesses = new Map<number, { names: string[]; categories: string[] }>();
    const keyMetrics = new Set<number>();
    const supportMetrics = new Set<number>();
    for (const link of linksRes.data || []) {
      const proc = processMap.get(link.process_id);
      if (!proc) continue;
      if (!metricProcesses.has(link.metric_id)) {
        metricProcesses.set(link.metric_id, { names: [], categories: [] });
      }
      const entry = metricProcesses.get(link.metric_id)!;
      entry.names.push(proc.name);
      if (!entry.categories.includes(proc.category_display_name)) {
        entry.categories.push(proc.category_display_name);
      }
      if (proc.process_type === "key") keyMetrics.add(link.metric_id);
      if (proc.process_type === "support") supportMetrics.add(link.metric_id);
    }
    setKeyMetricIds(keyMetrics);
    setSupportMetricIds(supportMetrics);

    const latestEntries = new Map<number, { value: number; date: string }>();
    const sparklines = new Map<number, number[]>();
    if (entriesRes.data) {
      for (const entry of entriesRes.data) {
        if (!latestEntries.has(entry.metric_id)) {
          latestEntries.set(entry.metric_id, {
            value: entry.value,
            date: entry.date,
          });
        }
        const existing = sparklines.get(entry.metric_id) || [];
        if (existing.length < 6) {
          existing.push(entry.value);
          sparklines.set(entry.metric_id, existing);
        }
      }
      for (const [id, values] of sparklines) {
        sparklines.set(id, values.reverse());
      }
    }

    const rows: MetricRow[] = (metricsRes.data || []).map((m: Record<string, unknown>) => {
      const latest = latestEntries.get(m.id as number);
      const procs = metricProcesses.get(m.id as number);

      return {
        ...(m as unknown as Metric),
        process_names: procs ? procs.names.join(", ") : "Unlinked",
        category_display_names: procs ? procs.categories.join(", ") : "—",
        last_entry_date: latest?.date || null,
        last_entry_value: latest?.value || null,
        review_status: getReviewStatus(
          m.cadence as string,
          latest?.date || null
        ),
      };
    });

    const statusOrder = { overdue: 0, "due-soon": 1, "no-data": 2, current: 3 };
    rows.sort(
      (a, b) => statusOrder[a.review_status] - statusOrder[b.review_status]
    );

    setMetrics(rows);
    setSparklineData(sparklines);
    setLoading(false);
  }

  useEffect(() => {
    document.title = "Data Health | NIA Excellence Hub";
    fetchMetrics();

    async function fetchProcessSummary() {
      const { data } = await supabase
        .from("processes")
        .select("process_type, status");
      if (data) {
        const all = data as { process_type: string | null; status: string }[];
        const keyProcs = all.filter((p) => (p.process_type || "unclassified") === "key");
        setProcessSummary({
          total: all.length,
          key: keyProcs.length,
          keyApproved: keyProcs.filter((p) => p.status === "approved").length,
          keyInProgress: keyProcs.filter((p) => p.status === "ready_for_review").length,
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
      await fetchMetrics();
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

  // Bulk edit helpers
  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(displayMetricsAll.map((m) => m.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function selectByStatus(status: MetricRow["review_status"]) {
    const ids = displayMetricsAll.filter((m) => m.review_status === status).map((m) => m.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function exitEditMode() {
    setEditMode(false);
    setSelected(new Set());
    setBulkField("cadence");
    setBulkValue("");
    setConfirmDelete(false);
  }

  async function bulkUpdate() {
    if (selected.size === 0 || !bulkValue.trim()) return;
    setUpdating(true);

    const ids = [...selected];
    // Build the update payload based on field type
    let updateValue: unknown = bulkValue.trim();
    if (bulkField === "target_value") {
      updateValue = parseFloat(bulkValue) || null;
    } else if (bulkField === "is_higher_better") {
      updateValue = bulkValue === "true";
    }

    const { error } = await supabase
      .from("metrics")
      .update({ [bulkField]: updateValue })
      .in("id", ids);

    if (error) {
      console.error("Bulk update error:", error);
      setUpdating(false);
      return;
    }

    // Optimistic UI update
    const fieldLabel = BULK_FIELDS.find((f) => f.value === bulkField)?.label || bulkField;
    setMetrics((prev) =>
      prev.map((m) =>
        ids.includes(m.id) ? { ...m, [bulkField]: updateValue } : m
      )
    );
    setSuccessMessage(`Updated ${fieldLabel} for ${ids.length} metric${ids.length !== 1 ? "s" : ""}`);
    setTimeout(() => setSuccessMessage(""), 4000);
    exitEditMode();
    setUpdating(false);
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    setUpdating(true);

    const ids = [...selected];

    // Delete junction rows first, then metrics, then entries
    await supabase.from("metric_processes").delete().in("metric_id", ids);
    await supabase.from("metric_requirements").delete().in("metric_id", ids);
    await supabase.from("entries").delete().in("metric_id", ids);
    const { error } = await supabase.from("metrics").delete().in("id", ids);

    if (error) {
      console.error("Bulk delete error:", error);
      setUpdating(false);
      return;
    }

    setMetrics((prev) => prev.filter((m) => !ids.includes(m.id)));
    setSuccessMessage(`Deleted ${ids.length} metric${ids.length !== 1 ? "s" : ""}`);
    setTimeout(() => setSuccessMessage(""), 4000);
    exitEditMode();
    setUpdating(false);
  }

  const displayMetricsAll = typeFilter === "key"
    ? metrics.filter((m) => keyMetricIds.has(m.id))
    : typeFilter === "support"
    ? metrics.filter((m) => supportMetricIds.has(m.id))
    : metrics;

  const displayMetrics = displayMetricsAll;

  const overdue = displayMetrics.filter((m) => m.review_status === "overdue");
  const dueSoon = displayMetrics.filter((m) => m.review_status === "due-soon");
  const noData = displayMetrics.filter((m) => m.review_status === "no-data");
  const current = displayMetrics.filter((m) => m.review_status === "current");
  const needsTargets = displayMetrics.filter((m) => m.target_value === null);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 content-appear">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">Data Health</h1>
          <p className="text-text-tertiary mt-1">
            Metric review status, data coverage, and quick logging.
            <HelpTip text="Cadence = how often a metric should be reviewed. Overdue = past its cadence deadline." />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface-subtle rounded-lg p-1">
            {(["all", "key", "support"] as const).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  typeFilter === t ? "bg-card text-nia-dark shadow-sm" : "text-text-tertiary hover:text-text-secondary"
                }`}>
                {t === "all" ? "All" : t === "key" ? "\u2605 Key" : "Support"}
              </button>
            ))}
          </div>
          <Button
            variant={editMode ? "accent" : "secondary"}
            size="sm"
            onClick={() => editMode ? exitEditMode() : setEditMode(true)}
          >
            {editMode ? "Cancel Edit" : "Edit Metrics"}
          </Button>
        </div>
      </div>

      {/* Bulk edit toolbar */}
      {editMode && (
        <Card accent="orange" padding="sm">
          <div className="space-y-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-sm font-medium text-nia-dark whitespace-nowrap">Select by status:</span>
              {(["overdue", "due-soon", "no-data", "current"] as const).map((status) => {
                const count = displayMetrics.filter((m) => m.review_status === status).length;
                if (count === 0) return null;
                const statusIds = displayMetrics.filter((m) => m.review_status === status).map((m) => m.id);
                const allSelected = statusIds.every((id) => selected.has(id));
                return (
                  <button
                    key={status}
                    onClick={() => selectByStatus(status)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      allSelected
                        ? "bg-nia-dark-solid text-white border-nia-dark-solid"
                        : "bg-card text-nia-dark border-border hover:border-nia-dark"
                    }`}
                  >
                    {getStatusLabel(status)} ({count})
                  </button>
                );
              })}
              <span className="text-text-muted">|</span>
              <button onClick={selectAll} className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium">
                Select All
              </button>
              <button onClick={deselectAll} className="text-xs text-nia-grey-blue hover:text-nia-dark font-medium">
                Deselect All
              </button>
            </div>
            <p className="text-xs text-text-muted">
              Click checkboxes on individual metrics, or use status buttons above to select groups.
            </p>
          </div>
        </Card>
      )}

      {/* Floating action bar for bulk edit */}
      {editMode && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-nia-dark shadow-2xl z-40 px-4 py-3">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="text-sm font-bold text-nia-dark whitespace-nowrap">
              {selected.size} selected
            </span>

            {/* Field + value inputs */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <select
                value={bulkField}
                onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}
                className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
              >
                {BULK_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>

              <BulkValueInput field={bulkField} value={bulkValue} onChange={setBulkValue} />

              <Button
                size="sm"
                onClick={bulkUpdate}
                disabled={updating || !bulkValue.trim()}
                loading={updating}
              >
                Update
              </Button>
            </div>

            {/* Delete section — admin only */}
            <div className="flex items-center gap-2 sm:ml-auto">
              {isAdmin && (
                !confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs text-nia-red hover:text-nia-red font-medium px-3 py-2 rounded border border-nia-red/30 hover:border-nia-red/50 transition-colors"
                  >
                    Delete Selected
                  </button>
                ) : (
                  <>
                    <span className="text-xs text-nia-red font-medium">
                      Delete {selected.size} metric{selected.size !== 1 ? "s" : ""}?
                    </span>
                    <button
                      onClick={bulkDelete}
                      disabled={updating}
                      className="text-xs bg-nia-red text-white font-medium px-3 py-2 rounded hover:bg-nia-red/80 disabled:opacity-50 transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-text-tertiary hover:text-text-secondary font-medium px-2 py-2"
                    >
                      Cancel
                    </button>
                  </>
                )
              )}
              <button
                onClick={exitEditMode}
                className="text-xs text-text-muted hover:text-text-secondary font-medium px-2 py-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="success-celebrate bg-nia-green/20 border border-nia-green text-nia-dark px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Hero metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="elevated" padding="md" className="flex items-center gap-5">
          <HealthRing
            percentage={
              displayMetrics.length > 0
                ? Math.round(
                    ((displayMetrics.length - noData.length) / displayMetrics.length) * 100
                  )
                : 0
            }
          />
          <div>
            <div className="text-base font-semibold text-nia-dark">
              Data Health
              <HelpTip text="Percentage of metrics with at least one data entry." />
            </div>
            <div className="text-sm text-text-muted mt-0.5">
              {displayMetrics.length - noData.length} of {displayMetrics.length} metrics
              tracked{typeFilter !== "all" && ` (${typeFilter} only)`}
            </div>
          </div>
        </Card>

        <HeroCard
          label="Overdue"
          value={overdue.length}
          color="#dc2626"
          subtitle="past review date"
        />

        <HeroCard
          label="Due Soon"
          value={dueSoon.length}
          color="#f79935"
          subtitle="review within 7 days"
        />
      </div>

      {/* Secondary stats ribbon */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Total Metrics" value={displayMetrics.length} color="#324a4d" />
        <MiniStat label="Current" value={current.length} color="#b1bd37" />
        <MiniStat
          label="Need Targets"
          value={needsTargets.length}
          color="#55787c"
        />
      </div>

      {/* Key Process Summary */}
      {processSummary && processSummary.key > 0 && (
        <Card
          variant="interactive"
          accent={typeFilter === "key" ? "orange" : "dark"}
          padding="sm"
          onClick={() => setTypeFilter(typeFilter === "key" ? "all" : "key")}
          className="cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wider">
                Key Processes {typeFilter === "key" && <Badge color="orange" size="xs">Filtered</Badge>}
              </h2>
              <p className="text-nia-dark mt-1">
                <span className="text-2xl font-bold">{processSummary.key}</span>
                <span className="text-text-muted text-sm"> of {processSummary.total} processes marked as key</span>
              </p>
            </div>
            <div className="flex gap-4 text-center">
              {processSummary.keyApproved > 0 && (
                <div>
                  <div className="text-lg font-bold text-nia-green">{processSummary.keyApproved}</div>
                  <div className="text-xs text-text-muted">Approved</div>
                </div>
              )}
              {processSummary.keyInProgress > 0 && (
                <div>
                  <div className="text-lg font-bold text-nia-orange">{processSummary.keyInProgress}</div>
                  <div className="text-xs text-text-muted">In Review</div>
                </div>
              )}
              {processSummary.keyDraft > 0 && (
                <div>
                  <div className="text-lg font-bold text-text-muted">{processSummary.keyDraft}</div>
                  <div className="text-xs text-text-muted">Draft</div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Inline log form */}
      {logForm && (
        <Card accent="orange" padding="md">
          <div ref={logFormRef}>
          <h3 className="font-bold text-nia-dark mb-4">
            Log Value:{" "}
            {metrics.find((m) => m.id === logForm.metricId)?.name}
          </h3>
          <form onSubmit={handleLogSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Value"
                type="number"
                step="any"
                required
                value={logForm.value}
                onChange={(e) =>
                  setLogForm({ ...logForm, value: e.target.value })
                }
                placeholder="Enter value"
              />
              <Input
                label="Date"
                type="date"
                required
                value={logForm.date}
                onChange={(e) =>
                  setLogForm({ ...logForm, date: e.target.value })
                }
              />
            </div>
            <Input
              label="Analysis Note"
              hint="Context or explanation"
              value={logForm.noteAnalysis}
              onChange={(e) =>
                setLogForm({ ...logForm, noteAnalysis: e.target.value })
              }
              placeholder="e.g., New survey methodology used this cycle"
            />
            <Input
              label="Course Correction"
              hint="Action taken if missing target"
              value={logForm.noteCourseCorrection}
              onChange={(e) =>
                setLogForm({
                  ...logForm,
                  noteCourseCorrection: e.target.value,
                })
              }
              placeholder="e.g., Added mandatory re-training for repeat offenders"
            />
            <div className="flex gap-3">
              <Button type="submit" disabled={saving} loading={saving}>
                Save Entry
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setLogForm(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
          </div>
        </Card>
      )}

      {/* Overdue section */}
      {overdue.length > 0 && (
        <MetricSection
          title="Overdue"
          subtitle="These metrics are past their review date"
          metrics={overdue}
          sparklineData={sparklineData}
          onLogClick={openLogForm}
          accentColor="#dc2626"
          editMode={editMode}
          selected={selected}
          onToggleSelect={toggleSelect}
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
          accentColor="#f79935"
          editMode={editMode}
          selected={selected}
          onToggleSelect={toggleSelect}
        />
      )}

      {/* All caught up empty state */}
      {overdue.length === 0 && dueSoon.length === 0 && (
        <div className="bg-card rounded-xl shadow-sm border border-nia-green/30">
          <EmptyState
            illustration="check"
            title="All caught up!"
            description="No metrics are overdue or due soon. Check back later or log new data to keep your results current."
            action={{ label: "Log Data", href: "/log" }}
          />
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
          accentColor="#55787c"
          editMode={editMode}
          selected={selected}
          onToggleSelect={toggleSelect}
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
          accentColor="#b1bd37"
          editMode={editMode}
          selected={selected}
          onToggleSelect={toggleSelect}
        />
      )}

      {/* Bottom padding when floating bar is visible */}
      {editMode && selected.size > 0 && <div className="h-20" />}
    </div>
  );
}

function HealthRing({ percentage }: { percentage: number }) {
  const [mounted, setMounted] = useState(false);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = mounted
    ? circumference - (percentage / 100) * circumference
    : circumference;
  const color =
    percentage >= 80 ? "#b1bd37" : percentage >= 50 ? "#f79935" : "#dc2626";

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative w-28 h-28 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="var(--grid-line)" strokeWidth="7"
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-nia-dark">
          {percentage}<span className="text-sm">%</span>
        </span>
      </div>
    </div>
  );
}

function HeroCard({
  label,
  value,
  color,
  subtitle,
}: {
  label: string;
  value: number;
  color: string;
  subtitle: string;
}) {
  const accentMap: Record<string, "orange" | "red" | "green" | "dark"> = {
    "#dc2626": "red",
    "#f79935": "orange",
    "#b1bd37": "green",
    "#324a4d": "dark",
  };

  const glowMap: Record<string, string> = {
    "#dc2626": "glow-red",
    "#f79935": "glow-orange",
  };

  return (
    <Card variant="elevated" accent={accentMap[color] || "none"} padding="md" className={`flex flex-col justify-center ${value > 0 && glowMap[color] ? glowMap[color] : ""}`}>
      <div className="text-4xl font-bold font-display number-pop tracking-tight" style={{ color }}>
        {value}
      </div>
      <div className="text-base font-semibold text-nia-dark mt-1">{label}</div>
      <div className="text-sm text-text-muted mt-0.5">{subtitle}</div>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <div className="text-xl font-bold font-display number-pop" style={{ color }}>
        {value}
      </div>
      <div className="text-sm text-text-tertiary">{label}</div>
    </Card>
  );
}

function MetricSection({
  title,
  subtitle,
  metrics,
  sparklineData,
  onLogClick,
  defaultOpen = true,
  accentColor,
  editMode = false,
  selected,
  onToggleSelect,
}: {
  title: string;
  subtitle: string;
  metrics: MetricRow[];
  sparklineData: Map<number, number[]>;
  onLogClick: (metricId: number) => void;
  defaultOpen?: boolean;
  accentColor?: string;
  editMode?: boolean;
  selected?: Set<number>;
  onToggleSelect?: (id: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const accentMap: Record<string, "orange" | "red" | "green" | "dark"> = {
    "#dc2626": "red" as const,
    "#f79935": "orange" as const,
    "#b1bd37": "green" as const,
    "#55787c": "dark" as const,
  };

  return (
    <Card accent={accentColor ? accentMap[accentColor] || "none" : "none"} className="overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors text-left"
        style={accentColor ? { backgroundColor: `${accentColor}08` } : {}}
      >
        <div className="flex items-center gap-3">
          <span className={`section-chevron text-text-muted text-sm ${isOpen ? "open" : ""}`}>
            ▶
          </span>
          <div>
            <span className="text-lg font-bold text-nia-dark">{title}</span>
            <span className="text-sm text-text-muted ml-3">
              {metrics.length} metric{metrics.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <span className="text-xs text-text-muted">{subtitle}</span>
      </button>

      <div className={`section-body ${isOpen ? "open" : ""}`}>
        <div>
        <div className="border-t border-border-light space-y-0">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className={`px-4 py-3 flex items-center justify-between border-b border-border-light last:border-b-0 hover:bg-surface-hover transition-colors ${editMode && selected?.has(metric.id) ? "bg-nia-orange/5" : ""}`}
              onClick={editMode ? () => onToggleSelect?.(metric.id) : undefined}
              style={editMode ? { cursor: "pointer" } : undefined}
            >
              <div className="flex items-center gap-3">
                {editMode && (
                  <input
                    type="checkbox"
                    checked={selected?.has(metric.id) || false}
                    onChange={() => onToggleSelect?.(metric.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-border text-nia-dark focus:ring-nia-grey-blue flex-shrink-0"
                  />
                )}
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${metric.review_status === "overdue" ? "overdue-pulse" : ""}`}
                  style={{
                    backgroundColor: getStatusColor(metric.review_status),
                  }}
                />
                <div>
                  <Link href={`/metric/${metric.id}`} className="font-medium text-nia-dark hover:text-nia-orange transition-colors">
                    {metric.name}
                  </Link>
                  <div className="text-sm text-text-tertiary">
                    {metric.category_display_names} &middot; {metric.process_names}{" "}
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
                    <div className="font-medium text-nia-dark">
                      {formatValue(metric.last_entry_value, metric.unit)}
                    </div>
                    <div className="text-xs text-text-muted">
                      {formatDate(metric.last_entry_date)}
                    </div>
                  </div>
                )}
                <Badge
                  color={
                    metric.review_status === "overdue" ? "red" :
                    metric.review_status === "due-soon" ? "orange" :
                    metric.review_status === "current" ? "green" : "gray"
                  }
                  size="xs"
                >
                  {getStatusLabel(metric.review_status)}
                </Badge>
                <Button
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLogClick(metric.id);
                  }}
                >
                  Log Now
                </Button>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </Card>
  );
}

function BulkValueInput({ field, value, onChange }: { field: string; value: string; onChange: (v: string) => void }) {
  const fieldDef = BULK_FIELDS.find((f) => f.value === field);
  if (!fieldDef) return null;

  if (field === "cadence") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
      >
        <option value="">Select cadence...</option>
        {CADENCE_OPTIONS.map((c) => (
          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
        ))}
      </select>
    );
  }

  if (field === "unit") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
      >
        <option value="">Select unit...</option>
        {UNIT_OPTIONS.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>
    );
  }

  if (field === "is_higher_better") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
      >
        <option value="">Select direction...</option>
        <option value="true">Higher is Better</option>
        <option value="false">Lower is Better</option>
      </select>
    );
  }

  if (fieldDef.type === "number") {
    return (
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${fieldDef.label.toLowerCase()}...`}
        className="text-sm border border-border rounded-lg px-3 py-2 w-36 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Enter ${fieldDef.label.toLowerCase()}...`}
      className="text-sm border border-border rounded-lg px-3 py-2 w-48 focus:outline-none focus:ring-2 focus:ring-nia-grey-blue"
    />
  );
}

function Sparkline({ values, isHigherBetter }: { values: number[]; isHigherBetter: boolean }) {
  if (values.length < 2) {
    return <span className="text-text-muted text-xs w-16 text-center inline-block">&mdash;</span>;
  }

  const first = values[0];
  const last = values[values.length - 1];
  const trend = last > first ? "up" : last < first ? "down" : "flat";
  const improving = (trend === "up" && isHigherBetter) || (trend === "down" && !isHigherBetter);
  const color = improving ? "#b1bd37" : trend === "flat" ? "#55787c" : "#dc2626";
  const data = values.map((v, i) => ({ i, v }));

  return (
    <div className="w-20 h-10 flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
