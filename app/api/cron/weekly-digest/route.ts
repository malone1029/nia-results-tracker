import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { fetchHealthData } from "@/lib/fetch-health-data";
import { getReviewStatus } from "@/lib/review-status";
import {
  buildDigestHtml,
  type DigestData,
  type DigestOverdueMetric,
  type DigestStaleProcess,
  type DigestNextAction,
} from "@/lib/build-digest-html";

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check required env vars
  const resendKey = process.env.RESEND_API_KEY;
  const recipient = process.env.DIGEST_RECIPIENT_EMAIL;

  if (!resendKey || !recipient) {
    return NextResponse.json(
      { error: "Missing RESEND_API_KEY or DIGEST_RECIPIENT_EMAIL" },
      { status: 500 }
    );
  }

  // Service role client bypasses RLS — needed because cron has no user session
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // ── 1. Fetch all health data using the shared helper ──
    const { processes, healthScores, lastActivityMap } = await fetchHealthData(serviceClient);

    // ── 2. Compute org readiness score ──
    let totalWeight = 0;
    let weightedSum = 0;
    for (const proc of processes) {
      const health = healthScores.get(proc.id);
      if (!health) continue;
      const weight = proc.is_key ? 2 : 1;
      weightedSum += health.total * weight;
      totalWeight += weight;
    }
    const orgScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // ── 3. Get week-over-week delta from readiness snapshots ──
    const { data: snapshots } = await serviceClient
      .from("readiness_snapshots")
      .select("org_score, snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(2);

    let orgScoreDelta: number | null = null;
    if (snapshots && snapshots.length >= 2) {
      orgScoreDelta = orgScore - snapshots[1].org_score;
    } else if (snapshots && snapshots.length === 1) {
      orgScoreDelta = orgScore - snapshots[0].org_score;
    }

    // ── 4. Upsert today's readiness snapshot ──
    const today = new Date().toISOString().split("T")[0];
    const baldrigeReadyCount = processes.filter(
      (p) => (healthScores.get(p.id)?.total ?? 0) >= 80
    ).length;
    const needsAttentionCount = processes.filter((p) => {
      const health = healthScores.get(p.id);
      const lastActivity = lastActivityMap.get(p.id);
      const daysSince = lastActivity
        ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return (health && health.total < 40) || daysSince > 60;
    }).length;

    await serviceClient.from("readiness_snapshots").upsert(
      {
        snapshot_date: today,
        org_score: orgScore,
        ready_count: baldrigeReadyCount,
        attention_count: needsAttentionCount,
        total_processes: processes.length,
      },
      { onConflict: "snapshot_date" }
    );

    // ── 5. Find overdue metrics ──
    const { data: allMetrics } = await serviceClient
      .from("metrics")
      .select("id, name, cadence");
    const { data: allEntries } = await serviceClient
      .from("entries")
      .select("metric_id, date")
      .order("date", { ascending: false });
    const { data: metricLinks } = await serviceClient
      .from("metric_processes")
      .select("metric_id, process_id");

    // Build latest entry date per metric
    const latestEntryByMetric = new Map<number, string>();
    for (const e of allEntries || []) {
      if (!latestEntryByMetric.has(e.metric_id)) {
        latestEntryByMetric.set(e.metric_id, e.date);
      }
    }

    // Build metric → process name lookup
    const metricToProcess = new Map<number, string | null>();
    const processById = new Map(processes.map((p) => [p.id, p.name]));
    for (const link of metricLinks || []) {
      if (!metricToProcess.has(link.metric_id)) {
        metricToProcess.set(link.metric_id, processById.get(link.process_id) || null);
      }
    }

    const overdueMetrics: DigestOverdueMetric[] = [];
    const CADENCE_DAYS: Record<string, number> = {
      monthly: 30,
      quarterly: 90,
      "semi-annual": 182,
      annual: 365,
    };

    for (const m of allMetrics || []) {
      const lastDate = latestEntryByMetric.get(m.id);
      const status = getReviewStatus(m.cadence, lastDate || null);
      if (status === "overdue") {
        const cadenceDays = CADENCE_DAYS[m.cadence] || 365;
        const daysSince = lastDate
          ? Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        overdueMetrics.push({
          id: m.id,
          name: m.name,
          daysOverdue: Math.max(0, daysSince - cadenceDays),
          processName: metricToProcess.get(m.id) || null,
        });
      }
    }
    overdueMetrics.sort((a, b) => b.daysOverdue - a.daysOverdue);

    // ── 6. Find stale processes (>60 days since last activity) ──
    const staleProcesses: DigestStaleProcess[] = [];
    for (const proc of processes) {
      const lastActivity = lastActivityMap.get(proc.id);
      const daysSince = lastActivity
        ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      if (daysSince > 60) {
        staleProcesses.push({
          id: proc.id,
          name: proc.name,
          owner: proc.owner,
          daysSinceActivity: daysSince,
          healthScore: healthScores.get(proc.id)?.total ?? 0,
        });
      }
    }
    staleProcesses.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

    // ── 7. Aggregate next actions across all processes ──
    const actionMap = new Map<string, DigestNextAction>();
    for (const proc of processes) {
      const health = healthScores.get(proc.id);
      if (!health) continue;
      for (const action of health.nextActions) {
        // Normalize label by stripping process-specific text
        const key = action.label
          .replace(/for this process/gi, "")
          .replace(/\(\d+ days ago\)/g, "")
          .trim();
        const existing = actionMap.get(key);
        if (existing) {
          existing.points += action.points;
          existing.processCount++;
        } else {
          actionMap.set(key, {
            label: action.label,
            href: action.href || "/",
            points: action.points,
            processCount: 1,
          });
        }
      }
    }
    const nextActions = Array.from(actionMap.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    // ── 8. Team activity (who updated processes this week) ──
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString();

    const { data: recentImprovements } = await serviceClient
      .from("process_improvements")
      .select("process_id")
      .gte("committed_date", oneWeekAgoStr);

    const ownerUpdateCounts = new Map<string, number>();
    for (const imp of recentImprovements || []) {
      const proc = processes.find((p) => p.id === imp.process_id);
      const owner = proc?.owner || "Unknown";
      ownerUpdateCounts.set(owner, (ownerUpdateCounts.get(owner) || 0) + 1);
    }

    // Also count processes updated within the week
    for (const proc of processes) {
      if (proc.updated_at >= oneWeekAgoStr) {
        const owner = proc.owner || "Unknown";
        ownerUpdateCounts.set(owner, (ownerUpdateCounts.get(owner) || 0) + 1);
      }
    }

    const weeklyUpdates = Array.from(ownerUpdateCounts.entries())
      .map(([owner, processCount]) => ({ owner, processCount }))
      .sort((a, b) => b.processCount - a.processCount);

    // ── 9. Build and send email ──
    const digestData: DigestData = {
      orgScore,
      orgScoreDelta,
      baldrigeReadyCount,
      needsAttentionCount,
      totalProcesses: processes.length,
      overdueMetrics,
      staleProcesses,
      nextActions,
      weeklyUpdates,
    };

    const html = buildDigestHtml(digestData);
    const resend = new Resend(resendKey);

    const { error: emailError } = await resend.emails.send({
      from: "NIA Excellence Hub <onboarding@resend.dev>",
      to: recipient,
      subject: `NIA Weekly Digest — Readiness ${orgScore}/100${orgScoreDelta !== null ? (orgScoreDelta >= 0 ? ` (+${orgScoreDelta})` : ` (${orgScoreDelta})`) : ""}`,
      html,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      return NextResponse.json({ error: "Failed to send email", detail: emailError }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orgScore,
      orgScoreDelta,
      overdueMetrics: overdueMetrics.length,
      staleProcesses: staleProcesses.length,
      snapshotDate: today,
    });
  } catch (err) {
    console.error("Weekly digest error:", err);
    return NextResponse.json(
      { error: "Internal error", detail: String(err) },
      { status: 500 }
    );
  }
}
