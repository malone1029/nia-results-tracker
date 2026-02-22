"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getReviewStatus } from "@/lib/review-status";
import { getMaturityLevel } from "@/lib/colors";
import { DashboardSkeleton } from "@/components/skeleton";
import EmptyState from "@/components/empty-state";
import { Card, Select } from "@/components/ui";
import { fetchHealthData, type ProcessWithCategory } from "@/lib/fetch-health-data";
import { type HealthResult, type HealthNextAction } from "@/lib/process-health";
import WelcomeOnboarding, { hasCompletedOnboarding } from "@/components/welcome-onboarding";
import PageTour from "@/components/page-tour";
import ContextualTip from "@/components/contextual-tip";
import Link from "next/link";

// Dashboard components
import StatCardsRow from "@/components/dashboard/stat-cards";
import TaskHub from "@/components/dashboard/task-hub";
import AdliOverview from "@/components/dashboard/adli-overview";
import { MetricActionItems, NextActions } from "@/components/dashboard/action-items";
import { MomentumAndWins, RecentActivity } from "@/components/dashboard/activity-feed";
import ProcessList from "@/components/dashboard/process-list";
import type { ScoreRow, ActionItem, DashboardTaskData } from "@/components/dashboard/types";

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
  const [dashboardTasks, setDashboardTasks] = useState<DashboardTaskData | null>(null);

  // Fetch task data (called on mount and when owner changes)
  const fetchTaskData = useCallback(async (owner: string) => {
    try {
      const params = owner !== "__all__" ? `?owner=${encodeURIComponent(owner)}` : "";
      const res = await fetch(`/api/tasks/dashboard${params}`);
      if (res.ok) {
        const data = await res.json();
        setDashboardTasks(data);
      }
    } catch {
      // Task data is supplemental — don't block the dashboard
    }
  }, []);

  useEffect(() => {
    document.title = "Dashboard | NIA Excellence Hub";

    async function fetchAll() {
      // Fetch health data + user + ADLI scores + metric data + improvements + tasks in parallel
      const [healthData, userRes, scoresRes, metricsRes, metricProcessLinksRes, entriesRes, improvementsRes, tasksRes] = await Promise.all([
        fetchHealthData(),
        supabase.auth.getUser(),
        fetch("/api/ai/scores").then((r) => r.ok ? r.json() : []),
        supabase.from("metrics").select("id, name, cadence"),
        supabase.from("metric_processes").select("metric_id, process_id"),
        supabase.from("entries").select("metric_id, date").order("date", { ascending: false }),
        supabase.from("improvement_journal").select("process_id, title, created_at, status").order("created_at", { ascending: false }).limit(20),
        fetch("/api/tasks/dashboard").then((r) => r.ok ? r.json() : null),
      ]);

      const procs = healthData.processes;
      setProcesses(procs);
      setHealthScores(healthData.healthScores);
      setLastActivityMap(healthData.lastActivityMap);

      // Task data
      if (tasksRes) setDashboardTasks(tasksRes);

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
        if (match) {
          setSelectedOwner(match);
          // Re-fetch tasks filtered to this owner
          fetch(`/api/tasks/dashboard?owner=${encodeURIComponent(match)}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data) setDashboardTasks(data); })
            .catch(() => {});
        }
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
      const improvements = (improvementsRes.data || []) as { process_id: number; title: string; created_at: string; status: string }[];
      const processNameMap = new Map<number, string>();
      for (const p of procs) processNameMap.set(p.id, p.name);

      const recent = improvements
        .filter((imp) => processNameMap.has(imp.process_id))
        .slice(0, 10)
        .map((imp) => ({
          processId: imp.process_id,
          processName: processNameMap.get(imp.process_id) || "Unknown",
          label: imp.title || "Improvement recorded",
          date: imp.created_at,
          status: imp.status,
        }));
      setRecentImprovements(recent);

      // Monthly improved: unique processes with improvements in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const monthlyProcs = new Set<number>();
      for (const imp of improvements) {
        if (imp.created_at >= thirtyDaysAgo) monthlyProcs.add(imp.process_id);
      }
      setMonthlyImprovedCount(monthlyProcs.size);

      // Check if new user needs onboarding
      if (uid && (forceWelcome || !hasCompletedOnboarding(uid))) {
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch tasks when owner filter changes (after initial load)
  const handleOwnerChange = (newOwner: string) => {
    setSelectedOwner(newOwner);
    fetchTaskData(newOwner);
  };

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

  // ── Derived data (filter-dependent) ──
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

  const processCount = filteredProcesses.length;

  // Health averages
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

  const baldrigeReadyCount = filteredProcesses.filter((p) => {
    const h = healthScores.get(p.id);
    return h && h.total >= 80;
  }).length;

  const now = Date.now();
  const needsAttentionCount = filteredProcesses.filter((p) => {
    const h = healthScores.get(p.id);
    const lastDate = lastActivityMap.get(p.id);
    const stale = lastDate ? (now - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24) > 60 : false;
    const lowHealth = h ? h.total < 40 : true;
    return lowHealth || stale;
  }).length;

  // ADLI averages
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

  // Score map for process list ADLI bars
  const scoreMap = new Map<number, ScoreRow>();
  for (const s of filteredScores) {
    scoreMap.set(s.process_id, s);
  }

  // Next actions (aggregated from health scores)
  const allActions: (HealthNextAction & { processName: string })[] = [];
  for (const proc of filteredProcesses) {
    const h = healthScores.get(proc.id);
    if (h) {
      for (const action of h.nextActions) {
        allActions.push({ ...action, processName: proc.name });
      }
    }
  }
  const normalize = (s: string) => s.replace(/\bfor this process\b/gi, "").replace(/\bthis process\b/gi, "").replace(/\s+\(last updated \d+ days ago\)/i, "").trim().toLowerCase();
  const actionGroups = new Map<string, { label: string; points: number; count: number; href?: string }>();
  for (const a of allActions) {
    const key = normalize(a.label);
    const existing = actionGroups.get(key);
    if (existing) {
      existing.points += a.points;
      existing.count++;
      if (existing.count > 1) existing.href = "/processes";
    } else {
      actionGroups.set(key, { label: a.label, points: a.points, count: 1, href: a.href });
    }
  }
  const topNextActions = [...actionGroups.values()]
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  // Recent wins
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
  const topWins = recentWins.sort((a, b) => (b.health ?? 0) - (a.health ?? 0)).slice(0, 3);

  // Metric action items
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

  // Personalized header
  const firstName = userName ? userName.split(" ")[0] : "";

  return (
    <div className="space-y-6 content-appear">
      {/* ── Header + filter toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">
            {!isAll && firstName ? `Welcome back, ${firstName}` : "Excellence Hub"}
          </h1>
          <p className="text-text-tertiary mt-1">
            {!isAll && userName
              ? `${userName}'s Excellence Hub`
              : "Organization-wide overview"}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-surface-subtle rounded-xl p-2">
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
            onChange={(e) => handleOwnerChange(e.target.value)}
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

      <PageTour />

      {/* ── Stat cards (5-wide) ── */}
      <div data-tour="stat-cards">
      <StatCardsRow
        avgHealth={avgHealth}
        healthCount={healthCount}
        healthLevel={healthLevel}
        baldrigeReadyCount={baldrigeReadyCount}
        processCount={processCount}
        needsAttentionCount={needsAttentionCount}
        overdueMetricCount={filteredOverdue.length}
        overdueTaskCount={dashboardTasks?.stats.totalOverdue ?? 0}
        taskStats={dashboardTasks?.stats ?? null}
      />
      </div>

      {/* Contextual tip: low health */}
      <ContextualTip tipId="dashboard-low-health" show={avgHealth < 40 && processCount > 0}>
        Focus on processes marked &quot;Needs Attention&quot; to improve your readiness score.
      </ContextualTip>

      {processCount === 0 ? (
        !isAll ? (
          <Card>
            <EmptyState
              illustration="document"
              title={`No processes for ${selectedOwner}`}
              description="Try selecting a different owner or create a new process."
              action={{ label: "Go to Processes", href: "/processes" }}
            />
          </Card>
        ) : (
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
        <>
          {/* ── Task Hub (full width, most prominent) ── */}
          {dashboardTasks && (
            <div data-tour="task-hub">
            <TaskHub
              data={dashboardTasks}
              isAllOwners={isAll}
              onRefresh={() => fetchTaskData(selectedOwner)}
            />
            </div>
          )}

          {/* ── ADLI + Actions (two-column) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <AdliOverview dimAvgs={dimAvgs} avgAdli={avgAdli} maturityLevel={maturityLevel} />
            </div>
            <div className="space-y-6">
              <MetricActionItems items={actionItems} />
              <NextActions actions={topNextActions} isAllOwners={isAll} />
              <MomentumAndWins monthlyImprovedCount={monthlyImprovedCount} wins={topWins} />
            </div>
          </div>

          {/* ── Processes (full width) ── */}
          <div data-tour="process-list">
          <ProcessList
            processes={filteredProcesses}
            healthScores={healthScores}
            scoreMap={scoreMap}
            isAllOwners={isAll}
          />
          </div>

          {/* ── Recent Activity (full width, org-only) ── */}
          {isAll && (
            <RecentActivity improvements={recentImprovements} />
          )}
        </>
      )}
    </div>
  );
}
