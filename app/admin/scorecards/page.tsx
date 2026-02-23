// app/admin/scorecards/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/lib/use-role";
import { Card } from "@/components/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Scorecard {
  auth_id: string | null;
  email: string;
  full_name: string | null;
  role: string;
  last_login_at: string | null;
  processCount: number;
  compliance: {
    isCompliant: boolean;
    checks: Record<string, boolean>;
  };
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function ScorecardsPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const router = useRouter();
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (roleLoading) return;
    if (!isAdmin) { router.push("/"); return; }

    fetch("/api/admin/scorecards")
      .then((r) => r.json())
      .then((d) => {
        setScorecards(d.scorecards ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isAdmin, roleLoading, router]);

  const compliantCount = scorecards.filter((s) => s.compliance.isCompliant).length;

  if (loading || roleLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-surface-subtle rounded animate-pulse" />
        <div className="h-64 bg-surface-subtle rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Process Owner Scorecards</h1>
        <p className="text-text-muted mt-1">
          {compliantCount} of {scorecards.length} process owner{scorecards.length !== 1 ? "s" : ""} compliant
        </p>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle">
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Name</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Processes</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Compliance</th>
              <th className="text-left px-4 py-3 font-medium text-text-secondary">Last Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {scorecards.map((s) => (
              <tr
                key={s.auth_id ?? s.email}
                className="border-b border-border last:border-0 hover:bg-surface-subtle transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{s.full_name ?? s.email}</p>
                  <p className="text-xs text-text-muted capitalize">{s.role.replace(/_/g, " ")}</p>
                </td>
                <td className="px-4 py-3 text-text-secondary">{s.processCount}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    s.compliance.isCompliant
                      ? "bg-nia-green/10 text-nia-green"
                      : "bg-red-50 text-red-600"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      s.compliance.isCompliant ? "bg-nia-green" : "bg-red-500"
                    }`} />
                    {s.compliance.isCompliant ? "Compliant" : "Not Compliant"}
                  </span>
                  {!s.compliance.isCompliant && (
                    <p className="text-xs text-text-muted mt-1">
                      {Object.values(s.compliance.checks).filter((v) => !v).length} check{Object.values(s.compliance.checks).filter((v) => !v).length !== 1 ? "s" : ""} failing
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary">{relativeTime(s.last_login_at)}</td>
                <td className="px-4 py-3 text-right">
                  {s.auth_id ? (
                    <Link
                      href={`/owner/${s.auth_id}`}
                      className="text-xs text-nia-dark hover:underline font-medium"
                    >
                      View →
                    </Link>
                  ) : (
                    <span className="text-xs text-text-muted italic">Pending login</span>
                  )}
                </td>
              </tr>
            ))}
            {scorecards.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  No process owners registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
