'use client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useState, useEffect } from 'react';

interface Log {
  type: string;
  timestamp: string;
}

export function AttendanceChart({ data }: { data: Log[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hours = Array.from({ length: 12 }, (_, i) => i + 6); // 6am to 5pm

  const chartData = hours.map((h) => {
    const label = `${h}:00`;
    const clockIns = data.filter((d) => {
      const hour = new Date(d.timestamp).getHours();
      return d.type === 'clock_in' && hour === h;
    }).length;
    const clockOuts = data.filter((d) => {
      const hour = new Date(d.timestamp).getHours();
      return d.type === 'clock_out' && hour === h;
    }).length;
    return { hour: label, clockIns, clockOuts };
  });

  if (!mounted) {
    return <div style={{ width: '100%', height: 280 }} />;
  }

  return (
    <div style={{ width: '100%', height: 280, minHeight: 280 }}>
      <ResponsiveContainer width="100%" height="100%" debounce={100}>
        <BarChart data={chartData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="hour"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: '#0f1420',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              fontSize: 12,
              color: '#f1f5f9',
            }}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <Bar dataKey="clockIns" name="Clock In" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {chartData.map((_, i) => (
              <Cell key={`in-${i}`} fill="#10b981" fillOpacity={0.85} />
            ))}
          </Bar>
          <Bar dataKey="clockOuts" name="Clock Out" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {chartData.map((_, i) => (
              <Cell key={`out-${i}`} fill="#ef4444" fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
