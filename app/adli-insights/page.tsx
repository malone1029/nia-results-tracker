'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import EmptyState from '@/components/empty-state';
import AdliRadar from '@/components/adli-radar';
import { ListPageSkeleton } from '@/components/skeleton';
import { getMaturityLevel } from '@/lib/colors';
import { DimBar, MiniBar } from '@/components/adli-bars';
import { Card, CardHeader, Badge, Button } from '@/components/ui';
import AdliScoringInfo from '@/components/adli-scoring-info';
import HelpTip from '@/components/help-tip';
import SectionIntro from '@/components/section-intro';
import ContextualTip from '@/components/contextual-tip';
import { supabase } from '@/lib/supabase';

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
    process_type: string;
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
  const [totalProcessCount, setTotalProcessCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'category' | 'score'>('category');
  const [typeFilter, setTypeFilter] = useState<'all' | 'key' | 'support'>('all');

  useEffect(() => {
    document.title = 'ADLI Insights | NIA Excellence Hub';

    async function fetchScores() {
      const [res, countRes] = await Promise.all([
        fetch('/api/ai/scores'),
        supabase.from('processes').select('id', { count: 'exact', head: true }),
      ]);
      if (res.ok) {
        const data = await res.json();
        setScores(data);
      }
      setTotalProcessCount(countRes.count ?? 0);
      setLoading(false);
    }
    fetchScores();
  }, []);

  // Filter by process type
  const filteredScores =
    typeFilter === 'all' ? scores : scores.filter((s) => s.processes.process_type === typeFilter);

  // Group by category
  const categoryGroups: CategoryGroup[] = [];
  const groupMap = new Map<string, ScoreRow[]>();

  for (const s of filteredScores) {
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

  if (sortBy === 'category') {
    categoryGroups.sort((a, b) => a.sortOrder - b.sortOrder);
  } else {
    categoryGroups.sort((a, b) => a.avgOverall - b.avgOverall);
  }

  // Overall org average
  const orgAvg =
    filteredScores.length > 0
      ? Math.round(
          filteredScores.reduce((sum, s) => sum + s.overall_score, 0) / filteredScores.length
        )
      : 0;
  const orgLevel = getMaturityLevel(orgAvg);

  // Dimension averages
  const dimAvgs =
    filteredScores.length > 0
      ? {
          approach: Math.round(
            filteredScores.reduce((s, r) => s + r.approach_score, 0) / filteredScores.length
          ),
          deployment: Math.round(
            filteredScores.reduce((s, r) => s + r.deployment_score, 0) / filteredScores.length
          ),
          learning: Math.round(
            filteredScores.reduce((s, r) => s + r.learning_score, 0) / filteredScores.length
          ),
          integration: Math.round(
            filteredScores.reduce((s, r) => s + r.integration_score, 0) / filteredScores.length
          ),
        }
      : null;

  if (loading) return <ListPageSkeleton showStats statCount={5} />;

  return (
    <div className="space-y-8 content-appear">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-nia-dark">
          ADLI Insights
          <HelpTip text="Approach, Deployment, Learning, Integration — the Baldrige process maturity dimensions. Scores come from AI assessments." />
        </h1>
        <p className="text-text-tertiary mt-1">
          ADLI maturity scores across all assessed processes.
        </p>
      </div>

      <SectionIntro storageKey="intro-adli">
        ADLI = Approach, Deployment, Learning, Integration — the four dimensions Baldrige uses to
        evaluate process maturity. Run an AI assessment on any process to generate scores.
      </SectionIntro>

      {(() => {
        const assessedIds = new Set(scores.map((s) => s.process_id));
        const unassessed = totalProcessCount - assessedIds.size;
        return unassessed > 0 ? (
          <ContextualTip tipId="adli-unassessed" show={scores.length > 0}>
            {unassessed} process{unassessed !== 1 ? 'es' : ''} ha
            {unassessed !== 1 ? "ven't" : "sn't"} been assessed yet. Open them and use the AI Coach
            to run an ADLI analysis.
          </ContextualTip>
        ) : null;
      })()}

      {filteredScores.length === 0 && scores.length === 0 ? (
        <Card>
          <EmptyState
            illustration="radar"
            title="No assessments yet"
            description="Open any process and use the AI chat panel to run an ADLI analysis. Scores will appear here automatically."
            action={{ label: 'Go to Processes', href: '/processes' }}
          />
        </Card>
      ) : (
        <>
          {/* Organization summary — radar + stats */}
          <Card variant="elevated" className="overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr]">
              {/* Radar chart — generous space */}
              <div className="flex items-center justify-center p-8 bg-surface-hover border-b md:border-b-0 md:border-r border-border-light">
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
                  <div className="text-xs text-text-tertiary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    Overall Maturity
                    <AdliScoringInfo />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-5xl font-bold font-display number-pop"
                      style={{ color: orgLevel.color }}
                    >
                      {orgAvg}%
                    </span>
                    <span className="text-base font-medium" style={{ color: orgLevel.color }}>
                      {orgLevel.label}
                    </span>
                  </div>
                  <div className="text-sm text-text-muted mt-1">
                    {filteredScores.length} process
                    {filteredScores.length !== 1 ? 'es' : ''} assessed
                    {typeFilter !== 'all' && ` (${typeFilter} only)`}
                  </div>
                </div>

                {dimAvgs && (
                  <div className="space-y-3 pt-3 border-t border-border-light">
                    <DimBar label="Approach" score={dimAvgs.approach} />
                    <DimBar label="Deployment" score={dimAvgs.deployment} />
                    <DimBar label="Learning" score={dimAvgs.learning} />
                    <DimBar label="Integration" score={dimAvgs.integration} />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Sort toggle + Key Only filter */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-nia-dark">Process Scores</h2>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1 bg-surface-subtle rounded-lg p-1">
                {(['all', 'key', 'support'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      typeFilter === t
                        ? 'bg-card text-nia-dark shadow-sm'
                        : 'text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    {t === 'all' ? 'All' : t === 'key' ? '\u2605 Key' : 'Support'}
                  </button>
                ))}
              </div>
              <span className="text-text-muted">|</span>
              <span className="text-text-tertiary">Sort:</span>
              <Button
                variant={sortBy === 'category' ? 'primary' : 'ghost'}
                size="xs"
                onClick={() => setSortBy('category')}
              >
                By Category
              </Button>
              <Button
                variant={sortBy === 'score' ? 'primary' : 'ghost'}
                size="xs"
                onClick={() => setSortBy('score')}
              >
                By Score
              </Button>
            </div>
          </div>

          {/* Process scores list */}
          {sortBy === 'score' ? (
            /* Flat list sorted by score (highest first) */
            <Card className="overflow-hidden">
              <div className="divide-y divide-border-light">
                {[...filteredScores]
                  .sort((a, b) => b.overall_score - a.overall_score)
                  .map((s, rank) => {
                    const level = getMaturityLevel(s.overall_score);
                    return (
                      <Link
                        key={s.process_id}
                        href={`/processes/${s.process_id}`}
                        className="block px-5 py-3 hover:bg-surface-hover transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-text-muted font-mono w-5">
                              {rank + 1}.
                            </span>
                            <span className="text-sm font-medium text-nia-dark truncate">
                              {s.processes.name}
                            </span>
                            {s.processes.process_type === 'key' && (
                              <Badge color="orange" size="xs" pill={false}>
                                KEY
                              </Badge>
                            )}
                            <span className="text-[10px] text-text-muted flex-shrink-0">
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

                        <div className="text-[10px] text-text-muted mt-1.5 pl-7">
                          Assessed {new Date(s.assessed_at).toLocaleDateString()}
                          {s.processes.owner && ` · Owner: ${s.processes.owner}`}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </Card>
          ) : (
            /* Category groups */
            <div className="space-y-6">
              {categoryGroups.map((group) => {
                const groupLevel = getMaturityLevel(group.avgOverall);
                return (
                  <Card key={group.name} className="overflow-hidden">
                    {/* Category header */}
                    <CardHeader className="bg-surface-hover flex items-center justify-between">
                      <h3 className="font-semibold text-nia-dark text-sm">{group.name}</h3>
                      <span
                        className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: groupLevel.bgColor }}
                      >
                        Avg: {group.avgOverall}%
                      </span>
                    </CardHeader>

                    {/* Process rows */}
                    <div className="divide-y divide-border-light">
                      {group.processes.map((s) => {
                        const level = getMaturityLevel(s.overall_score);
                        return (
                          <Link
                            key={s.process_id}
                            href={`/processes/${s.process_id}`}
                            className="block px-5 py-3 hover:bg-surface-hover transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-nia-dark truncate">
                                  {s.processes.name}
                                </span>
                                {s.processes.process_type === 'key' && (
                                  <Badge color="orange" size="xs" pill={false}>
                                    KEY
                                  </Badge>
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

                            <div className="text-[10px] text-text-muted mt-1.5">
                              Assessed {new Date(s.assessed_at).toLocaleDateString()}
                              {s.processes.owner && ` · Owner: ${s.processes.owner}`}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
