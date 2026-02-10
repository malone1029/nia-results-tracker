"use client";

import { useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/skeleton";
import { Card, Badge, Button } from "@/components/ui";
import HealthRing from "@/components/health-ring";
import {
  getHealthLevel,
  type HealthResult,
} from "@/lib/process-health";
import {
  fetchHealthData,
  type ProcessWithCategory,
  type CategoryRow,
} from "@/lib/fetch-health-data";
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
} from "recharts";

// ── Dimension metadata ───────────────────────────────────────
const DIMENSION_CONFIG: { key: keyof HealthResult["dimensions"]; label: string; max: number }[] = [
  { key: "documentation", label: "Documentation", max: 25 },
  { key: "maturity", label: "Maturity", max: 25 },
  { key: "measurement", label: "Measurement", max: 20 },
  { key: "operations", label: "Operations", max: 15 },
  { key: "freshness", label: "Freshness", max: 15 },
];

interface Snapshot {
  id: number;
  snapshot_date: string;
  org_score: number;
  category_scores: Record<string, number>;
  dimension_scores: Record<string, number>;
  process_count: number;
  ready_count: number;
}

export default function ReadinessPage() {
  const [processes, setProcesses] = useState<ProcessWithCategory[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [healthScores, setHealthScores] = useState<Map<number, HealthResult>>(new Map());
  const [loading, setLoading] = useState(true);

  // Snapshot state
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Readiness | NIA Excellence Hub";

    async function load() {
      const [data, snapRes] = await Promise.all([
        fetchHealthData(),
        fetch("/api/readiness").then((r) => r.ok ? r.json() : []),
      ]);
      setProcesses(data.processes);
      setCategories(data.categories);
      setHealthScores(data.healthScores);
      setSnapshots(snapRes);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <DashboardSkeleton />;

  // ── Org-wide score (key processes count 2x) ────────────────
  let weightedSum = 0;
  let weightTotal = 0;
  for (const proc of processes) {
    const health = healthScores.get(proc.id);
    if (!health) continue;
    const weight = proc.is_key ? 2 : 1;
    weightedSum += health.total * weight;
    weightTotal += weight;
  }
  const orgScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;
  const orgLevel = getHealthLevel(orgScore);

  const readyCount = processes.filter((p) => {
    const h = healthScores.get(p.id);
    return h && h.total >= 80;
  }).length;

  const keyProcesses = processes.filter((p) => p.is_key);
  const keyAvg = keyProcesses.length > 0
    ? Math.round(keyProcesses.reduce((sum, p) => sum + (healthScores.get(p.id)?.total ?? 0), 0) / keyProcesses.length)
    : null;

  // ── Category breakdown ─────────────────────────────────────
  interface CategoryData {
    category: CategoryRow;
    procs: (ProcessWithCategory & { health: HealthResult })[];
    avgScore: number;
    readyCount: number;
  }

  const categoryData: CategoryData[] = categories
    .map((cat) => {
      const catProcs = processes
        .filter((p) => p.category_id === cat.id)
        .map((p) => ({ ...p, health: healthScores.get(p.id)! }))
        .filter((p) => p.health);
      const avg = catProcs.length > 0
        ? Math.round(catProcs.reduce((s, p) => s + p.health.total, 0) / catProcs.length)
        : 0;
      const ready = catProcs.filter((p) => p.health.total >= 80).length;
      return { category: cat, procs: catProcs, avgScore: avg, readyCount: ready };
    })
    .sort((a, b) => a.avgScore - b.avgScore); // weakest first

  // ── Dimension averages ─────────────────────────────────────
  const dimensionAvgs = DIMENSION_CONFIG.map((dim) => {
    let total = 0;
    let count = 0;
    for (const proc of processes) {
      const h = healthScores.get(proc.id);
      if (!h) continue;
      total += h.dimensions[dim.key].score;
      count++;
    }
    const avg = count > 0 ? total / count : 0;
    const pct = dim.max > 0 ? Math.round((avg / dim.max) * 100) : 0;
    return { ...dim, avg: Math.round(avg), pct, isGap: pct < 50 };
  }).sort((a, b) => a.pct - b.pct); // weakest first

  // ── Top 5 actions ──────────────────────────────────────────
  const actionMap = new Map<string, { label: string; totalPoints: number; count: number; href?: string }>();
  for (const proc of processes) {
    const h = healthScores.get(proc.id);
    if (!h) continue;
    for (const action of h.nextActions) {
      const normalized = action.label
        .replace(/\s+for this process/i, "")
        .replace(/\s+to this process/i, "")
        .replace(/\s+\(last updated \d+ days ago\)/i, "")
        .trim();
      const existing = actionMap.get(normalized);
      if (existing) {
        existing.totalPoints += action.points;
        existing.count++;
      } else {
        actionMap.set(normalized, {
          label: normalized,
          totalPoints: action.points,
          count: 1,
          href: action.href,
        });
      }
    }
  }
  const topActions = [...actionMap.values()]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 5);

  // ── Snapshot helpers ───────────────────────────────────────
  async function takeSnapshot() {
    setSnapshotSaving(true);
    setSnapshotMsg(null);

    // Build category scores
    const catScores: Record<string, number> = {};
    for (const cd of categoryData) {
      catScores[String(cd.category.id)] = cd.avgScore;
    }

    // Build dimension scores (as percentages)
    const dimScores: Record<string, number> = {};
    for (const dim of dimensionAvgs) {
      dimScores[dim.key] = dim.pct;
    }

    const res = await fetch("/api/readiness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_score: orgScore,
        category_scores: catScores,
        dimension_scores: dimScores,
        process_count: processes.length,
        ready_count: readyCount,
      }),
    });

    if (res.ok) {
      const saved = await res.json();
      // Update or add snapshot in the list
      setSnapshots((prev) => {
        const exists = prev.findIndex((s) => s.snapshot_date === saved.snapshot_date);
        if (exists >= 0) {
          const updated = [...prev];
          updated[exists] = saved;
          return updated;
        }
        return [...prev, saved].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
      });
      setSnapshotMsg("Snapshot saved!");
      setTimeout(() => setSnapshotMsg(null), 3000);
    } else {
      setSnapshotMsg("Failed to save snapshot");
    }
    setSnapshotSaving(false);
  }

  // ── Chart data ─────────────────────────────────────────────
  const chartData = snapshots.map((s) => ({
    date: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: s.org_score,
    ready: s.ready_count,
    total: s.process_count,
  }));

  return (
    <div className="space-y-8 content-appear">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark font-display">
            Baldrige Readiness
          </h1>
          <p className="text-gray-500 mt-1">
            Organization-wide readiness for a Baldrige Excellence application
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={takeSnapshot}
            disabled={snapshotSaving}
          >
            {snapshotSaving ? "Saving..." : "Take Readiness Snapshot"}
          </Button>
          {snapshotMsg && (
            <span className={`text-sm font-medium ${snapshotMsg.includes("Failed") ? "text-red-600" : "text-nia-green"}`}>
              {snapshotMsg}
            </span>
          )}
        </div>
      </div>

      {/* ── Section A: Org Readiness Score ──────────────────── */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <HealthRing
            score={orgScore}
            color={orgLevel.color}
            size={120}
            strokeWidth={8}
            className="text-2xl"
          />
          <div className="text-center sm:text-left">
            <div className="text-lg font-bold font-display" style={{ color: orgLevel.color }}>
              {orgLevel.label}
            </div>
            <div className="text-3xl font-bold text-nia-dark mt-1">
              {orgScore}<span className="text-lg text-gray-400 font-normal">/100</span>
            </div>
            <div className="text-sm text-gray-500 mt-2 space-y-1">
              <div>
                {readyCount} of {processes.length} processes are{" "}
                <span className="font-medium" style={{ color: "#b1bd37" }}>Baldrige Ready</span>
              </div>
              {keyAvg !== null && keyProcesses.length > 0 && (
                <div>
                  {keyProcesses.length} Key Process{keyProcesses.length !== 1 ? "es" : ""} avg:{" "}
                  <span className="font-medium text-nia-dark">{keyAvg}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Readiness Trend ────────────────────────────────── */}
      {chartData.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Readiness Trend
          </h2>
          <Card className="p-5">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  ticks={[0, 20, 40, 60, 80, 100]}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    fontSize: "13px",
                  }}
                  formatter={(value) => [`${value ?? 0}%`, "Readiness"]}
                  labelFormatter={(label) => label}
                />
                {/* Baldrige target line at 80% */}
                <ReferenceLine
                  y={80}
                  stroke="#b1bd37"
                  strokeDasharray="6 4"
                  label={{
                    value: "Target: 80%",
                    position: "right",
                    fill: "#b1bd37",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#324a4d"
                  strokeWidth={2.5}
                  dot={{ fill: "#324a4d", r: 4, strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "#324a4d", fill: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-nia-dark inline-block rounded" />
                Org Readiness
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: "#b1bd37", borderTop: "1px dashed #b1bd37" }} />
                Baldrige Target
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* ── Section B: Category Readiness ───────────────────── */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
          Category Readiness
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categoryData.map(({ category, procs, avgScore, readyCount: catReady }) => {
            const catLevel = getHealthLevel(avgScore);
            return (
              <Card key={category.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <HealthRing score={avgScore} color={catLevel.color} size={44} strokeWidth={4} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-nia-dark truncate">
                      {category.display_name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {procs.length === 0
                        ? "No processes"
                        : `${catReady} of ${procs.length} Baldrige Ready`}
                    </div>
                  </div>
                  <Badge
                    color={avgScore >= 80 ? "green" : avgScore >= 60 ? "gray" : "orange"}
                    size="sm"
                  >
                    {catLevel.label}
                  </Badge>
                </div>

                {procs.length === 0 ? (
                  <div className="text-sm text-gray-400 italic py-2">
                    No processes in this category
                  </div>
                ) : (
                  <div className="space-y-2">
                    {procs
                      .sort((a, b) => a.health.total - b.health.total) // weakest first
                      .map((proc) => (
                        <Link
                          key={proc.id}
                          href={`/processes/${proc.id}`}
                          className="flex items-center gap-2 group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-nia-dark group-hover:text-nia-orange transition-colors truncate">
                              {proc.is_key && (
                                <span className="text-nia-orange mr-1">{"\u2605"}</span>
                              )}
                              {proc.name}
                            </div>
                          </div>
                          {/* Health bar */}
                          <div className="w-24 flex-shrink-0">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${proc.health.total}%`,
                                  backgroundColor: proc.health.level.color,
                                }}
                              />
                            </div>
                          </div>
                          <span
                            className="text-xs font-medium w-8 text-right flex-shrink-0"
                            style={{ color: proc.health.level.color }}
                          >
                            {proc.health.total}
                          </span>
                        </Link>
                      ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Section C: Dimension Gap Analysis ───────────────── */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
          Dimension Gap Analysis
        </h2>
        <Card className="p-5">
          <div className="space-y-4">
            {dimensionAvgs.map((dim) => (
              <div key={dim.key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-nia-dark">{dim.label}</span>
                    {dim.isGap && (
                      <Badge color="orange" size="xs">Gap</Badge>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {dim.avg}/{dim.max}{" "}
                    <span className="text-xs text-gray-400">({dim.pct}%)</span>
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${dim.pct}%`,
                      backgroundColor: dim.pct >= 80 ? "#b1bd37" : dim.pct >= 50 ? "#55787c" : "#f79935",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Top Actions ─────────────────────────────────────── */}
      {topActions.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Top Actions to Improve Readiness
          </h2>
          <Card className="divide-y divide-gray-100">
            {topActions.map((action, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="w-6 h-6 rounded-full bg-nia-dark text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-nia-dark">{action.label}</div>
                  <div className="text-xs text-gray-400">
                    Applies to {action.count} process{action.count !== 1 ? "es" : ""}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-nia-orange">
                    +{action.totalPoints} pts
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
