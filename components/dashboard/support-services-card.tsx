"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import Link from "next/link";

type ResolveMetrics = {
  thisMonth: number;
  openTickets: number;
  totalTickets: number;
  avgResolutionHours: number | null;
  avgSatisfaction: number | null;
  sentimentCount: number;
  byDepartment: { name: string; total: number; open: number }[];
};

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h}h`;
  return `${Math.round((h / 24) * 10) / 10}d`;
}

export default function SupportServicesCard() {
  const [metrics, setMetrics] = useState<ResolveMetrics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/resolve")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setMetrics)
      .catch(() => setError(true));
  }, []);

  if (error) return null;

  return (
    <Card padding="md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-nia-dark">Support Services</h3>
            <p className="text-xs text-text-tertiary">Category 5 · Workforce Focus</p>
          </div>
        </div>
        <Link
          href={process.env.NEXT_PUBLIC_RESOLVE_URL || "https://resolve-jade.vercel.app"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-text-tertiary hover:text-nia-dark transition-colors"
        >
          Open Resolve ↗
        </Link>
      </div>

      {!metrics ? (
        /* Loading skeleton */
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-surface-subtle rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Key metrics 2×2 grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-surface-subtle rounded-lg px-3 py-2.5">
              <p className="text-xs text-text-tertiary mb-0.5">This Month</p>
              <p className="text-xl font-bold text-nia-dark">{metrics.thisMonth}</p>
              <p className="text-xs text-text-tertiary">tickets</p>
            </div>
            <div className="bg-surface-subtle rounded-lg px-3 py-2.5">
              <p className="text-xs text-text-tertiary mb-0.5">Open Now</p>
              <p className={`text-xl font-bold ${metrics.openTickets > 5 ? "text-amber-500" : "text-nia-dark"}`}>
                {metrics.openTickets}
              </p>
              <p className="text-xs text-text-tertiary">active</p>
            </div>
            <div className="bg-surface-subtle rounded-lg px-3 py-2.5">
              <p className="text-xs text-text-tertiary mb-0.5">Avg Resolution</p>
              <p className="text-xl font-bold text-nia-dark">
                {metrics.avgResolutionHours != null ? formatHours(metrics.avgResolutionHours) : "—"}
              </p>
              <p className="text-xs text-text-tertiary">per ticket</p>
            </div>
            <div className="bg-surface-subtle rounded-lg px-3 py-2.5">
              <p className="text-xs text-text-tertiary mb-0.5">Satisfaction</p>
              <p className={`text-xl font-bold ${
                metrics.avgSatisfaction == null ? "text-nia-dark"
                : metrics.avgSatisfaction >= 4 ? "text-nia-green"
                : metrics.avgSatisfaction < 3 ? "text-red-500"
                : "text-amber-500"
              }`}>
                {metrics.avgSatisfaction != null ? `${metrics.avgSatisfaction}/5` : "—"}
              </p>
              <p className="text-xs text-text-tertiary">
                {metrics.sentimentCount > 0 ? `${metrics.sentimentCount} response${metrics.sentimentCount !== 1 ? "s" : ""}` : "no feedback yet"}
              </p>
            </div>
          </div>

          {/* Department breakdown */}
          {metrics.byDepartment.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border-subtle">
              {metrics.byDepartment.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary font-medium truncate">{d.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-text-tertiary">{d.total} total</span>
                    {d.open > 0 && (
                      <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                        {d.open} open
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
