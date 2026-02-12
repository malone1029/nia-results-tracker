"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminGuard from "@/components/admin-guard";
import { Card } from "@/components/ui";

interface SurveyWave {
  id: number;
  wave_number: number;
  status: string;
  share_token: string;
  opened_at: string | null;
  closed_at: string | null;
  response_count: number;
}

interface SurveyRow {
  id: number;
  process_id: number;
  process_name: string;
  title: string;
  question_count: number;
  latest_wave: SurveyWave | null;
  created_at: string;
}

type StatusFilter = "all" | "open" | "closed" | "draft";

function getStatus(survey: SurveyRow): { label: string; color: string; key: StatusFilter } {
  if (!survey.latest_wave) return { label: "Draft", color: "bg-surface-muted text-text-muted", key: "draft" };
  if (survey.latest_wave.status === "open") return { label: "Open", color: "bg-nia-green/15 text-nia-green", key: "open" };
  if (survey.latest_wave.status === "scheduled") return { label: "Scheduled", color: "bg-nia-orange/15 text-nia-orange", key: "open" };
  return { label: "Closed", color: "bg-surface-muted text-text-muted", key: "closed" };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/surveys")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setSurveys(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = surveys.filter((s) => {
    if (filter !== "all" && getStatus(s).key !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.process_name?.toLowerCase().includes(q);
    }
    return true;
  });

  // Stats
  const openCount = surveys.filter((s) => s.latest_wave?.status === "open" || s.latest_wave?.status === "scheduled").length;
  const totalResponses = surveys.reduce((sum, s) => sum + (s.latest_wave?.response_count || 0), 0);
  const draftCount = surveys.filter((s) => !s.latest_wave).length;

  return (
    <AdminGuard>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-nia-dark">Surveys</h1>
            <p className="text-sm text-text-secondary mt-0.5">All surveys across processes</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card>
            <div className="px-4 py-3 text-center">
              <div className="text-2xl font-bold text-nia-dark">{surveys.length}</div>
              <div className="text-xs text-text-muted">Total Surveys</div>
            </div>
          </Card>
          <Card>
            <div className="px-4 py-3 text-center">
              <div className="text-2xl font-bold text-nia-green">{openCount}</div>
              <div className="text-xs text-text-muted">Active Now</div>
            </div>
          </Card>
          <Card>
            <div className="px-4 py-3 text-center">
              <div className="text-2xl font-bold text-nia-dark">{totalResponses}</div>
              <div className="text-xs text-text-muted">Latest Responses</div>
            </div>
          </Card>
          <Card>
            <div className="px-4 py-3 text-center">
              <div className="text-2xl font-bold text-nia-orange">{draftCount}</div>
              <div className="text-xs text-text-muted">Drafts</div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex gap-1">
            {(["all", "open", "closed", "draft"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors capitalize ${
                  filter === f
                    ? "bg-nia-dark-solid text-white"
                    : "bg-surface-hover text-text-secondary hover:text-nia-dark"
                }`}
              >
                {f === "all" ? "All" : f}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search surveys or processes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-nia-dark-solid"
          />
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="px-4 py-8 space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-surface-muted rounded" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-text-muted">
                {surveys.length === 0 ? "No surveys created yet." : "No surveys match your filter."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-nia-dark-solid text-white text-left">
                      <th className="px-4 py-2.5 font-medium">Survey</th>
                      <th className="px-4 py-2.5 font-medium">Process</th>
                      <th className="px-4 py-2.5 font-medium text-center">Status</th>
                      <th className="px-4 py-2.5 font-medium text-center">Questions</th>
                      <th className="px-4 py-2.5 font-medium text-center">Responses</th>
                      <th className="px-4 py-2.5 font-medium text-center">Round</th>
                      <th className="px-4 py-2.5 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const status = getStatus(s);
                      return (
                        <tr key={s.id} className="border-b border-border-light hover:bg-surface-hover transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/processes/${s.process_id}?tab=overview#section-surveys`} className="font-medium text-nia-dark hover:underline">
                              {s.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/processes/${s.process_id}`} className="text-text-secondary hover:text-nia-dark hover:underline">
                              {s.process_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-text-secondary">{s.question_count}</td>
                          <td className="px-4 py-3 text-center">
                            {s.latest_wave ? (
                              <span className={s.latest_wave.response_count > 0 ? "font-medium text-nia-dark" : "text-text-muted"}>
                                {s.latest_wave.response_count}
                              </span>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-text-secondary">
                            {s.latest_wave ? s.latest_wave.wave_number : "—"}
                          </td>
                          <td className="px-4 py-3 text-text-muted text-xs">{formatDate(s.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-border-light">
                {filtered.map((s) => {
                  const status = getStatus(s);
                  return (
                    <Link key={s.id} href={`/processes/${s.process_id}?tab=overview#section-surveys`} className="block px-4 py-3 hover:bg-surface-hover transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-nia-dark truncate">{s.title}</p>
                          <p className="text-xs text-text-muted truncate">{s.process_name}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="flex gap-4 mt-1.5 text-xs text-text-muted">
                        <span>{s.question_count} questions</span>
                        {s.latest_wave && <span>{s.latest_wave.response_count} responses</span>}
                        {s.latest_wave && <span>Round {s.latest_wave.wave_number}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>
    </AdminGuard>
  );
}
