"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getReviewStatus } from "@/lib/review-status";
import { getMaturityLevel } from "@/lib/colors";
import { DashboardSkeleton } from "@/components/skeleton";
import AdliRadar from "@/components/adli-radar";
import { DimBar, MiniBar } from "@/components/adli-bars";
import EmptyState from "@/components/empty-state";
import { Card, CardHeader, Badge, Select } from "@/components/ui";
import Link from "next/link";

interface ProcessRow {
  id: number;
  name: string;
  status: string;
  owner: string | null;
  is_key: boolean;
  asana_project_gid: string | null;
  asana_project_url: string | null;
  categories: { display_name: string };
}

interface ScoreRow {
  process_id: number;
  approach_score: number;
  deployment_score: number;
  learning_score: number;
  integration_score: number;
  overall_score: number;
  assessed_at: string;
}

interface ActionItem {
  type: "overdue" | "due-soon" | "draft";
  label: string;
  href: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready_for_review: "Ready for Review",
  approved: "Approved",
};

const STATUS_BADGE_COLORS: Record<string, "gray" | "orange" | "green"> = {
  draft: "gray",
  ready_for_review: "orange",
  approved: "green",
};

const ACTION_BADGE: Record<string, { color: "red" | "orange" | "gray"; label: string }> = {
  overdue: { color: "red", label: "overdue" },
  "due-soon": { color: "orange", label: "due soon" },
  draft: { color: "gray", label: "draft" },
};

export default function ProcessOwnerDashboard() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [overdueMetrics, setOverdueMetrics] = useState<{ id: number; name: string; processOwner: string | null }[]>([]);
  const [dueSoonMetrics, setDueSoonMetrics] = useState<{ id: number; name: string; processOwner: string | null }[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("__all__");
  const [owners, setOwners] = useState<string[]>([]);

  useEffect(() => {
    document.title = "Dashboard | NIA Excellence Hub";

    async function fetchAll() {
      const [userRes, procRes, scoresRes, metricsRes, metricProcessLinksRes, entriesRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("processes").select("id, name, status, owner, is_key, asana_project_gid, asana_project_url, categories(display_name)"),
        fetch("/api/ai/scores").then((r) => r.ok ? r.json() : []),
        supabase.from("metrics").select("id, name, cadence"),
        supabase.from("metric_processes").select("metric_id, process_id"),
        supabase.from("entries").select("metric_id, date").order("date", { ascending: false }),
      ]);

      // User
      const fullName = userRes.data?.user?.user_metadata?.full_name || "";
      setUserName(fullName);

      // Processes
      const procs = (procRes.data || []) as unknown as ProcessRow[];
      setProcesses(procs);

      // Owners (deduplicated, sorted)
      const ownerSet = new Set<string>();
      for (const p of procs) {
        if (p.owner) ownerSet.add(p.owner);
      }
      const sortedOwners = [...ownerSet].sort();
      setOwners(sortedOwners);

      // Auto-select logged-in user if they own processes
      if (fullName) {
        const match = sortedOwners.find(
          (o) => o.toLowerCase() === fullName.toLowerCase()
        );
        if (match) setSelectedOwner(match);
      }

      // Scores
      const scoreRows = (scoresRes || []).map((s: Record<string, unknown>) => ({
        process_id: s.process_id as number,
        approach_score: s.approach_score as number,
        deployment_score: s.deployment_score as number,
        learning_score: s.learning_score as number,
        integration_score: s.integration_score as number,
        overall_score: s.overall_score as number,
        assessed_at: s.assessed_at as string,
      }));
      setScores(scoreRows);

      // Metric review status for action items
      const metricsData = (metricsRes.data || []) as { id: number; name: string; cadence: string }[];
      const metricProcessLinks = (metricProcessLinksRes.data || []) as { metric_id: number; process_id: number }[];
      const entriesData = (entriesRes.data || []) as { metric_id: number; date: string }[];

      // Build process owner lookup
      const processOwnerMap = new Map<number, string | null>();
      for (const p of procs) {
        processOwnerMap.set(p.id, p.owner);
      }

      // Build metric -> owners lookup (a metric linked to 2 processes = 2 owners)
      const metricOwners = new Map<number, Set<string>>();
      for (const link of metricProcessLinks) {
        const owner = processOwnerMap.get(link.process_id);
        if (owner) {
          if (!metricOwners.has(link.metric_id)) metricOwners.set(link.metric_id, new Set());
          metricOwners.get(link.metric_id)!.add(owner);
        }
      }

      // Latest entry per metric
      const latestDates = new Map<number, string>();
      for (const e of entriesData) {
        if (!latestDates.has(e.metric_id)) {
          latestDates.set(e.metric_id, e.date);
        }
      }

      // A metric linked to 2 processes with different owners shows for both
      const overdue: typeof overdueMetrics = [];
      const dueSoon: typeof dueSoonMetrics = [];
      for (const m of metricsData) {
        const status = getReviewStatus(m.cadence, latestDates.get(m.id) || null);
        const owners = metricOwners.get(m.id);
        if (status === "overdue") {
          if (owners && owners.size > 0) {
            for (const owner of owners) {
              overdue.push({ id: m.id, name: m.name, processOwner: owner });
            }
          } else {
            overdue.push({ id: m.id, name: m.name, processOwner: null });
          }
        } else if (status === "due-soon") {
          if (owners && owners.size > 0) {
            for (const owner of owners) {
              dueSoon.push({ id: m.id, name: m.name, processOwner: owner });
            }
          } else {
            dueSoon.push({ id: m.id, name: m.name, processOwner: null });
          }
        }
      }
      setOverdueMetrics(overdue);
      setDueSoonMetrics(dueSoon);

      setLoading(false);
    }
    fetchAll();
  }, []);

  if (loading) return <DashboardSkeleton />;

  // Filter by selected owner
  const isAll = selectedOwner === "__all__";
  const filteredProcesses = isAll
    ? processes
    : processes.filter((p) => p.owner === selectedOwner);
  const filteredProcessIds = new Set(filteredProcesses.map((p) => p.id));
  const filteredScores = scores.filter((s) => filteredProcessIds.has(s.process_id));
  const filteredOverdue = isAll
    ? overdueMetrics
    : overdueMetrics.filter((m) => m.processOwner === selectedOwner);
  const filteredDueSoon = isAll
    ? dueSoonMetrics
    : dueSoonMetrics.filter((m) => m.processOwner === selectedOwner);
  const filteredDraftProcesses = filteredProcesses.filter((p) => p.status === "draft");

  // Stat cards
  const processCount = filteredProcesses.length;
  const avgAdli = filteredScores.length > 0
    ? Math.round(filteredScores.reduce((s, r) => s + r.overall_score, 0) / filteredScores.length)
    : 0;
  const asanaLinked = filteredProcesses.filter((p) => p.asana_project_gid).length;

  // ADLI dimension averages
  const dimAvgs = filteredScores.length > 0
    ? {
        approach: Math.round(filteredScores.reduce((s, r) => s + r.approach_score, 0) / filteredScores.length),
        deployment: Math.round(filteredScores.reduce((s, r) => s + r.deployment_score, 0) / filteredScores.length),
        learning: Math.round(filteredScores.reduce((s, r) => s + r.learning_score, 0) / filteredScores.length),
        integration: Math.round(filteredScores.reduce((s, r) => s + r.integration_score, 0) / filteredScores.length),
      }
    : null;

  const maturityLevel = getMaturityLevel(avgAdli);

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  for (const p of filteredProcesses) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  }

  // Score map for process list
  const scoreMap = new Map<number, ScoreRow>();
  for (const s of filteredScores) {
    scoreMap.set(s.process_id, s);
  }

  // Action items
  const actionItems: ActionItem[] = [
    ...filteredOverdue.map((m) => ({
      type: "overdue" as const,
      label: m.name,
      href: `/metric/${m.id}`,
    })),
    ...filteredDueSoon.map((m) => ({
      type: "due-soon" as const,
      label: m.name,
      href: `/metric/${m.id}`,
    })),
    ...filteredDraftProcesses.map((p) => ({
      type: "draft" as const,
      label: p.name,
      href: `/processes/${p.id}`,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header + owner selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">
            Process Owner Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            {isAll ? "Organization-wide view" : `Showing ${selectedOwner}'s processes`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="owner-select" className="text-sm text-gray-500">
            Owner:
          </label>
          <Select
            id="owner-select"
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            size="sm"
            className="w-auto"
          >
            <option value="__all__">All Owners</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Processes" value={processCount} color="#324a4d" />
        <StatCard
          label="Avg ADLI"
          value={filteredScores.length > 0 ? `${avgAdli}%` : "--"}
          color={maturityLevel.color}
          subtitle={filteredScores.length > 0 ? maturityLevel.label : undefined}
        />
        <StatCard
          label="Overdue Metrics"
          value={filteredOverdue.length}
          color={filteredOverdue.length > 0 ? "#dc2626" : "#b1bd37"}
        />
        <StatCard label="Asana Linked" value={asanaLinked} color="#55787c" />
      </div>

      {processCount === 0 ? (
        <Card>
          <EmptyState
            illustration="document"
            title={isAll ? "No processes yet" : `No processes for ${selectedOwner}`}
            description={
              isAll
                ? "Create your first process to get started with the Excellence Hub."
                : "Try selecting a different owner or create a new process."
            }
            action={{ label: "Go to Processes", href: "/processes" }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: ADLI Overview + Status Breakdown */}
          <div className="space-y-6">
            {/* ADLI Overview */}
            <Card padding="md">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                ADLI Overview
              </h2>
              {dimAvgs ? (
                <>
                  <div className="flex justify-center mb-4">
                    <AdliRadar
                      approach={dimAvgs.approach}
                      deployment={dimAvgs.deployment}
                      learning={dimAvgs.learning}
                      integration={dimAvgs.integration}
                      size={200}
                    />
                  </div>
                  <div className="text-center mb-4">
                    <span
                      className="text-3xl font-bold font-display number-pop"
                      style={{ color: maturityLevel.color }}
                    >
                      {avgAdli}%
                    </span>
                    <span
                      className="text-sm font-medium ml-2"
                      style={{ color: maturityLevel.color }}
                    >
                      {maturityLevel.label}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <DimBar label="Approach" score={dimAvgs.approach} />
                    <DimBar label="Deployment" score={dimAvgs.deployment} />
                    <DimBar label="Learning" score={dimAvgs.learning} />
                    <DimBar label="Integration" score={dimAvgs.integration} />
                  </div>
                </>
              ) : (
                <EmptyState
                  illustration="radar"
                  title="No ADLI scores yet"
                  description="Run an AI analysis on any process to see maturity scores here."
                  compact
                />
              )}
            </Card>

            {/* Status Breakdown */}
            <Card padding="md">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Status Breakdown
              </h2>
              <div className="space-y-2">
                {Object.entries(STATUS_LABELS).map(([status, label]) => {
                  const count = statusCounts[status] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <Badge color={STATUS_BADGE_COLORS[status] || "gray"} dot size="sm">
                        {label}
                      </Badge>
                      <span className="text-sm font-bold text-nia-dark">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Right column: Action Items + My Processes */}
          <div className="space-y-6">
            {/* Action Items */}
            <Card padding="md">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Action Items
              </h2>
              {actionItems.length === 0 ? (
                <EmptyState
                  illustration="check"
                  title="All caught up!"
                  description="No overdue metrics or draft processes."
                  compact
                />
              ) : (
                <div className="space-y-1">
                  {actionItems.slice(0, 8).map((item, i) => {
                    const badgeInfo = ACTION_BADGE[item.type];
                    return (
                      <Link
                        key={`${item.type}-${i}`}
                        href={item.href}
                        className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              item.type === "overdue"
                                ? "#dc2626"
                                : item.type === "due-soon"
                                ? "#f79935"
                                : "#9ca3af",
                          }}
                        />
                        <span className="text-sm text-nia-dark group-hover:text-nia-orange transition-colors truncate">
                          {item.label}
                        </span>
                        <Badge color={badgeInfo.color} size="xs" className="ml-auto flex-shrink-0">
                          {badgeInfo.label}
                        </Badge>
                      </Link>
                    );
                  })}
                  {actionItems.length > 8 && (
                    <p className="text-xs text-gray-400 px-2 pt-1">
                      +{actionItems.length - 8} more
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* My Processes */}
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  {isAll ? "All Processes" : "My Processes"}
                </h2>
              </CardHeader>
              <div className="divide-y divide-gray-50">
                {filteredProcesses.map((proc) => {
                  const score = scoreMap.get(proc.id);
                  const pLevel = score ? getMaturityLevel(score.overall_score) : null;
                  return (
                    <Link
                      key={proc.id}
                      href={`/processes/${proc.id}`}
                      className="block px-5 py-3 hover:bg-gray-50/80 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-nia-dark truncate">
                            {proc.name}
                          </span>
                          {proc.is_key && (
                            <Badge color="orange" size="xs" pill={false}>
                              KEY
                            </Badge>
                          )}
                          {proc.asana_project_gid && (
                            <svg
                              className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-label="Linked to Asana"
                            >
                              <circle cx="12" cy="6" r="4.5" />
                              <circle cx="5" cy="18" r="4.5" />
                              <circle cx="19" cy="18" r="4.5" />
                            </svg>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            color={STATUS_BADGE_COLORS[proc.status] || "gray"}
                            size="xs"
                          >
                            {STATUS_LABELS[proc.status] || proc.status}
                          </Badge>
                          {pLevel && (
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                              style={{ backgroundColor: pLevel.bgColor }}
                            >
                              {score!.overall_score}%
                            </span>
                          )}
                        </div>
                      </div>
                      {score && (
                        <div className="grid grid-cols-4 gap-2">
                          <MiniBar label="A" score={score.approach_score} />
                          <MiniBar label="D" score={score.deployment_score} />
                          <MiniBar label="L" score={score.learning_score} />
                          <MiniBar label="I" score={score.integration_score} />
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-1">
                        {proc.categories?.display_name}
                        {proc.owner && ` · ${proc.owner}`}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  subtitle,
}: {
  label: string;
  value: number | string;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card variant="elevated" padding="sm" className="p-4">
      <div className="text-2xl font-bold font-display number-pop" style={{ color }}>
        {value}
      </div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
      {subtitle && (
        <div className="text-xs mt-0.5" style={{ color }}>
          {subtitle}
        </div>
      )}
    </Card>
  );
}
