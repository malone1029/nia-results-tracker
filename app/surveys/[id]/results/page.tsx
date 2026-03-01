'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button, Badge, Card, Select } from '@/components/ui';
import { DetailSkeleton } from '@/components/skeleton';
import { NIA_COLORS } from '@/lib/colors';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';

/* ─── Colors ──────────────────────────────────────────────────── */

// Alias canonical colors for brevity within this file
const NIA = NIA_COLORS;

/* Survey-specific chart palette — extends NIA brand with additional
   distinguishable hues for multi-series pie/bar charts */
const CHART_COLORS = [
  NIA.green,
  NIA.orange,
  NIA.dark,
  NIA.greyBlue,
  '#8884d8', // survey chart: lavender
  '#82ca9d', // survey chart: mint
  '#ffc658', // survey chart: gold
  '#ff7f50', // survey chart: coral
];

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

interface TrendsData {
  waves: {
    wave_id: number;
    wave_number: number;
    opened_at: string | null;
    closed_at: string | null;
    response_count: number;
    questions: { question_id: number; avg_value: number | null; nps_score: number | null }[];
  }[];
  questions: { id: number; question_text: string; question_type: string }[];
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

const tooltipStyle = {
  borderRadius: '8px',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--card)',
  color: 'var(--foreground)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  fontSize: '13px',
};

/* ─── Rating Chart Component ──────────────────────────────────── */

function RatingChart({ q }: { q: QuestionResult }) {
  const data = (q.distribution || []).map((count, i) => ({
    label: `${i + 1}`,
    count,
  }));

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground leading-snug flex-1">
          {q.question_text}
        </h4>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-2xl font-bold text-nia-dark">{q.avg_value.toFixed(2)}</span>
          <span className="text-xs text-text-muted">/{q.distribution?.length || 5}</span>
          <TrendArrow current={q.avg_value} previous={q.previous_avg} />
        </div>
      </div>
      <div className="text-xs text-text-muted">{q.response_count} responses</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          layout="horizontal"
          margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis hide allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === data.length - 1 ? NIA.green : NIA.greyBlue}
                fillOpacity={0.5 + (i / data.length) * 0.5}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

/* ─── NPS Visualization Component ─────────────────────────────── */

function NpsChart({ q }: { q: QuestionResult }) {
  const { nps_score = 0, nps_segments, distribution } = q;
  const total = nps_segments
    ? nps_segments.detractors + nps_segments.passives + nps_segments.promoters
    : 0;
  const detPct = total > 0 ? Math.round((nps_segments!.detractors / total) * 100) : 0;
  const pasPct = total > 0 ? Math.round((nps_segments!.passives / total) * 100) : 0;
  const proPct = total > 0 ? 100 - detPct - pasPct : 0;

  const npsColor = nps_score < 0 ? NIA.red : nps_score < 50 ? NIA.yellow : NIA.green;

  const distData = (distribution || []).map((count, i) => ({ score: String(i), count }));

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground leading-snug flex-1">
          {q.question_text}
        </h4>
        <Badge color={nps_score >= 50 ? 'green' : nps_score >= 0 ? 'yellow' : 'red'} size="sm">
          NPS
        </Badge>
      </div>

      {/* Large NPS score */}
      <div className="flex items-center gap-4">
        <div className="text-5xl font-bold" style={{ color: npsColor }}>
          {nps_score}
        </div>
        <div className="text-sm text-text-muted">
          <div>{q.response_count} responses</div>
          <TrendArrow current={nps_score} previous={q.previous_avg} />
        </div>
      </div>

      {/* Stacked horizontal bar */}
      <div>
        <div className="flex h-6 rounded-full overflow-hidden">
          {detPct > 0 && (
            <div
              className="flex items-center justify-center text-white text-[10px] font-semibold"
              style={{ width: `${detPct}%`, backgroundColor: NIA.red }}
            >
              {detPct}%
            </div>
          )}
          {pasPct > 0 && (
            <div
              className="flex items-center justify-center text-white text-[10px] font-semibold"
              style={{ width: `${pasPct}%`, backgroundColor: NIA.yellow }}
            >
              {pasPct}%
            </div>
          )}
          {proPct > 0 && (
            <div
              className="flex items-center justify-center text-white text-[10px] font-semibold"
              style={{ width: `${proPct}%`, backgroundColor: NIA.green }}
            >
              {proPct}%
            </div>
          )}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-text-muted">
          <span style={{ color: NIA.red }}>Detractors ({nps_segments?.detractors || 0})</span>
          <span style={{ color: NIA.yellow }}>Passives ({nps_segments?.passives || 0})</span>
          <span style={{ color: NIA.green }}>Promoters ({nps_segments?.promoters || 0})</span>
        </div>
      </div>

      {/* Distribution 0-10 */}
      {distData.length > 0 && (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={distData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis
              dataKey="score"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis hide allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={28}>
              {distData.map((_, i) => {
                const color = i <= 6 ? NIA.red : i <= 8 ? NIA.yellow : NIA.green;
                return <Cell key={i} fill={color} fillOpacity={0.8} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

/* ─── Multiple Choice (Donut) Component ───────────────────────── */

function MultipleChoiceChart({ q }: { q: QuestionResult }) {
  const labels = q.option_labels || [];
  const counts = q.option_counts || [];
  const total = counts.reduce((s, c) => s + c, 0);
  const data = labels.map((label, i) => ({
    name: label,
    value: counts[i] || 0,
    pct: total > 0 ? Math.round(((counts[i] || 0) / total) * 100) : 0,
  }));

  return (
    <Card padding="md" className="space-y-3">
      <h4 className="text-sm font-medium text-foreground leading-snug">{q.question_text}</h4>
      <div className="text-xs text-text-muted">{q.response_count} responses</div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              dataKey="value"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [
                `${value} (${total > 0 ? Math.round((Number(value) / total) * 100) : 0}%)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="flex-1 text-foreground truncate">{d.name}</span>
              <span className="text-text-muted">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* "Other" responses */}
      {q.other_count && q.other_count > 0 && q.other_texts && q.other_texts.length > 0 && (
        <div className="pt-2 border-t border-border-light">
          <div className="text-xs font-medium text-text-muted mb-1">
            Other responses ({q.other_count})
          </div>
          {q.other_texts.map((t, i) => (
            <div
              key={i}
              className="text-xs text-text-secondary pl-3 border-l-2 border-nia-orange/30 py-0.5"
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ─── Checkbox (Bar) Component ────────────────────────────────── */

function CheckboxChart({ q }: { q: QuestionResult }) {
  const labels = q.option_labels || [];
  const counts = q.option_counts || [];
  const data = labels
    .map((label, i) => ({ label, count: counts[i] || 0 }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card padding="md" className="space-y-3">
      <h4 className="text-sm font-medium text-foreground leading-snug">{q.question_text}</h4>
      <div className="text-xs text-text-muted">
        {q.response_count} responses
        {q.total_respondents ? ` (${q.total_respondents} respondents)` : ''}
      </div>

      <ResponsiveContainer width="100%" height={Math.max(140, data.length * 32)}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar
            dataKey="count"
            fill={NIA.green}
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            fillOpacity={0.8}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* "Other" responses */}
      {q.other_count && q.other_count > 0 && q.other_texts && q.other_texts.length > 0 && (
        <div className="pt-2 border-t border-border-light">
          <div className="text-xs font-medium text-text-muted mb-1">
            Other responses ({q.other_count})
          </div>
          {q.other_texts.map((t, i) => (
            <div
              key={i}
              className="text-xs text-text-secondary pl-3 border-l-2 border-nia-orange/30 py-0.5"
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </Card>
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

/* ─── Yes/No Component ────────────────────────────────────────── */

function YesNoChart({ q }: { q: QuestionResult }) {
  const yesPct = Math.round(q.avg_value * 100);
  const noPct = 100 - yesPct;

  return (
    <Card padding="md" className="space-y-3">
      <h4 className="text-sm font-medium text-foreground leading-snug">{q.question_text}</h4>
      <div className="text-xs text-text-muted">{q.response_count} responses</div>

      <div className="flex items-center gap-4">
        {/* Mini donut */}
        <ResponsiveContainer width={100} height={100}>
          <PieChart>
            <Pie
              data={[
                { name: 'Yes', value: yesPct },
                { name: 'No', value: noPct },
              ]}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={42}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              <Cell fill={NIA.green} />
              <Cell fill="var(--surface-subtle)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div>
          <div className="text-2xl font-bold text-nia-dark">{yesPct}% Yes</div>
          <div className="text-sm text-text-muted">{noPct}% No</div>
          <TrendArrow current={q.avg_value} previous={q.previous_avg} />
        </div>
      </div>
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

/* ─── Trends Tab Component ────────────────────────────────────── */

function TrendsTab({ surveyId }: { surveyId: string }) {
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/surveys/${surveyId}/trends`);
        if (!res.ok) throw new Error('Failed to load trends');
        const data = await res.json();
        setTrendsData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trends');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [surveyId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} padding="md">
            <div className="skeleton-shimmer h-5 w-64 mb-3" />
            <div className="skeleton-shimmer h-48 w-full rounded-lg" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card padding="md">
        <div className="text-sm text-nia-red">{error}</div>
      </Card>
    );
  }

  if (!trendsData || trendsData.waves.length <= 1) {
    return (
      <Card padding="lg">
        <div className="text-center py-8">
          <div className="text-4xl mb-3">{'\uD83D\uDCC8'}</div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Trends will appear after your second round
          </h3>
          <p className="text-sm text-text-muted">
            Complete at least two survey waves to see how results change over time.
          </p>
        </div>
      </Card>
    );
  }

  const { waves, questions } = trendsData;

  // Group questions: rating/yes_no together, nps separate, skip text-only types
  const chartableQuestions = questions.filter(
    (q) => !['open_text', 'multiple_choice', 'checkbox'].includes(q.question_type)
  );
  const npsQuestions = chartableQuestions.filter((q) => q.question_type === 'nps');
  const otherQuestions = chartableQuestions.filter((q) => q.question_type !== 'nps');

  function buildChartData(questionId: number, isNps: boolean) {
    return waves.map((w) => {
      const qData = w.questions.find((q) => q.question_id === questionId);
      const dateLabel = w.closed_at
        ? new Date(w.closed_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        : `Round ${w.wave_number}`;
      return {
        label: dateLabel,
        wave: `Round ${w.wave_number}`,
        value: isNps ? (qData?.nps_score ?? null) : (qData?.avg_value ?? null),
        responses: w.response_count,
      };
    });
  }

  function TrendChart({
    question,
    isNps,
  }: {
    question: { id: number; question_text: string; question_type: string };
    isNps: boolean;
  }) {
    const data = buildChartData(question.id, isNps);
    const yDomain = isNps ? ([-100, 100] as const) : ([0, 'auto'] as const);

    return (
      <Card padding="md" className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground leading-snug flex-1">
            {question.question_text}
          </h4>
          <Badge color={isNps ? 'orange' : 'green'} size="xs">
            {question.question_type === 'yes_no' ? 'Yes/No' : isNps ? 'NPS' : 'Rating'}
          </Badge>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--grid-line)' }}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [
                value != null ? Number(value).toFixed(1) : 'N/A',
                isNps ? 'NPS Score' : 'Average',
              ]}
              labelFormatter={(label, payload) => {
                if (payload && payload.length > 0) {
                  const item = payload[0].payload;
                  return `${item.wave} (${label}) - ${item.responses} responses`;
                }
                return String(label);
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={isNps ? NIA.orange : NIA.dark}
              strokeWidth={2.5}
              dot={{
                fill: isNps ? NIA.orange : NIA.dark,
                r: 4,
                strokeWidth: 2,
                stroke: 'var(--card)',
              }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Response count trend */}
      <Card padding="md" className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Response Count by Round</h4>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={waves.map((w) => ({
              label: `Round ${w.wave_number}`,
              responses: w.response_count,
            }))}
            margin={{ top: 5, right: 10, bottom: 5, left: 10 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis hide allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar
              dataKey="responses"
              fill={NIA.greyBlue}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              fillOpacity={0.7}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* NPS trends */}
      {npsQuestions.length > 0 && (
        <>
          <SectionHeader>NPS Trends</SectionHeader>
          {npsQuestions.map((q) => (
            <TrendChart key={q.id} question={q} isNps />
          ))}
        </>
      )}

      {/* Rating / Yes-No trends */}
      {otherQuestions.length > 0 && (
        <>
          <SectionHeader>Rating Trends</SectionHeader>
          {otherQuestions.map((q) => (
            <TrendChart key={q.id} question={q} isNps={false} />
          ))}
        </>
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
