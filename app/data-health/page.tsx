"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStatus, getStatusColor, getStatusLabel, formatDate, formatValue } from "@/lib/review-status";
import { DashboardSkeleton } from "@/components/skeleton";
import type { Metric, Entry } from "@/lib/types";
import Link from "next/link";
import EmptyState from "@/components/empty-state";
import { Card, CardHeader, CardBody, Badge, Button, Input } from "@/components/ui";
import { LineChart, Line, ResponsiveContainer } from "recharts";

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

export default function DataHealthPage() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [sparklineData, setSparklineData] = useState<Map<number, number[]>>(new Map());
  const [processSummary, setProcessSummary] = useState<KeyProcessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [logForm, setLogForm] = useState<LogFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const logFormRef = useRef<HTMLDivElement>(null);

  async function fetchMetrics() {
    // Fetch metrics, junction links, and processes separately
    const [metricsRes, linksRes, processesRes, entriesRes] = await Promise.all([
      supabase.from("metrics").select("*"),
      supabase.from("metric_processes").select("metric_id, process_id"),
      supabase.from("processes").select("id, name, categories!inner ( display_name )"),
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
    const processMap = new Map<number, { name: string; category_display_name: string }>();
    for (const p of (processesRes.data || []) as Record<string, unknown>[]) {
      const cat = p.categories as Record<string, unknown>;
      processMap.set(p.id as number, {
        name: p.name as string,
        category_display_name: cat.display_name as string,
      });
    }

    // Build metric -> process names lookup via junction table
    const metricProcesses = new Map<number, { names: string[]; categories: string[] }>();
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
    }

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
        .select("is_key, status");
      if (data) {
        const all = data as { is_key: boolean; status: string }[];
        const keyProcs = all.filter((p) => p.is_key);
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

  const overdue = metrics.filter((m) => m.review_status === "overdue");
  const dueSoon = metrics.filter((m) => m.review_status === "due-soon");
  const noData = metrics.filter((m) => m.review_status === "no-data");
  const current = metrics.filter((m) => m.review_status === "current");
  const needsTargets = metrics.filter((m) => m.target_value === null);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-nia-dark">Data Health</h1>
        <p className="text-gray-500 mt-1">
          Metric review status, data coverage, and quick logging.
        </p>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="banner-enter bg-nia-green/20 border border-nia-green text-nia-dark px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Hero metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="elevated" padding="md" className="flex items-center gap-5">
          <HealthRing
            percentage={
              metrics.length > 0
                ? Math.round(
                    ((metrics.length - noData.length) / metrics.length) * 100
                  )
                : 0
            }
          />
          <div>
            <div className="text-base font-semibold text-nia-dark">
              Data Health
            </div>
            <div className="text-sm text-gray-400 mt-0.5">
              {metrics.length - noData.length} of {metrics.length} metrics
              tracked
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
        <MiniStat label="Total Metrics" value={metrics.length} color="#324a4d" />
        <MiniStat label="Current" value={current.length} color="#b1bd37" />
        <MiniStat
          label="Need Targets"
          value={needsTargets.length}
          color="#55787c"
        />
      </div>

      {/* Key Process Summary */}
      {processSummary && processSummary.key > 0 && (
        <Link
          href="/processes"
          className="block"
        >
        <Card variant="interactive" accent="dark" padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Key Processes
              </h2>
              <p className="text-nia-dark mt-1">
                <span className="text-2xl font-bold">{processSummary.key}</span>
                <span className="text-gray-400 text-sm"> of {processSummary.total} processes marked as key</span>
              </p>
            </div>
            <div className="flex gap-4 text-center">
              {processSummary.keyApproved > 0 && (
                <div>
                  <div className="text-lg font-bold text-nia-green">{processSummary.keyApproved}</div>
                  <div className="text-xs text-gray-400">Approved</div>
                </div>
              )}
              {processSummary.keyInProgress > 0 && (
                <div>
                  <div className="text-lg font-bold text-nia-orange">{processSummary.keyInProgress}</div>
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
        </Card>
        </Link>
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
        />
      )}

      {/* All caught up empty state */}
      {overdue.length === 0 && dueSoon.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-nia-green/30">
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
        />
      )}
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
          fill="none" stroke="#e5e7eb" strokeWidth="7"
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

  return (
    <Card variant="elevated" accent={accentMap[color] || "none"} padding="md" className="flex flex-col justify-center">
      <div className="text-4xl font-bold font-display number-pop tracking-tight" style={{ color }}>
        {value}
      </div>
      <div className="text-base font-semibold text-nia-dark mt-1">{label}</div>
      <div className="text-sm text-gray-400 mt-0.5">{subtitle}</div>
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
      <div className="text-sm text-gray-500">{label}</div>
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
}: {
  title: string;
  subtitle: string;
  metrics: MetricRow[];
  sparklineData: Map<number, number[]>;
  onLogClick: (metricId: number) => void;
  defaultOpen?: boolean;
  accentColor?: string;
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
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors text-left"
        style={accentColor ? { backgroundColor: `${accentColor}08` } : {}}
      >
        <div className="flex items-center gap-3">
          <span className={`section-chevron text-gray-400 text-sm ${isOpen ? "open" : ""}`}>
            ▶
          </span>
          <div>
            <span className="text-lg font-bold text-nia-dark">{title}</span>
            <span className="text-sm text-gray-400 ml-3">
              {metrics.length} metric{metrics.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <span className="text-xs text-gray-400">{subtitle}</span>
      </button>

      <div className={`section-body ${isOpen ? "open" : ""}`}>
        <div>
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
                  <Link href={`/metric/${metric.id}`} className="font-medium text-nia-dark hover:text-nia-orange transition-colors">
                    {metric.name}
                  </Link>
                  <div className="text-sm text-gray-500">
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
                    <div className="text-xs text-gray-400">
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
    <div className="w-20 h-10 flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
