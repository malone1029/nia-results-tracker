"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EmptyState from "@/components/empty-state";
import { ListPageSkeleton } from "@/components/skeleton";

interface ScoreRow {
  id: number;
  process_id: number;
  approach_score: number;
  deployment_score: number;
  learning_score: number;
  integration_score: number;
  overall_score: number;
  assessed_at: string;
  processes: {
    id: number;
    name: string;
    status: string;
    is_key: boolean;
    owner: string | null;
    categories: {
      id: number;
      display_name: string;
      sort_order: number;
    };
  };
}

interface CategoryGroup {
  name: string;
  sortOrder: number;
  processes: ScoreRow[];
  avgOverall: number;
}

function getMaturityLevel(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 70) return { label: "Integrated", color: "#324a4d", bgColor: "#324a4d" };
  if (score >= 50) return { label: "Aligned", color: "#b1bd37", bgColor: "#b1bd37" };
  if (score >= 30) return { label: "Early Systematic", color: "#f79935", bgColor: "#f79935" };
  return { label: "Reacting", color: "#dc2626", bgColor: "#dc2626" };
}

export default function AiInsightsPage() {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"category" | "score">("category");

  useEffect(() => {
    document.title = "AI Insights | NIA Excellence Hub";

    async function fetchScores() {
      const res = await fetch("/api/ai/scores");
      if (res.ok) {
        const data = await res.json();
        setScores(data);
      }
      setLoading(false);
    }
    fetchScores();
  }, []);

  // Group by category
  const categoryGroups: CategoryGroup[] = [];
  const groupMap = new Map<string, ScoreRow[]>();

  for (const s of scores) {
    const catName = s.processes.categories.display_name;
    if (!groupMap.has(catName)) groupMap.set(catName, []);
    groupMap.get(catName)!.push(s);
  }

  for (const [name, processes] of groupMap.entries()) {
    const avgOverall = Math.round(
      processes.reduce((sum, p) => sum + p.overall_score, 0) / processes.length
    );
    categoryGroups.push({
      name,
      sortOrder: processes[0].processes.categories.sort_order,
      processes: processes.sort((a, b) => a.overall_score - b.overall_score),
      avgOverall,
    });
  }

  if (sortBy === "category") {
    categoryGroups.sort((a, b) => a.sortOrder - b.sortOrder);
  } else {
    categoryGroups.sort((a, b) => a.avgOverall - b.avgOverall);
  }

  // Overall org average
  const orgAvg = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length)
    : 0;
  const orgLevel = getMaturityLevel(orgAvg);

  // Dimension averages
  const dimAvgs = scores.length > 0
    ? {
        approach: Math.round(scores.reduce((s, r) => s + r.approach_score, 0) / scores.length),
        deployment: Math.round(scores.reduce((s, r) => s + r.deployment_score, 0) / scores.length),
        learning: Math.round(scores.reduce((s, r) => s + r.learning_score, 0) / scores.length),
        integration: Math.round(scores.reduce((s, r) => s + r.integration_score, 0) / scores.length),
      }
    : null;

  if (loading) return <ListPageSkeleton showStats statCount={5} />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#324a4d]">AI Insights</h1>
        <p className="text-gray-500 mt-1">
          ADLI maturity scores across all assessed processes.
        </p>
      </div>

      {scores.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <EmptyState
            illustration="radar"
            title="No assessments yet"
            description="Open any process and use the AI chat panel to run an ADLI analysis. Scores will appear here automatically."
            action={{ label: "Go to Processes", href: "/processes" }}
          />
        </div>
      ) : (
        <>
          {/* Organization summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Overall */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:col-span-2 lg:col-span-1">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Overall</div>
              <div className="text-3xl font-bold" style={{ color: orgLevel.color }}>{orgAvg}%</div>
              <div className="text-sm mt-1" style={{ color: orgLevel.color }}>{orgLevel.label}</div>
              <div className="text-xs text-gray-400 mt-2">{scores.length} process{scores.length !== 1 ? "es" : ""} assessed</div>
            </div>

            {/* Dimension averages */}
            {dimAvgs && (
              <>
                <DimCard label="Approach" score={dimAvgs.approach} />
                <DimCard label="Deployment" score={dimAvgs.deployment} />
                <DimCard label="Learning" score={dimAvgs.learning} />
                <DimCard label="Integration" score={dimAvgs.integration} />
              </>
            )}
          </div>

          {/* Sort toggle */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#324a4d]">Process Scores</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Sort:</span>
              <button
                onClick={() => setSortBy("category")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  sortBy === "category" ? "bg-[#324a4d] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                By Category
              </button>
              <button
                onClick={() => setSortBy("score")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  sortBy === "score" ? "bg-[#324a4d] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                By Score
              </button>
            </div>
          </div>

          {/* Category groups */}
          <div className="space-y-6">
            {categoryGroups.map((group) => {
              const groupLevel = getMaturityLevel(group.avgOverall);
              return (
                <div key={group.name} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Category header */}
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-[#324a4d] text-sm">{group.name}</h3>
                    <span
                      className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: groupLevel.bgColor }}
                    >
                      Avg: {group.avgOverall}%
                    </span>
                  </div>

                  {/* Process rows */}
                  <div className="divide-y divide-gray-100">
                    {group.processes.map((s) => {
                      const level = getMaturityLevel(s.overall_score);
                      return (
                        <Link
                          key={s.process_id}
                          href={`/processes/${s.process_id}`}
                          className="block px-5 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-[#324a4d] truncate">
                                {s.processes.name}
                              </span>
                              {s.processes.is_key && (
                                <span className="text-[10px] bg-[#f79935]/10 text-[#f79935] px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                  KEY
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: level.bgColor }}
                              >
                                {s.overall_score}%
                              </span>
                            </div>
                          </div>

                          {/* Mini bar chart */}
                          <div className="grid grid-cols-4 gap-2">
                            <MiniBar label="A" score={s.approach_score} />
                            <MiniBar label="D" score={s.deployment_score} />
                            <MiniBar label="L" score={s.learning_score} />
                            <MiniBar label="I" score={s.integration_score} />
                          </div>

                          <div className="text-[10px] text-gray-400 mt-1.5">
                            Assessed {new Date(s.assessed_at).toLocaleDateString()}
                            {s.processes.owner && ` · Owner: ${s.processes.owner}`}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DimCard({ label, score }: { label: string; score: number }) {
  const level = getMaturityLevel(score);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: level.color }}>{score}%</div>
      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: level.bgColor }}
        />
      </div>
    </div>
  );
}

function MiniBar({ label, score }: { label: string; score: number }) {
  const level = getMaturityLevel(score);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-400 w-3">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: level.bgColor }}
        />
      </div>
      <span className="text-[10px] text-gray-500 w-6 text-right">{score}%</span>
    </div>
  );
}
