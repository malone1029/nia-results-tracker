"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getReviewStatus } from "@/lib/review-status";
import { getMaturityLevel } from "@/lib/colors";
import { DashboardSkeleton } from "@/components/skeleton";
import AdliRadar from "@/components/adli-radar";
import { DimBar, MiniBar } from "@/components/adli-bars";
import EmptyState from "@/components/empty-state";
import { Card, CardHeader, Badge, Button, Select } from "@/components/ui";
import HealthRing from "@/components/health-ring";
import { fetchHealthData, type ProcessWithCategory } from "@/lib/fetch-health-data";
import { type HealthResult, type HealthNextAction } from "@/lib/process-health";
import WelcomeOnboarding, { hasCompletedOnboarding } from "@/components/welcome-onboarding";
import Link from "next/link";

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
  type: "overdue" | "due-soon";
  label: string;
  href: string;
  metricId?: number;
}

const ACTION_BADGE: Record<string, { color: "red" | "orange"; label: string }> = {
  overdue: { color: "red", label: "overdue" },
  "due-soon": { color: "orange", label: "due soon" },
};

export default function ProcessOwnerDashboardPage() {
  return (
    <Suspense>
      <ProcessOwnerDashboard />
    </Suspense>
  );
}

function ProcessOwnerDashboard() {
  const searchParams = useSearchParams();
  const forceWelcome = searchParams.get("welcome") === "true";
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [processes, setProcesses] = useState<ProcessWithCategory[]>([]);
  const [healthScores, setHealthScores] = useState<Map<number, HealthResult>>(new Map());
  const [lastActivityMap, setLastActivityMap] = useState<Map<number, string>>(new Map());
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [overdueMetrics, setOverdueMetrics] = useState<{ id: number; name: string; processOwner: string | null }[]>([]);
  const [dueSoonMetrics, setDueSoonMetrics] = useState<{ id: number; name: string; processOwner: string | null }[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("__all__");
  const [owners, setOwners] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | "key" | "support">("all");
  const [recentImprovements, setRecentImprovements] = useState<{ processId: number; processName: string; label: string; date: string; status: string }[]>([]);
  const [monthlyImprovedCount, setMonthlyImprovedCount] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [asanaConnected, setAsanaConnected] = useState(false);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    document.title = "Dashboard | NIA Excellence Hub";

    async function fetchAll() {
      // Fetch health data + user + ADLI scores + metric data + improvements in parallel
      const [healthData, userRes, scoresRes, metricsRes, metricProcessLinksRes, entriesRes, improvementsRes] = await Promise.all([
        fetchHealthData(),
        supabase.auth.getUser(),
        fetch("/api/ai/scores").then((r) => r.ok ? r.json() : []),
        supabase.from("metrics").select("id, name, cadence"),
        supabase.from("metric_processes").select("metric_id, process_id"),
        supabase.from("entries").select("metric_id, date").order("date", { ascending: false }),
        supabase.from("process_improvements").select("process_id, trigger_label, committed_date, status").order("committed_date", { ascending: false }).limit(20),
      ]);

      const procs = healthData.processes;
      setProcesses(procs);
      setHealthScores(healthData.healthScores);
      setLastActivityMap(healthData.lastActivityMap);

      // User
      const user = userRes.data?.user;
      const fullName = user?.user_metadata?.full_name || "";
      setUserName(fullName);
      const uid = user?.id || "";
      setUserId(uid);

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

      // ADLI scores for radar
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

      // Build metric -> owners lookup
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

      // Process improvements for team activity + streak
      const improvements = (improvementsRes.data || []) as { process_id: number; trigger_label: string; committed_date: string; status: string }[];
      const processNameMap = new Map<number, string>();
      for (const p of procs) processNameMap.set(p.id, p.name);

      const recent = improvements
        .filter((imp) => processNameMap.has(imp.process_id))
        .slice(0, 10)
        .map((imp) => ({
          processId: imp.process_id,
          processName: processNameMap.get(imp.process_id) || "Unknown",
          label: imp.trigger_label || "Improvement applied",
          date: imp.committed_date,
          status: imp.status,
        }));
      setRecentImprovements(recent);

      // Monthly improved: unique processes with improvements in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const monthlyProcs = new Set<number>();
      for (const imp of improvements) {
        if (imp.committed_date >= thirtyDaysAgo) monthlyProcs.add(imp.process_id);
      }
      setMonthlyImprovedCount(monthlyProcs.size);

      // Check if new user needs onboarding (never completed before)
      // Also allow ?welcome=true to force-preview the onboarding (e.g. returning from Asana OAuth)
      if (uid && (forceWelcome || !hasCompletedOnboarding(uid))) {
        // Check Asana connection status — URL param is a fast path from OAuth callback
        const urlAsana = new URLSearchParams(window.location.search).get("asana_connected") === "true";
        let connected = urlAsana;
        if (!connected) {
          try {
            const asanaRes = await fetch("/api/asana/status");
            const asanaData = asanaRes.ok ? await asanaRes.json() : { connected: false };
            connected = asanaData.connected;
          } catch {
            connected = false;
          }
        }
        setAsanaConnected(connected);
        setShowOnboarding(true);
      }

      setLoading(false);
    }
    fetchAll();
  }, []);

  if (loading) return <DashboardSkeleton />;

  // Welcome onboarding overlay for new users
  if (showOnboarding && userId) {
    return (
      <WelcomeOnboarding
        userName={userName}
        userId={userId}
        asanaConnected={asanaConnected}
        onComplete={() => setShowOnboarding(false)}
      />
    );
  }

  // Filter by selected owner + process type
  const isAll = selectedOwner === "__all__";
  const filteredProcesses = processes.filter((p) => {
    if (!isAll && p.owner !== selectedOwner) return false;
    if (typeFilter === "key" && p.process_type !== "key") return false;
    if (typeFilter === "support" && p.process_type !== "support") return false;
    return true;
  });
  const filteredProcessIds = new Set(filteredProcesses.map((p) => p.id));
  const filteredScores = scores.filter((s) => filteredProcessIds.has(s.process_id));
  const filteredOverdue = isAll
    ? overdueMetrics
    : overdueMetrics.filter((m) => m.processOwner === selectedOwner);
  const filteredDueSoon = isAll
    ? dueSoonMetrics
    : dueSoonMetrics.filter((m) => m.processOwner === selectedOwner);
  // ── Health-based stat card data ──
  const processCount = filteredProcesses.length;

  // My Readiness: avg health score across filtered processes
  let avgHealth = 0;
  let healthCount = 0;
  for (const proc of filteredProcesses) {
    const h = healthScores.get(proc.id);
    if (h) {
      avgHealth += h.total;
      healthCount++;
    }
  }
  avgHealth = healthCount > 0 ? Math.round(avgHealth / healthCount) : 0;
  const healthLevel = healthCount > 0
    ? (avgHealth >= 80 ? { label: "Baldrige Ready", color: "#b1bd37" }
      : avgHealth >= 60 ? { label: "On Track", color: "#55787c" }
      : avgHealth >= 40 ? { label: "Developing", color: "#f79935" }
      : { label: "Getting Started", color: "#dc2626" })
    : { label: "--", color: "var(--text-muted)" };

  // Baldrige Ready: count at 80+
  const baldrigeReadyCount = filteredProcesses.filter((p) => {
    const h = healthScores.get(p.id);
    return h && h.total >= 80;
  }).length;

  // Needs Attention: health < 40 OR last activity > 60 days
  const now = Date.now();
  const needsAttentionCount = filteredProcesses.filter((p) => {
    const h = healthScores.get(p.id);
    const lastDate = lastActivityMap.get(p.id);
    const stale = lastDate ? (now - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24) > 60 : false;
    const lowHealth = h ? h.total < 40 : true; // no score = needs attention
    return lowHealth || stale;
  }).length;

  // ADLI dimension averages (for radar)
  const avgAdli = filteredScores.length > 0
    ? Math.round(filteredScores.reduce((s, r) => s + r.overall_score, 0) / filteredScores.length)
    : 0;
  const dimAvgs = filteredScores.length > 0
    ? {
        approach: Math.round(filteredScores.reduce((s, r) => s + r.approach_score, 0) / filteredScores.length),
        deployment: Math.round(filteredScores.reduce((s, r) => s + r.deployment_score, 0) / filteredScores.length),
        learning: Math.round(filteredScores.reduce((s, r) => s + r.learning_score, 0) / filteredScores.length),
        integration: Math.round(filteredScores.reduce((s, r) => s + r.integration_score, 0) / filteredScores.length),
      }
    : null;
  const maturityLevel = getMaturityLevel(avgAdli);

  // Score map for ADLI bars
  const scoreMap = new Map<number, ScoreRow>();
  for (const s of filteredScores) {
    scoreMap.set(s.process_id, s);
  }

  // ── My Next Actions (aggregated from health scores) ──
  const allActions: (HealthNextAction & { processName: string })[] = [];
  for (const proc of filteredProcesses) {
    const h = healthScores.get(proc.id);
    if (h) {
      for (const action of h.nextActions) {
        allActions.push({ ...action, processName: proc.name });
      }
    }
  }
  // Deduplicate by normalized label, sum points
  const normalize = (s: string) => s.replace(/\bfor this process\b/gi, "").replace(/\bthis process\b/gi, "").replace(/\s+\(last updated \d+ days ago\)/i, "").trim().toLowerCase();
  const actionGroups = new Map<string, { label: string; points: number; count: number; href?: string }>();
  for (const a of allActions) {
    const key = normalize(a.label);
    const existing = actionGroups.get(key);
    if (existing) {
      existing.points += a.points;
      existing.count++;
      // When multiple processes need same action, link to process list instead
      if (existing.count > 1) existing.href = "/processes";
    } else {
      actionGroups.set(key, { label: a.label, points: a.points, count: 1, href: a.href });
    }
  }
  const topNextActions = [...actionGroups.values()]
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  // ── Recent Wins (milestones across filtered processes) ──
  const recentWins: { emoji: string; text: string; health?: number; color?: string }[] = [];
  for (const proc of filteredProcesses) {
    const h = healthScores.get(proc.id);
    if (!h) continue;
    const name = proc.name.length > 25 ? proc.name.slice(0, 25) + "..." : proc.name;
    if (h.total >= 80) {
      recentWins.push({ emoji: "\uD83C\uDFC6", text: `${name} is Baldrige Ready`, health: h.total, color: h.level.color });
    }
    if (h.dimensions.documentation.score === 25) {
      recentWins.push({ emoji: "\uD83D\uDCDD", text: `${name} — docs complete (25/25)` });
    }
  }
  // Cap at 3, prioritize Baldrige Ready
  const topWins = recentWins.sort((a, b) => (b.health ?? 0) - (a.health ?? 0)).slice(0, 3);

  // Action items (overdue + due-soon + drafts)
  const actionItems: ActionItem[] = [
    ...filteredOverdue.map((m) => ({
      type: "overdue" as const,
      label: m.name,
      href: `/metric/${m.id}`,
      metricId: m.id,
    })),
    ...filteredDueSoon.map((m) => ({
      type: "due-soon" as const,
      label: m.name,
      href: `/metric/${m.id}`,
      metricId: m.id,
    })),
  ];

  return (
    <div className="space-y-6 content-appear">
      {/* Header + owner selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">
            Process Owner Dashboard
          </h1>
          <p className="text-text-tertiary mt-1">
            {isAll ? "Organization-wide view" : `Showing ${selectedOwner}'s processes`}
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
          <label htmlFor="owner-select" className="text-sm text-text-tertiary">
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
        <Link href="/readiness" className="h-full">
          <Card variant="elevated" padding="sm" className="p-4 h-full hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-3">
              {healthCount > 0 ? (
                <HealthRing score={avgHealth} color={healthLevel.color} size={48} strokeWidth={4} />
              ) : (
                <div className="text-2xl font-bold font-display number-pop text-text-muted">--</div>
              )}
              <div>
                <div className="text-sm text-text-tertiary">My Readiness</div>
                {healthCount > 0 && (
                  <div className="text-xs font-medium" style={{ color: healthLevel.color }}>
                    {healthLevel.label}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Link>
        <StatCard
          label="Baldrige Ready"
          value={baldrigeReadyCount}
          color={baldrigeReadyCount > 0 ? "#b1bd37" : "var(--text-muted)"}
          subtitle={processCount > 0 ? `of ${processCount} processes` : undefined}
          href="/readiness"
        />
        <StatCard
          label="Needs Attention"
          value={needsAttentionCount}
          color={needsAttentionCount > 0 ? "#f79935" : "#b1bd37"}
          glow={needsAttentionCount > 0 ? "orange" : undefined}
          href="/processes"
        />
        <StatCard
          label="Overdue Metrics"
          value={filteredOverdue.length}
          color={filteredOverdue.length > 0 ? "#dc2626" : "#b1bd37"}
          glow={filteredOverdue.length > 0 ? "red" : undefined}
          href="/data-health"
        />
      </div>

      {processCount === 0 ? (
        !isAll ? (
          /* Filtered to a specific owner who has no processes */
          <Card>
            <EmptyState
              illustration="document"
              title={`No processes for ${selectedOwner}`}
              description="Try selecting a different owner or create a new process."
              action={{ label: "Go to Processes", href: "/processes" }}
            />
          </Card>
        ) : (
          /* No processes at all — rich getting-started card */
          <Card padding="lg">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-[#324a4d] mb-1">Get Started with Your First Process</h2>
              <p className="text-sm text-text-tertiary">Choose how you&apos;d like to add your first process to the Excellence Hub.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <Link
                href="/processes/import"
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border-light hover:border-[#324a4d]/40 hover:shadow-md bg-card transition-all group text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#324a4d] to-[#55787c] flex items-center justify-center shadow-sm">
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                    <path d="M12 3v12M12 3l-4 4M12 3l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(180deg)", transformOrigin: "center" }} />
                    <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#324a4d] group-hover:text-[#55787c]">Import from Asana</div>
                  <div className="text-xs text-text-muted mt-0.5">Bring in an existing project</div>
                </div>
              </Link>
              <Link
                href="/processes/new/ai"
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border-light hover:border-[#f79935]/40 hover:shadow-md bg-card transition-all group text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f79935] to-[#e88a28] flex items-center justify-center shadow-sm">
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white">
                    <path d="M12 2L14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" opacity="0.3" />
                    <path d="M12 2L14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#324a4d] group-hover:text-[#f79935]">Create with AI</div>
                  <div className="text-xs text-text-muted mt-0.5">AI builds it from your answers</div>
                </div>
              </Link>
              <Link
                href="/processes/new"
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border-light hover:border-border hover:shadow-md bg-card transition-all group text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-surface-subtle flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#55787c]">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#324a4d] group-hover:text-text-secondary">Create Manually</div>
                  <div className="text-xs text-text-muted mt-0.5">Start from a blank template</div>
                </div>
              </Link>
            </div>
            <div className="text-center mt-5">
              <Link href="/processes" className="text-xs text-[#55787c] hover:text-[#324a4d] underline underline-offset-2">
                Or browse existing processes
              </Link>
            </div>
          </Card>
        )
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: ADLI Overview + Status Breakdown */}
          <div className="space-y-6">
            {/* ADLI Overview */}
            <Card padding="md">
              <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">
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

          </div>

          {/* Right column: Action Items + My Next Actions + My Processes */}
          <div className="space-y-6">
            {/* Action Items */}
            <Card padding="md">
              <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
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
                        className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-surface-hover transition-colors group"
                      >
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${item.type === "overdue" ? "overdue-pulse" : ""}`}
                          style={{
                            backgroundColor:
                              item.type === "overdue"
                                ? "#dc2626"
                                : item.type === "due-soon"
                                ? "#f79935"
                                : "var(--text-muted)",
                          }}
                        />
                        <span className="text-sm text-nia-dark group-hover:text-nia-orange transition-colors truncate">
                          {item.label}
                        </span>
                        <Badge color={badgeInfo.color} size="xs" className="ml-auto flex-shrink-0">
                          {badgeInfo.label}
                        </Badge>
                        {item.metricId && (
                          <Link
                            href={`/log?metricId=${item.metricId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="ml-1.5 text-xs font-medium text-nia-grey-blue hover:text-nia-dark bg-surface-subtle hover:bg-surface-muted rounded px-2 py-0.5 transition-colors flex-shrink-0"
                          >
                            Log
                          </Link>
                        )}
                      </Link>
                    );
                  })}
                  {actionItems.length > 8 && (
                    <p className="text-xs text-text-muted px-2 pt-1">
                      +{actionItems.length - 8} more
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* My Next Actions (from health scores) */}
            {topNextActions.length > 0 && (
              <Card padding="md">
                <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                  {isAll ? "Top Actions for Readiness" : "My Next Actions"}
                </h2>
                <div className="space-y-2">
                  {topNextActions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-1.5 px-2">
                      <span className="text-nia-orange font-bold text-sm mt-px">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        {action.href ? (
                          <Link href={action.href} className="text-sm text-nia-dark hover:text-nia-orange transition-colors">
                            {action.label}
                          </Link>
                        ) : (
                          <span className="text-sm text-nia-dark">{action.label}</span>
                        )}
                        <div className="text-xs text-text-muted mt-0.5">
                          +{action.points} pts{action.count > 1 ? ` across ${action.count} processes` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Progress Momentum + Recent Wins */}
            {(monthlyImprovedCount > 0 || topWins.length > 0) && (
              <Card padding="md">
                {/* Progress Streak */}
                {monthlyImprovedCount > 0 && (
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-nia-green/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm">{"\uD83D\uDD25"}</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-nia-dark">
                        {monthlyImprovedCount} process{monthlyImprovedCount !== 1 ? "es" : ""} improved this month
                      </div>
                      <div className="text-xs text-text-muted">Keep the momentum going!</div>
                    </div>
                  </div>
                )}

                {/* Recent Wins */}
                {topWins.length > 0 && (
                  <>
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                      Recent Wins
                    </h3>
                    <div className="space-y-1.5">
                      {topWins.map((win, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <span className="text-sm flex-shrink-0">{win.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-nia-dark truncate block">{win.text}</span>
                          </div>
                          {win.health !== undefined && (
                            <HealthRing score={win.health} color={win.color || "#b1bd37"} size={22} strokeWidth={2} className="text-[7px] flex-shrink-0" animate={false} />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            )}

            {/* Team Activity */}
            {isAll && recentImprovements.length > 0 && (
              <Card padding="md">
                <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                  Recent Activity
                </h2>
                <div className="space-y-1">
                  {recentImprovements.slice(0, 5).map((imp, i) => {
                    const daysAgo = Math.floor((Date.now() - new Date(imp.date).getTime()) / (1000 * 60 * 60 * 24));
                    const timeLabel = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo}d ago`;
                    return (
                      <Link
                        key={i}
                        href={`/processes/${imp.processId}`}
                        className="flex items-start gap-2 py-1.5 px-1 rounded hover:bg-surface-hover transition-colors group"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-nia-green mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-nia-dark group-hover:text-nia-orange transition-colors">
                            <span className="font-medium">{imp.processName}</span>
                            {" \u2014 "}
                            {imp.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-muted flex-shrink-0 mt-px">{timeLabel}</span>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* My Processes */}
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider">
                  {isAll ? "All Processes" : "My Processes"}
                </h2>
              </CardHeader>
              <div className="divide-y divide-border-light">
                {filteredProcesses.map((proc) => {
                  const score = scoreMap.get(proc.id);
                  const health = healthScores.get(proc.id);
                  return (
                    <Link
                      key={proc.id}
                      href={`/processes/${proc.id}`}
                      className="block px-5 py-3 hover:bg-surface-hover/80 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {health && (
                            <HealthRing score={health.total} color={health.level.color} size={28} strokeWidth={2.5} className="text-[8px] flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-nia-dark truncate">
                            {proc.name}
                          </span>
                          {proc.process_type === "key" && (
                            <Badge color="orange" size="xs" pill={false}>
                              KEY
                            </Badge>
                          )}
                          {proc.process_type === "support" && (
                            <span className="text-[10px] text-text-muted">Support</span>
                          )}
                          {proc.asana_project_gid && (
                            <svg
                              className="w-3.5 h-3.5 text-text-muted flex-shrink-0"
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
                      </div>
                      {score && (
                        <div className="grid grid-cols-4 gap-2">
                          <MiniBar label="A" score={score.approach_score} />
                          <MiniBar label="D" score={score.deployment_score} />
                          <MiniBar label="L" score={score.learning_score} />
                          <MiniBar label="I" score={score.integration_score} />
                        </div>
                      )}
                      <div className="text-[10px] text-text-muted mt-1">
                        {proc.category_display_name}
                        {proc.owner && ` \u00b7 ${proc.owner}`}
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
  glow,
  href,
}: {
  label: string;
  value: number | string;
  color: string;
  subtitle?: string;
  glow?: "red" | "orange" | "green" | "dark";
  href?: string;
}) {
  const card = (
    <Card variant="elevated" padding="sm" className={`p-4 h-full ${glow ? `glow-${glow}` : ""} ${href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}>
      <div className="text-2xl font-bold font-display number-pop" style={{ color }}>
        {value}
      </div>
      <div className="text-sm text-text-tertiary mt-0.5">{label}</div>
      {subtitle && (
        <div className="text-xs mt-0.5" style={{ color }}>
          {subtitle}
        </div>
      )}
    </Card>
  );

  if (href) {
    return <Link href={href} className="h-full">{card}</Link>;
  }
  return card;
}
