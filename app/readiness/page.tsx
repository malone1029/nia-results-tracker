"use client";

import { useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/skeleton";
import { Card, Badge } from "@/components/ui";
import HealthRing from "@/components/health-ring";
import {
  getHealthLevel,
  type HealthResult,
  type HealthNextAction,
} from "@/lib/process-health";
import {
  fetchHealthData,
  type ProcessWithCategory,
  type CategoryRow,
} from "@/lib/fetch-health-data";
import Link from "next/link";

// ── Dimension metadata ───────────────────────────────────────
const DIMENSION_CONFIG: { key: keyof HealthResult["dimensions"]; label: string; max: number }[] = [
  { key: "documentation", label: "Documentation", max: 25 },
  { key: "maturity", label: "Maturity", max: 25 },
  { key: "measurement", label: "Measurement", max: 20 },
  { key: "operations", label: "Operations", max: 15 },
  { key: "freshness", label: "Freshness", max: 15 },
];

export default function ReadinessPage() {
  const [processes, setProcesses] = useState<ProcessWithCategory[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [healthScores, setHealthScores] = useState<Map<number, HealthResult>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Readiness | NIA Excellence Hub";

    async function load() {
      const data = await fetchHealthData();
      setProcesses(data.processes);
      setCategories(data.categories);
      setHealthScores(data.healthScores);
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
  // Collect all nextActions, normalize labels, sum points, dedupe
  const actionMap = new Map<string, { label: string; totalPoints: number; count: number; href?: string }>();
  for (const proc of processes) {
    const h = healthScores.get(proc.id);
    if (!h) continue;
    for (const action of h.nextActions) {
      // Normalize: strip "for this process", "to this process", trim
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

  return (
    <div className="space-y-8 content-appear">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-nia-dark font-display">
          Baldrige Readiness
        </h1>
        <p className="text-gray-500 mt-1">
          Organization-wide readiness for a Baldrige Excellence application
        </p>
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
