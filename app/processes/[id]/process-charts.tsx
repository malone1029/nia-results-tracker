'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { getTrendColor } from '@/lib/colors';

interface ProcessSparklineProps {
  values: number[];
  isHigherBetter: boolean;
}

export function ProcessSparkline({ values, isHigherBetter }: ProcessSparklineProps) {
  if (values.length < 2) {
    return <span className="text-text-muted text-xs w-16 text-center flex-shrink-0">&mdash;</span>;
  }

  const first = values[0];
  const last = values[values.length - 1];
  const trend = last > first ? 'up' : last < first ? 'down' : 'flat';
  const improving = (trend === 'up' && isHigherBetter) || (trend === 'down' && !isHigherBetter);
  const color = getTrendColor(!!improving, trend);
  const data = values.map((v, i) => ({ i, v }));

  return (
    <div className="w-16 h-6 flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
