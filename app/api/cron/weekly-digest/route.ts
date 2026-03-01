import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { fetchHealthData } from '@/lib/fetch-health-data';
import { getReviewStatus } from '@/lib/review-status';
import type { HealthResult } from '@/lib/process-health';
import type { ProcessWithCategory } from '@/lib/fetch-health-data';
import {
  buildDigestHtml,
  type DigestOverdueMetric,
  type DigestStaleProcess,
  type DigestNextAction,
} from '@/lib/build-digest-html';

export const maxDuration = 60;

// Cadence → days mapping (same as review-status.ts)
const CADENCE_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  'semi-annual': 182,
  annual: 365,
};

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'Missing RESEND_API_KEY' }, { status: 500 });
  }

  // Service role client bypasses RLS — needed because cron has no user session
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // ── 1. Fetch all health data ──
    const { processes, healthScores, lastActivityMap } = await fetchHealthData(serviceClient);

    // ── 2. Compute org-wide stats ──
    let totalWeight = 0;
    let weightedSum = 0;
    for (const proc of processes) {
      const health = healthScores.get(proc.id);
      if (!health) continue;
      const weight = proc.process_type === 'key' ? 2 : 1;
      weightedSum += health.total * weight;
      totalWeight += weight;
    }
    const orgScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // ── 3. Week-over-week delta from readiness snapshots ──
    const { data: snapshots } = await serviceClient
      .from('readiness_snapshots')
      .select('org_score, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(2);

    let orgScoreDelta: number | null = null;
    if (snapshots && snapshots.length >= 2) {
      orgScoreDelta = orgScore - snapshots[1].org_score;
    } else if (snapshots && snapshots.length === 1) {
      orgScoreDelta = orgScore - snapshots[0].org_score;
    }

    // ── 4. Upsert today's readiness snapshot ──
    const today = new Date().toISOString().split('T')[0];
    const orgBaldrigeReady = processes.filter(
      (p) => (healthScores.get(p.id)?.total ?? 0) >= 80
    ).length;
    const orgNeedsAttention = processes.filter((p) => {
      const health = healthScores.get(p.id);
      const lastActivity = lastActivityMap.get(p.id);
      const daysSince = lastActivity
        ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return (health && health.total < 40) || daysSince > 60;
    }).length;

    await serviceClient.from('readiness_snapshots').upsert(
      {
        snapshot_date: today,
        org_score: orgScore,
        ready_count: orgBaldrigeReady,
        attention_count: orgNeedsAttention,
        total_processes: processes.length,
      },
      { onConflict: 'snapshot_date' }
    );

    // ── 5. Build overdue metrics lookup (shared across all recipients) ──
    const { data: allMetrics } = await serviceClient.from('metrics').select('id, name, cadence');
    const { data: allEntries } = await serviceClient
      .from('entries')
      .select('metric_id, date')
      .order('date', { ascending: false });
    const { data: metricLinks } = await serviceClient
      .from('metric_processes')
      .select('metric_id, process_id');

    const latestEntryByMetric = new Map<number, string>();
    for (const e of allEntries || []) {
      if (!latestEntryByMetric.has(e.metric_id)) {
        latestEntryByMetric.set(e.metric_id, e.date);
      }
    }

    // metric → linked process IDs
    const metricToProcessIds = new Map<number, number[]>();
    const processById = new Map(processes.map((p) => [p.id, p]));
    for (const link of metricLinks || []) {
      const existing = metricToProcessIds.get(link.metric_id) || [];
      existing.push(link.process_id);
      metricToProcessIds.set(link.metric_id, existing);
    }

    // Build full overdue metric list with process linkage
    interface OverdueMetricFull extends DigestOverdueMetric {
      linkedProcessIds: number[];
    }
    const allOverdueMetrics: OverdueMetricFull[] = [];
    for (const m of allMetrics || []) {
      const lastDate = latestEntryByMetric.get(m.id);
      const status = getReviewStatus(m.cadence, lastDate || null);
      if (status === 'overdue') {
        const cadenceDays = CADENCE_DAYS[m.cadence] || 365;
        const daysSince = lastDate
          ? Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        const linkedIds = metricToProcessIds.get(m.id) || [];
        const firstProc = linkedIds.length > 0 ? processById.get(linkedIds[0]) : null;
        allOverdueMetrics.push({
          id: m.id,
          name: m.name,
          daysOverdue: Math.max(0, daysSince - cadenceDays),
          processName: firstProc?.name || null,
          linkedProcessIds: linkedIds,
        });
      }
    }
    allOverdueMetrics.sort((a, b) => b.daysOverdue - a.daysOverdue);

    // ── 6. Team activity (shared) ──
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString();

    const { data: recentImprovements } = await serviceClient
      .from('process_improvements')
      .select('process_id')
      .gte('committed_date', oneWeekAgoStr);

    const ownerUpdateCounts = new Map<string, number>();
    for (const imp of recentImprovements || []) {
      const proc = processes.find((p) => p.id === imp.process_id);
      const owner = proc?.owner || 'Unknown';
      ownerUpdateCounts.set(owner, (ownerUpdateCounts.get(owner) || 0) + 1);
    }
    for (const proc of processes) {
      if (proc.updated_at >= oneWeekAgoStr) {
        const owner = proc.owner || 'Unknown';
        ownerUpdateCounts.set(owner, (ownerUpdateCounts.get(owner) || 0) + 1);
      }
    }
    const weeklyUpdates = Array.from(ownerUpdateCounts.entries())
      .map(([owner, processCount]) => ({ owner, processCount }))
      .sort((a, b) => b.processCount - a.processCount);

    // ── 7. Determine recipients ──
    const testRecipient = process.env.DIGEST_RECIPIENT_EMAIL;

    // Fetch all registered users
    const { data: users } = await serviceClient.from('user_roles').select('email, full_name');

    interface Recipient {
      email: string;
      fullName: string | null;
      ownerProcessIds: Set<number>;
    }

    let recipients: Recipient[];

    if (testRecipient) {
      // Override mode: send only to the test email
      // Try to match their name for personalization
      const matchedUser = (users || []).find(
        (u) => u.email?.toLowerCase() === testRecipient.toLowerCase()
      );
      const ownerProcs = new Set<number>();
      if (matchedUser?.full_name) {
        for (const p of processes) {
          if (p.owner?.toLowerCase() === matchedUser.full_name.toLowerCase()) {
            ownerProcs.add(p.id);
          }
        }
      }
      recipients = [
        {
          email: testRecipient,
          fullName: matchedUser?.full_name || null,
          ownerProcessIds: ownerProcs,
        },
      ];
    } else {
      // Production mode: send to all users who own at least one process
      const ownerEmailMap = new Map<string, { email: string; fullName: string }>();
      for (const u of users || []) {
        if (u.email && u.full_name) {
          ownerEmailMap.set(u.full_name.toLowerCase(), {
            email: u.email,
            fullName: u.full_name,
          });
        }
      }

      const recipientMap = new Map<string, Recipient>();
      for (const proc of processes) {
        if (!proc.owner) continue;
        const key = proc.owner.toLowerCase();
        const user = ownerEmailMap.get(key);
        if (!user) continue; // owner name doesn't match any registered user

        const existing = recipientMap.get(key);
        if (existing) {
          existing.ownerProcessIds.add(proc.id);
        } else {
          recipientMap.set(key, {
            email: user.email,
            fullName: user.fullName,
            ownerProcessIds: new Set([proc.id]),
          });
        }
      }
      recipients = Array.from(recipientMap.values());
    }

    if (recipients.length === 0) {
      return NextResponse.json({ success: true, message: 'No recipients found', emailsSent: 0 });
    }

    // ── 8. Build and send personalized emails ──
    const resend = new Resend(resendKey);
    let emailsSent = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      const hasFilter = recipient.ownerProcessIds.size > 0;
      const myProcessIds = recipient.ownerProcessIds;

      // Filter processes for this owner
      const myProcesses = hasFilter ? processes.filter((p) => myProcessIds.has(p.id)) : processes;

      // Personalized stats
      const myBaldrigeReady = myProcesses.filter(
        (p) => (healthScores.get(p.id)?.total ?? 0) >= 80
      ).length;
      const myNeedsAttention = myProcesses.filter((p) => {
        const health = healthScores.get(p.id);
        const lastActivity = lastActivityMap.get(p.id);
        const daysSince = lastActivity
          ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        return (health && health.total < 40) || daysSince > 60;
      }).length;

      // Filter overdue metrics to those linked to this owner's processes
      const myOverdueMetrics: DigestOverdueMetric[] = hasFilter
        ? allOverdueMetrics.filter((m) => m.linkedProcessIds.some((pid) => myProcessIds.has(pid)))
        : allOverdueMetrics;

      // Filter stale processes
      const myStaleProcesses: DigestStaleProcess[] = [];
      for (const proc of myProcesses) {
        const lastActivity = lastActivityMap.get(proc.id);
        const daysSince = lastActivity
          ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        if (daysSince > 60) {
          myStaleProcesses.push({
            id: proc.id,
            name: proc.name,
            owner: proc.owner,
            daysSinceActivity: daysSince,
            healthScore: healthScores.get(proc.id)?.total ?? 0,
          });
        }
      }
      myStaleProcesses.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

      // Aggregate next actions for this owner's processes
      const myNextActions = aggregateNextActions(myProcesses, healthScores);

      const html = buildDigestHtml({
        recipientName: recipient.fullName,
        orgScore,
        orgScoreDelta,
        baldrigeReadyCount: myBaldrigeReady,
        needsAttentionCount: myNeedsAttention,
        totalProcesses: processes.length,
        myProcessCount: myProcesses.length,
        overdueMetrics: myOverdueMetrics,
        staleProcesses: myStaleProcesses,
        nextActions: myNextActions,
        weeklyUpdates,
      });

      const subjectDelta =
        orgScoreDelta !== null
          ? orgScoreDelta >= 0
            ? ` (+${orgScoreDelta})`
            : ` (${orgScoreDelta})`
          : '';

      const { error: emailError } = await resend.emails.send({
        from: 'NIA Excellence Hub <hub@thenia.org>',
        to: recipient.email,
        subject: `NIA Weekly Digest — Readiness ${orgScore}/100${subjectDelta}`,
        html,
      });

      if (emailError) {
        console.error(`Resend error for ${recipient.email}:`, emailError);
        errors.push(`${recipient.email}: ${emailError.message}`);
      } else {
        emailsSent++;
      }
    }

    return NextResponse.json({
      success: true,
      orgScore,
      orgScoreDelta,
      emailsSent,
      totalRecipients: recipients.length,
      errors: errors.length > 0 ? errors : undefined,
      snapshotDate: today,
    });
  } catch (err) {
    console.error('Weekly digest error:', err);
    return NextResponse.json({ error: 'Internal error', detail: String(err) }, { status: 500 });
  }
}

// Aggregate top next actions from a set of processes
function aggregateNextActions(
  procs: ProcessWithCategory[],
  healthScores: Map<number, HealthResult>
): DigestNextAction[] {
  const actionMap = new Map<string, DigestNextAction>();
  for (const proc of procs) {
    const health = healthScores.get(proc.id);
    if (!health) continue;
    for (const action of health.nextActions) {
      const key = action.label
        .replace(/for this process/gi, '')
        .replace(/\(\d+ days ago\)/g, '')
        .trim();
      const existing = actionMap.get(key);
      if (existing) {
        existing.points += action.points;
        existing.processCount++;
      } else {
        actionMap.set(key, {
          label: action.label,
          href: action.href || '/',
          points: action.points,
          processCount: 1,
        });
      }
    }
  }
  return Array.from(actionMap.values())
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);
}
