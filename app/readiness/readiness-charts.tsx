'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui';
import HelpTip from '@/components/help-tip';

interface ChartDataPoint {
  date: string;
  score: number;
  ready: number;
  total: number;
}

interface ReadinessChartsProps {
  chartData: ChartDataPoint[];
}

export default function ReadinessCharts({ chartData }: ReadinessChartsProps) {
  if (chartData.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wider mb-3">
        Readiness Trend
        <HelpTip text="Daily snapshots of your readiness score. Dashed line at 80% = Baldrige Ready target." />
      </h2>
      <Card className="p-5">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--grid-line)' }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              ticks={[0, 20, 40, 60, 80, 100]}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--card)',
                color: 'var(--foreground)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                fontSize: '13px',
              }}
              formatter={(value) => [`${value ?? 0}%`, 'Readiness']}
              labelFormatter={(label) => label}
            />
            {/* Baldrige target line at 80% */}
            <ReferenceLine
              y={80}
              stroke="#b1bd37"
              strokeDasharray="6 4"
              label={{
                value: 'Target: 80%',
                position: 'right',
                fill: '#b1bd37',
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="var(--nia-dark)"
              strokeWidth={2.5}
              dot={{ fill: 'var(--nia-dark)', r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
              activeDot={{
                r: 6,
                strokeWidth: 2,
                stroke: 'var(--nia-dark)',
                fill: 'var(--card)',
              }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-nia-dark-solid inline-block rounded" />
            Org Readiness
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-3 h-0.5 inline-block rounded"
              style={{ backgroundColor: '#b1bd37', borderTop: '1px dashed #b1bd37' }}
            />
            Baldrige Target
          </span>
        </div>
      </Card>
    </div>
  );
}
