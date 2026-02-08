"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EmptyState from "@/components/empty-state";
import AdliRadar from "@/components/adli-radar";
import { ListPageSkeleton } from "@/components/skeleton";
import { getMaturityLevel } from "@/lib/colors";
import { DimBar, MiniBar } from "@/components/adli-bars";

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

export default function AiInsightsPage() {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"category" | "score">("category");

  useEffect(() => {
    document.title = "ADLI Insights | NIA Excellence Hub";

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
        <h1 className="text-3xl font-bold text-nia-dark">ADLI Insights</h1>
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
          {/* Organization summary — radar + stats */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr]">
              {/* Radar chart — generous space */}
              <div className="flex items-center justify-center p-8 bg-gray-50/50 border-b md:border-b-0 md:border-r border-gray-100">
                {dimAvgs && (
                  <AdliRadar
                    approach={dimAvgs.approach}
                    deployment={dimAvgs.deployment}
                    learning={dimAvgs.learning}
                    integration={dimAvgs.integration}
                    size={300}
                  />
                )}
              </div>

              {/* Stats panel */}
              <div className="p-6 flex flex-col justify-center space-y-5">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    Overall Maturity
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-5xl font-bold"
                      style={{ color: orgLevel.color }}
                    >
                      {orgAvg}%
                    </span>
                    <span
                      className="text-base font-medium"
                      style={{ color: orgLevel.color }}
                    >
                      {orgLevel.label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {scores.length} process
                    {scores.length !== 1 ? "es" : ""} assessed
                  </div>
                </div>

                {dimAvgs && (
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <DimBar label="Approach" score={dimAvgs.approach} />
                    <DimBar label="Deployment" score={dimAvgs.deployment} />
                    <DimBar label="Learning" score={dimAvgs.learning} />
                    <DimBar label="Integration" score={dimAvgs.integration} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sort toggle */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-nia-dark">Process Scores</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Sort:</span>
              <button
                onClick={() => setSortBy("category")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  sortBy === "category" ? "bg-nia-dark text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                By Category
              </button>
              <button
                onClick={() => setSortBy("score")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  sortBy === "score" ? "bg-nia-dark text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                By Score
              </button>
            </div>
          </div>

          {/* Process scores list */}
          {sortBy === "score" ? (
            /* Flat list sorted by score (highest first) */
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-100">
                {[...scores]
                  .sort((a, b) => b.overall_score - a.overall_score)
                  .map((s, rank) => {
                    const level = getMaturityLevel(s.overall_score);
                    return (
                      <Link
                        key={s.process_id}
                        href={`/processes/${s.process_id}`}
                        className="block px-5 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-gray-400 font-mono w-5">
                              {rank + 1}.
                            </span>
                            <span className="text-sm font-medium text-nia-dark truncate">
                              {s.processes.name}
                            </span>
                            {s.processes.is_key && (
                              <span className="text-[10px] bg-nia-orange/10 text-nia-orange px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                KEY
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {s.processes.categories.display_name}
                            </span>
                          </div>
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                            style={{ backgroundColor: level.bgColor }}
                          >
                            {s.overall_score}%
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 pl-7">
                          <MiniBar label="A" score={s.approach_score} />
                          <MiniBar label="D" score={s.deployment_score} />
                          <MiniBar label="L" score={s.learning_score} />
                          <MiniBar label="I" score={s.integration_score} />
                        </div>

                        <div className="text-[10px] text-gray-400 mt-1.5 pl-7">
                          Assessed {new Date(s.assessed_at).toLocaleDateString()}
                          {s.processes.owner && ` · Owner: ${s.processes.owner}`}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* Category groups */
            <div className="space-y-6">
              {categoryGroups.map((group) => {
                const groupLevel = getMaturityLevel(group.avgOverall);
                return (
                  <div key={group.name} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Category header */}
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="font-semibold text-nia-dark text-sm">{group.name}</h3>
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
                                <span className="text-sm font-medium text-nia-dark truncate">
                                  {s.processes.name}
                                </span>
                                {s.processes.is_key && (
                                  <span className="text-[10px] bg-nia-orange/10 text-nia-orange px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                    KEY
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                                style={{ backgroundColor: level.bgColor }}
                              >
                                {s.overall_score}%
                              </span>
                            </div>

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
          )}
        </>
      )}
    </div>
  );
}

