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
  Legend,
} from 'recharts';
import { Card } from '@/components/ui';
import { NIA_COLORS } from '@/lib/colors';
import { formatValue } from '@/lib/review-status';

interface ChartDataPoint {
  date: string;
  label: string;
  value: number;
}

interface MetricChartsProps {
  chartData: ChartDataPoint[];
  metricName: string;
  unit: string;
  targetValue: number | null;
  comparisonValue: number | null;
  comparisonSource: string | null;
}

export default function MetricCharts({
  chartData,
  metricName,
  unit,
  targetValue,
  comparisonValue,
  comparisonSource,
}: MetricChartsProps) {
  if (chartData.length === 0) return null;

  return (
    <Card padding="lg">
      <h2 className="text-xl font-bold text-nia-dark mb-4">Trend Chart</h2>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
          <XAxis dataKey="label" tick={{ fill: 'var(--foreground)', fontSize: 12 }} />
          <YAxis tick={{ fill: 'var(--foreground)', fontSize: 12 }} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
            formatter={(value: unknown) => [formatValue(value as number, unit), metricName]}
            labelFormatter={(label: unknown) => String(label)}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke={NIA_COLORS.dark}
            strokeWidth={2}
            dot={{ fill: 'var(--foreground)', r: 5 }}
            activeDot={{ fill: NIA_COLORS.orange, r: 7 }}
            name="Actual"
          />
          {targetValue !== null && (
            <ReferenceLine
              y={targetValue}
              stroke={NIA_COLORS.green}
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{
                value: `Target: ${targetValue}`,
                fill: NIA_COLORS.green,
                fontSize: 12,
                position: 'right',
              }}
            />
          )}
          {comparisonValue !== null && (
            <ReferenceLine
              y={comparisonValue}
              stroke={NIA_COLORS.orange}
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `${comparisonSource || 'Comparison'}: ${comparisonValue}`,
                fill: NIA_COLORS.orange,
                fontSize: 12,
                position: 'right',
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
