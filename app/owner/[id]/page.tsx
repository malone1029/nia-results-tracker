// app/owner/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/use-role";
import { Card } from "@/components/ui";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────

interface ScorecardData {
  owner: {
    auth_id: string;
    email: string;
    full_name: string | null;
    role: string;
    last_login_at: string | null;
    onboarding_completed_at: string | null;
  };
  processes: {
    id: number;
    name: string;
    status: string;
    updated_at: string;
    process_type: string;
    adliScore: number | null;
  }[];
  compliance: {
    isCompliant: boolean;
    checks: {
      onboardingComplete: boolean;
      metricsAllCurrent: boolean;
      processRecentlyUpdated: boolean;
      taskCompletedThisQuarter: boolean;
      processStatusAcceptable: boolean;
    };
  };
  growth: {
    improvementCount: number;
    taskCompletionRate: number | null;
    totalTasks: number;
    completedTasks: number;
  };
}
// ── Sub-components ────────────────────────────────────────────

function CheckRow({ label, passing, detail }: { label: string; passing: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
        passing ? "bg-nia-green/20 text-nia-green" : "bg-red-100 text-red-600"
      }`}>
        {passing ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-text-muted">{detail}</p>
      </div>
    </div>
  );
}

function StatPill({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-surface-subtle rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-text-muted">{sub}</div>}
      <div className="text-xs text-text-secondary mt-1">{label}</div>
    </div>
  );
}
// ── Page ──────────────────────────────────────────────────────

export default function OwnerScorecardPage() {
  const params = useParams();
  const targetId = params.id as string;
  const { role, loading: roleLoading } = useRole();
  const [data, setData] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (roleLoading) return;
    fetch(`/api/owner/${targetId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [targetId, roleLoading]);

  if (loading || roleLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-surface-subtle rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 bg-surface-subtle rounded-xl animate-pulse" />
          <div className="h-64 bg-surface-subtle rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data || (data as { error?: string }).error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="p-8 text-center text-text-muted">
          Scorecard not available. You may not have permission to view this page.
        </Card>
      </div>
    );
  }
  const isSelf = currentUserId === targetId;
  const isAdmin = role === "admin" || role === "super_admin";
  const displayName = data.owner.full_name ?? data.owner.email;
  const pageTitle = isSelf ? "My Scorecard" : `${displayName}'s Scorecard`;

  const checks = data.compliance.checks;
  const checkItems = [
    {
      label: "Onboarding complete",
      passing: checks.onboardingComplete,
      detail: checks.onboardingComplete
        ? "Orientation program finished"
        : "Complete the onboarding program to get started",
    },
    {
      label: "Metrics current",
      passing: checks.metricsAllCurrent,
      detail: checks.metricsAllCurrent
        ? "All linked metrics logged within their cadence window"
        : "One or more metrics are overdue — visit Data Health to review",
    },
    {
      label: "Process recently updated",
      passing: checks.processRecentlyUpdated,
      detail: checks.processRecentlyUpdated
        ? "Documentation updated within the last 90 days"
        : "No process documentation has been updated in 90+ days",
    },
    {
      label: "Task completed this quarter",
      passing: checks.taskCompletedThisQuarter,
      detail: checks.taskCompletedThisQuarter
        ? "At least one task completed in the last 90 days"
        : "No tasks completed in the last 90 days — check the Tasks tab on your processes",
    },
    {
      label: "Process status acceptable",
      passing: checks.processStatusAcceptable,
      detail: checks.processStatusAcceptable
        ? "At least one process is Ready for Review or Approved"
        : "All processes are still in Draft — advance at least one to Ready for Review",
    },
  ];
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-nia-dark">{pageTitle}</h1>
          <p className="text-text-muted mt-1">
            {data.processes.length} process{data.processes.length !== 1 ? "es" : ""} owned
            {data.owner.last_login_at && (
              <> · Last active {new Date(data.owner.last_login_at).toLocaleDateString()}</>
            )}
          </p>
        </div>

        {/* Overall compliance badge */}
        <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
          data.compliance.isCompliant
            ? "bg-nia-green/10 text-nia-green border border-nia-green/30"
            : "bg-red-50 text-red-600 border border-red-200"
        }`}>
          {data.compliance.isCompliant ? "✓ Compliant" : "⚠ Not Compliant"}
        </div>
      </div>

      {/* Onboarding prompt (if not complete and viewing self) */}
      {isSelf && !checks.onboardingComplete && (
        <div className="bg-nia-orange/10 border border-nia-orange/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Complete your onboarding</p>
            <p className="text-sm text-text-muted">Learn how to use the Hub and what&apos;s expected of you as a process owner.</p>
          </div>
          <a
            href="/onboarding"
            className="px-4 py-2 bg-nia-dark-solid text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap ml-4"
          >
            Start Onboarding →
          </a>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Compliance Panel */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Activity Compliance</h2>
          <p className="text-xs text-text-muted mb-4">All checks must pass to be considered compliant</p>
          <div>
            {checkItems.map((item) => (
              <CheckRow key={item.label} {...item} />
            ))}
          </div>
        </Card>

        {/* Growth Panel */}
        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Growth Metrics</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatPill
                label="Task Completion Rate"
                value={data.growth.taskCompletionRate !== null ? `${data.growth.taskCompletionRate}%` : "—"}
                sub={`${data.growth.completedTasks} of ${data.growth.totalTasks} tasks`}
              />
              <StatPill
                label="Improvements This Year"
                value={data.growth.improvementCount}
                sub="journal entries logged"
              />
            </div>
          </Card>

          {/* Processes */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Owned Processes</h2>
            {data.processes.length === 0 ? (
              <p className="text-sm text-text-muted">No processes assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {data.processes.map((p) => (
                  <Link
                    key={p.id}
                    href={`/processes/${p.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-subtle transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-nia-dark transition-colors">
                        {p.name}
                      </p>
                      <p className="text-xs text-text-muted capitalize">
                        {p.status.replace(/_/g, " ")} · {p.process_type}
                      </p>
                    </div>
                    {p.adliScore !== null && (
                      <span className="text-xs font-semibold text-text-secondary bg-surface-subtle px-2 py-1 rounded">
                        ADLI {p.adliScore}/5
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Admin-only: back to scorecards */}
      {isAdmin && (
        <div>
          <Link href="/admin/scorecards" className="text-sm text-text-muted hover:text-foreground transition-colors">
            ← Back to all scorecards
          </Link>
        </div>
      )}
    </div>
  );
}