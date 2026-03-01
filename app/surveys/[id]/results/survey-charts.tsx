'use client';

import { useState, useEffect } from 'react';
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
import { Card, Badge, Button, Select } from '@/components/ui';
import { NIA_COLORS } from '@/lib/colors';

/* ─── Colors ──────────────────────────────────────────────────── */

const NIA = NIA_COLORS;

const CHART_COLORS = [
  NIA.green,
  NIA.orange,
  NIA.dark,
  NIA.greyBlue,
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7f50',
];

/* ─── Types (re-exported for the page) ────────────────────────── */

export interface QuestionResult {
  question_id: number;
  question_text: string;
  question_type: string;
  response_count: number;
  avg_value: number;
  previous_avg: number | null;
  distribution?: number[];
  nps_score?: number;
  nps_segments?: { detractors: number; passives: number; promoters: number };
  option_counts?: number[];
  option_labels?: string[];
  other_count?: number;
  other_texts?: string[];
  total_respondents?: number;
  text_responses?: string[];
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

/* ─── Shared helpers ──────────────────────────────────────────── */

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

export function RatingChart({ q }: { q: QuestionResult }) {
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

export function NpsChart({ q }: { q: QuestionResult }) {
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

export function MultipleChoiceChart({ q }: { q: QuestionResult }) {
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

export function CheckboxChart({ q }: { q: QuestionResult }) {
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

/* ─── Yes/No Component ────────────────────────────────────────── */

export function YesNoChart({ q }: { q: QuestionResult }) {
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

/* ─── Trends Tab Component ────────────────────────────────────── */

export function TrendsTab({ surveyId }: { surveyId: string }) {
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
