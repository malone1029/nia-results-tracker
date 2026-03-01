'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Badge, Card, Select } from '@/components/ui';
import { DetailSkeleton } from '@/components/skeleton';
import { NIA_COLORS } from '@/lib/colors';
import dynamic from 'next/dynamic';

const RatingChart = dynamic(() => import('./survey-charts').then((mod) => mod.RatingChart), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-muted rounded" />,
});
const NpsChart = dynamic(() => import('./survey-charts').then((mod) => mod.NpsChart), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-muted rounded" />,
});
const MultipleChoiceChart = dynamic(
  () => import('./survey-charts').then((mod) => mod.MultipleChoiceChart),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded" /> }
);
const CheckboxChart = dynamic(() => import('./survey-charts').then((mod) => mod.CheckboxChart), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-muted rounded" />,
});
const YesNoChart = dynamic(() => import('./survey-charts').then((mod) => mod.YesNoChart), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-muted rounded" />,
});
const TrendsTab = dynamic(() => import('./survey-charts').then((mod) => mod.TrendsTab), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-muted rounded" />,
});

/* ─── Colors ──────────────────────────────────────────────────── */

// Alias canonical colors for brevity within this file
const NIA = NIA_COLORS;

/* ─── Type Definitions ─────────────────────────────────────────── */

interface Wave {
  id: number;
  wave_number: number;
  status: string;
  response_count: number;
  opened_at: string | null;
  closed_at: string | null;
  share_token?: string;
}

interface QuestionResult {
  question_id: number;
  question_text: string;
  question_type: string;
  response_count: number;
  avg_value: number;
  previous_avg: number | null;
  // rating
  distribution?: number[];
  // nps
  nps_score?: number;
  nps_segments?: { detractors: number; passives: number; promoters: number };
  // multiple_choice / checkbox
  option_counts?: number[];
  option_labels?: string[];
  other_count?: number;
  other_texts?: string[];
  total_respondents?: number;
  // open_text
  text_responses?: string[];
  // matrix
  matrix_rows?: {
    row_label: string;
    avg_value: number;
    response_count: number;
    distribution: number[];
  }[];
  column_labels?: string[];
}

interface AISummary {
  key_findings: string[];
  strengths: string[];
  areas_for_improvement: string[];
  notable_comments: string[];
  recommended_actions: string[];
}

/* ─── Helpers ──────────────────────────────────────────────────── */

function TrendArrow({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || previous === undefined) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return <span className="text-text-muted text-xs ml-1">--</span>;
  const isUp = diff > 0;
  return (
    <span className={`text-xs font-medium ml-1.5 ${isUp ? 'text-nia-green' : 'text-nia-red'}`}>
      {isUp ? '\u25B2' : '\u25BC'} {Math.abs(diff).toFixed(1)}
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-nia-dark uppercase tracking-wide mb-3">{children}</h3>
  );
}

/* ─── Matrix Visualization Component ──────────────────────────── */

function MatrixTable({ q }: { q: QuestionResult }) {
  const rows = q.matrix_rows || [];
  const cols = q.column_labels || [];
  const maxCount = Math.max(1, ...rows.flatMap((r) => r.distribution));

  return (
    <Card padding="md" className="space-y-3">
      <h4 className="text-sm font-medium text-foreground leading-snug">{q.question_text}</h4>
      <div className="text-xs text-text-muted">{q.response_count} responses</div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 text-xs font-medium text-text-muted" />
              {cols.map((col, i) => (
                <th
                  key={i}
                  className="px-2 py-2 text-center text-xs font-medium text-text-muted whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
              <th className="px-2 py-2 text-center text-xs font-semibold text-nia-dark whitespace-nowrap">
                Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-border-light">
                <td className="py-2 pr-3 text-xs text-foreground font-medium whitespace-nowrap">
                  {row.row_label}
                </td>
                {row.distribution.map((count, ci) => {
                  const intensity = maxCount > 0 ? count / maxCount : 0;
                  return (
                    <td
                      key={ci}
                      className="px-2 py-2 text-center text-xs"
                      style={{
                        backgroundColor: `rgba(177, 189, 55, ${intensity * 0.5})`,
                      }}
                    >
                      {count}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center text-xs font-bold text-nia-dark">
                  {row.avg_value.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ─── Open Text Component ─────────────────────────────────────── */

function OpenTextList({ q }: { q: QuestionResult }) {
  const [showAll, setShowAll] = useState(false);
  const responses = q.text_responses || [];
  const visible = showAll ? responses : responses.slice(0, 10);

  return (
    <Card padding="md" className="space-y-3">
      <h4 className="text-sm font-medium text-foreground leading-snug">{q.question_text}</h4>
      <div className="text-xs text-text-muted">{responses.length} responses</div>

      {responses.length === 0 ? (
        <div className="text-sm text-text-muted italic">No responses</div>
      ) : (
        <div className="space-y-2">
          {visible.map((text, i) => (
            <div
              key={i}
              className="text-sm text-foreground bg-surface-subtle/50 rounded-lg px-3 py-2 border-l-2 border-nia-greyBlue/30"
            >
              {text}
            </div>
          ))}
          {responses.length > 10 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm text-nia-orange font-medium hover:underline"
            >
              Show all {responses.length} responses
            </button>
          )}
          {showAll && responses.length > 10 && (
            <button
              onClick={() => setShowAll(false)}
              className="text-sm text-nia-orange font-medium hover:underline"
            >
              Show fewer
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

/* ─── AI Summary Component ────────────────────────────────────── */

function AISummarySection({
  surveyId,
  waveId,
  summary,
  setSummary,
}: {
  surveyId: string;
  waveId: number | null;
  summary: AISummary | null;
  setSummary: (s: AISummary | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!waveId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/surveys/${surveyId}/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waveId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate summary');
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  // Editable section helper
  function updateField(field: keyof AISummary, index: number, value: string) {
    if (!summary) return;
    const updated = { ...summary };
    const arr = [...updated[field]];
    arr[index] = value;
    updated[field] = arr;
    setSummary(updated);
  }

  const sections: { key: keyof AISummary; label: string; icon: string }[] = [
    { key: 'key_findings', label: 'Key Findings', icon: '\uD83D\uDD0D' },
    { key: 'strengths', label: 'Strengths', icon: '\u2705' },
    { key: 'areas_for_improvement', label: 'Areas for Improvement', icon: '\u26A0\uFE0F' },
    { key: 'notable_comments', label: 'Notable Comments', icon: '\uD83D\uDCAC' },
    { key: 'recommended_actions', label: 'Recommended Actions', icon: '\uD83C\uDFAF' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader>Executive Summary</SectionHeader>
        <Button
          variant={summary ? 'ghost' : 'accent'}
          size="sm"
          onClick={generate}
          loading={loading}
          disabled={!waveId}
        >
          {summary ? 'Regenerate' : 'Generate Executive Summary'}
        </Button>
      </div>

      {error && (
        <div className="bg-nia-red/10 text-nia-red text-sm rounded-lg px-4 py-2">{error}</div>
      )}

      {loading && !summary && (
        <Card padding="md">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton-shimmer h-4 w-40" />
                <div className="skeleton-shimmer h-3 w-full" />
                <div className="skeleton-shimmer h-3 w-4/5" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {summary && (
        <Card padding="md" className="space-y-5">
          {sections.map(({ key, label }) => (
            <div key={key}>
              <h4 className="text-sm font-semibold text-nia-dark mb-2">{label}</h4>
              <ul className="space-y-1.5">
                {summary[key].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-nia-green mt-0.5 flex-shrink-0">{'\u2022'}</span>
                    <textarea
                      className="flex-1 text-sm text-foreground bg-transparent resize-none border-none focus:outline-none focus:ring-1 focus:ring-nia-grey-blue/30 rounded px-1 -mx-1"
                      value={item}
                      rows={Math.ceil(item.length / 80) || 1}
                      onChange={(e) => updateField(key, i, e.target.value)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-[11px] text-text-muted italic">
            Edit any bullet above. Changes are used when you export to PDF.
          </p>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function SurveyResultsPage() {
  const { id: surveyId } = useParams<{ id: string }>();

  /* ── State — all hooks declared before any early returns ─────── */

  const [surveyTitle, setSurveyTitle] = useState('');
  const [responseTarget, setResponseTarget] = useState<number | null>(null);
  const [processId, setProcessId] = useState<number | null>(null);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [selectedWaveId, setSelectedWaveId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'results' | 'trends'>('results');
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Track whether trends tab has been visited (lazy-load)
  const trendsVisitedRef = useRef(false);

  /* ── Computed values ─────────────────────────────────────────── */

  const currentWave = useMemo(
    () => waves.find((w) => w.id === selectedWaveId) || null,
    [waves, selectedWaveId]
  );

  // Overview stats
  const overviewStats = useMemo(() => {
    const totalResponses = currentWave?.response_count ?? 0;

    // Find NPS question
    const npsQ = questions.find((q) => q.question_type === 'nps');
    const npsScore = npsQ?.nps_score ?? null;
    const previousNps = npsQ?.previous_avg ?? null;

    // Average rating across all rating questions
    const ratingQs = questions.filter((q) => q.question_type === 'rating' && q.response_count > 0);
    const avgRating =
      ratingQs.length > 0 ? ratingQs.reduce((s, q) => s + q.avg_value, 0) / ratingQs.length : null;
    // Previous average rating
    const prevRatingQs = ratingQs.filter((q) => q.previous_avg !== null);
    const previousAvgRating =
      prevRatingQs.length > 0
        ? prevRatingQs.reduce((s, q) => s + (q.previous_avg as number), 0) / prevRatingQs.length
        : null;

    // Completion info
    const completionText =
      currentWave?.status === 'open'
        ? 'Survey is open'
        : currentWave?.closed_at
          ? `Closed ${new Date(currentWave.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
          : 'Closed';

    return { totalResponses, npsScore, previousNps, avgRating, previousAvgRating, completionText };
  }, [questions, currentWave]);

  /* ── Data fetching ───────────────────────────────────────────── */

  // Initial load: survey info + waves
  useEffect(() => {
    if (!surveyId) return;

    async function loadInitial() {
      const [surveyRes, wavesRes] = await Promise.all([
        fetch(`/api/surveys/${surveyId}`).then((r) => r.json()),
        fetch(`/api/surveys/${surveyId}/waves`).then((r) => r.json()),
      ]);

      setSurveyTitle(surveyRes.title || 'Survey Results');
      setResponseTarget(surveyRes.response_target || null);
      setProcessId(surveyRes.process_id || null);
      setWaves(wavesRes || []);

      // Default to latest non-scheduled wave (scheduled waves have no results)
      const resultWaves = (wavesRes || []).filter((w: Wave) => w.status !== 'scheduled');
      if (resultWaves.length > 0) {
        setSelectedWaveId(resultWaves[0].id);
      }

      setLoading(false);
    }

    loadInitial();
  }, [surveyId]);

  // Fetch results when wave changes
  const fetchResults = useCallback(
    async (waveId: number) => {
      setResultsLoading(true);
      setAiSummary(null); // Clear summary when wave changes
      try {
        const res = await fetch(`/api/surveys/${surveyId}/results?waveId=${waveId}`);
        const data = await res.json();
        setQuestions(data.questions || []);
      } catch {
        setQuestions([]);
      } finally {
        setResultsLoading(false);
      }
    },
    [surveyId]
  );

  useEffect(() => {
    if (selectedWaveId) {
      fetchResults(selectedWaveId);
    }
  }, [selectedWaveId, fetchResults]);

  // Track trends tab visits
  useEffect(() => {
    if (activeTab === 'trends') {
      trendsVisitedRef.current = true;
    }
  }, [activeTab]);

  /* ── PDF download handler ───────────────────────────────────── */

  async function handleDownloadPdf() {
    if (!selectedWaveId) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/surveys/${surveyId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waveId: selectedWaveId, summary: aiSummary }),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${surveyTitle.replace(/\s+/g, '-')}-Round-${currentWave?.wave_number || ''}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silent fail — could add error toast here later
    } finally {
      setPdfLoading(false);
    }
  }

  /* ── Loading state ───────────────────────────────────────────── */

  if (loading) return <DetailSkeleton sections={4} />;

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className="space-y-6 content-appear">
      {/* ── Sticky Header ──────────────────────────────────────── */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-background/95 backdrop-blur-sm border-b border-border-light">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Left: back arrow + title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Link
              href={processId ? `/processes/${processId}` : '/surveys'}
              className="text-text-muted hover:text-foreground transition-colors flex-shrink-0"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-foreground font-display truncate">
              {surveyTitle}
            </h1>
          </div>

          {/* Right: wave selector + action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {waves.length > 0 && (
              <Select
                value={String(selectedWaveId || '')}
                onChange={(e) => setSelectedWaveId(Number(e.target.value))}
                size="sm"
                className="w-40"
              >
                {waves
                  .filter((w) => w.status !== 'scheduled')
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      Round {w.wave_number}
                      {w.status === 'open' ? ' (open)' : ` (${w.response_count})`}
                    </option>
                  ))}
              </Select>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadPdf}
              loading={pdfLoading}
              disabled={!selectedWaveId}
              icon={
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
              }
            >
              PDF
            </Button>

            <Button
              variant="secondary"
              size="sm"
              href={
                selectedWaveId ? `/api/surveys/${surveyId}/csv?waveId=${selectedWaveId}` : undefined
              }
              target="_blank"
              icon={
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M3.375 12H12m0 0v1.5c0 .621.504 1.125 1.125 1.125"
                  />
                </svg>
              }
            >
              CSV
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tab Switcher ───────────────────────────────────────── */}
      <div className="flex gap-1 bg-surface-subtle rounded-lg p-1 w-fit">
        <button
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'results'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-text-muted hover:text-foreground'
          }`}
          onClick={() => setActiveTab('results')}
        >
          Results
        </button>
        <button
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'trends'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-text-muted hover:text-foreground'
          }`}
          onClick={() => setActiveTab('trends')}
        >
          Trends
        </button>
      </div>

      {/* ── Results Tab ────────────────────────────────────────── */}
      {activeTab === 'results' && (
        <div className="space-y-8">
          {/* Loading overlay for wave change */}
          {resultsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} padding="md">
                  <div className="space-y-3">
                    <div className="skeleton-shimmer h-5 w-64" />
                    <div className="skeleton-shimmer h-40 w-full rounded-lg" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* ── Overview Stat Cards ─────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Responses */}
                <Card padding="md">
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                    Total Responses
                  </div>
                  <div className="text-3xl font-bold text-foreground">
                    {overviewStats.totalResponses}
                    {responseTarget && responseTarget > 0 && (
                      <span className="text-sm font-medium text-text-muted ml-1">
                        / {responseTarget}
                      </span>
                    )}
                  </div>
                  {responseTarget && responseTarget > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            overviewStats.totalResponses >= responseTarget
                              ? 'bg-nia-green'
                              : 'bg-nia-dark-solid'
                          }`}
                          style={{
                            width: `${Math.min(
                              Math.round((overviewStats.totalResponses / responseTarget) * 100),
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {Math.min(
                          Math.round((overviewStats.totalResponses / responseTarget) * 100),
                          100
                        )}
                        % of target
                      </div>
                    </div>
                  )}
                </Card>

                {/* NPS (conditional) */}
                {overviewStats.npsScore !== null ? (
                  <Card padding="md">
                    <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                      Overall NPS
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-3xl font-bold"
                        style={{
                          color:
                            overviewStats.npsScore < 0
                              ? NIA.red
                              : overviewStats.npsScore < 50
                                ? NIA.yellow
                                : NIA.green,
                        }}
                      >
                        {overviewStats.npsScore}
                      </span>
                      <TrendArrow
                        current={overviewStats.npsScore}
                        previous={overviewStats.previousNps}
                      />
                    </div>
                  </Card>
                ) : (
                  <Card padding="md">
                    <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                      Questions
                    </div>
                    <div className="text-3xl font-bold text-foreground">{questions.length}</div>
                  </Card>
                )}

                {/* Average Rating */}
                <Card padding="md">
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                    Avg Rating
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      {overviewStats.avgRating !== null ? overviewStats.avgRating.toFixed(2) : '--'}
                    </span>
                    {overviewStats.avgRating !== null && (
                      <TrendArrow
                        current={overviewStats.avgRating}
                        previous={overviewStats.previousAvgRating}
                      />
                    )}
                  </div>
                </Card>

                {/* Completion Info */}
                <Card padding="md">
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                    Status
                  </div>
                  <div className="text-sm font-medium text-foreground mt-1">
                    {overviewStats.completionText}
                  </div>
                  {currentWave && (
                    <Badge
                      color={currentWave.status === 'open' ? 'green' : 'gray'}
                      size="xs"
                      className="mt-1"
                    >
                      {currentWave.status === 'open' ? 'Open' : 'Closed'}
                    </Badge>
                  )}
                </Card>
              </div>

              {/* ── Question Results ────────────────────────────── */}
              {questions.length === 0 ? (
                <Card padding="lg">
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">{'\uD83D\uDCCA'}</div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">No responses yet</h3>
                    <p className="text-sm text-text-muted">
                      Share your survey link to start collecting responses.
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {questions.map((q) => {
                    switch (q.question_type) {
                      case 'rating':
                        return <RatingChart key={q.question_id} q={q} />;
                      case 'nps':
                        return <NpsChart key={q.question_id} q={q} />;
                      case 'multiple_choice':
                        return <MultipleChoiceChart key={q.question_id} q={q} />;
                      case 'checkbox':
                        return <CheckboxChart key={q.question_id} q={q} />;
                      case 'matrix':
                        return <MatrixTable key={q.question_id} q={q} />;
                      case 'open_text':
                        return <OpenTextList key={q.question_id} q={q} />;
                      case 'yes_no':
                        return <YesNoChart key={q.question_id} q={q} />;
                      default:
                        return null;
                    }
                  })}
                </div>
              )}

              {/* ── AI Summary Section ──────────────────────────── */}
              {questions.length > 0 && (
                <AISummarySection
                  surveyId={surveyId}
                  waveId={selectedWaveId}
                  summary={aiSummary}
                  setSummary={setAiSummary}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ── Trends Tab ─────────────────────────────────────────── */}
      {activeTab === 'trends' && <TrendsTab surveyId={surveyId} />}
    </div>
  );
}
