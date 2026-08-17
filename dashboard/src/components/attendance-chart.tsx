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
  employee?: {
    user?: { fullName: string };
    employeeCode?: string;
  };
  branch?: { name: string };
}

interface AttendanceChartProps {
  data: Log[];
  onHourClick?: (hour: string, logs: Log[]) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        background: 'var(--bg-card, #0f1420)',
        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        borderRadius: 10,
        padding: '12px 16px',
        fontSize: 12,
        color: 'var(--text-primary, #f1f5f9)',
        boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.2)',
        minWidth: 160
      }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>{label}</div>
        
        {data.clockIns > 0 && (
          <div style={{ marginBottom: data.clockOuts > 0 ? 10 : 0 }}>
            <div style={{ color: '#10b981', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Clock In:</span>
              <span>{data.clockIns}</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
              {data.clockInLogs.slice(0, 3).map((l: any) => l.employee?.user?.fullName?.split(' ')[0] || 'Unknown').join(', ')}
              {data.clockInLogs.length > 3 ? ` +${data.clockInLogs.length - 3} more` : ''}
            </div>
          </div>
        )}

        {data.clockOuts > 0 && (
          <div style={{ marginBottom: (data.breakIns > 0 || data.breakOuts > 0) ? 10 : 0 }}>
            <div style={{ color: '#ef4444', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Clock Out:</span>
              <span>{data.clockOuts}</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
              {data.clockOutLogs.slice(0, 3).map((l: any) => l.employee?.user?.fullName?.split(' ')[0] || 'Unknown').join(', ')}
              {data.clockOutLogs.length > 3 ? ` +${data.clockOutLogs.length - 3} more` : ''}
            </div>
          </div>
        )}

        {data.breakIns > 0 && (
          <div style={{ marginBottom: data.breakOuts > 0 ? 10 : 0 }}>
            <div style={{ color: '#3b82f6', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Break In:</span>
              <span>{data.breakIns}</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
              {data.breakInLogs.slice(0, 3).map((l: any) => l.employee?.user?.fullName?.split(' ')[0] || 'Unknown').join(', ')}
              {data.breakInLogs.length > 3 ? ` +${data.breakInLogs.length - 3} more` : ''}
            </div>
          </div>
        )}

        {data.breakOuts > 0 && (
          <div>
            <div style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Break Out:</span>
              <span>{data.breakOuts}</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
              {data.breakOutLogs.slice(0, 3).map((l: any) => l.employee?.user?.fullName?.split(' ')[0] || 'Unknown').join(', ')}
              {data.breakOutLogs.length > 3 ? ` +${data.breakOutLogs.length - 3} more` : ''}
            </div>
          </div>
        )}
        
        {data.clockIns === 0 && data.clockOuts === 0 && data.breakIns === 0 && data.breakOuts === 0 && (
          <div style={{ color: 'var(--text-secondary)' }}>No activity</div>
        )}
      </div>
    );
  }
  return null;
};

export function AttendanceChart({ data, onHourClick }: AttendanceChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hours = Array.from({ length: 13 }, (_, i) => i + 6); // 6am to 6pm

  const chartData = hours.map((h) => {
    const label = `${h}:00`;
    const hourLogs = data.filter(d => new Date(d.timestamp).getHours() === h);
    const clockInLogs = hourLogs.filter(d => d.type === 'clock_in');
    const clockOutLogs = hourLogs.filter(d => d.type === 'clock_out');
    const breakInLogs = hourLogs.filter(d => d.type === 'break_in');
    const breakOutLogs = hourLogs.filter(d => d.type === 'break_out');
    
    return { 
      hour: label, 
      clockIns: clockInLogs.length, 
      clockOuts: clockOutLogs.length,
      breakIns: breakInLogs.length,
      breakOuts: breakOutLogs.length,
      clockInLogs,
      clockOutLogs,
      breakInLogs,
      breakOutLogs,
      rawLogs: hourLogs
    };
  });

  if (!mounted) {
    return <div style={{ width: '100%', height: 280 }} />;
  }

  return (
    <div style={{ width: '100%', height: 280, minHeight: 280 }}>
      <ResponsiveContainer width="100%" height="100%" debounce={100}>
        <BarChart data={chartData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, rgba(255,255,255,0.05))" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fill: 'var(--text-secondary, #64748b)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-color, rgba(255,255,255,0.08))' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-secondary, #64748b)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'var(--border-color, rgba(128,128,128,0.1))' }}
          />
          <Bar 
            dataKey="clockIns" 
            name="Clock In" 
            fill="#10b981" 
            radius={[4, 4, 0, 0]} 
            maxBarSize={20}
            onClick={(data: any) => {
              const payload = data?.payload || data;
              if (onHourClick && payload?.rawLogs?.length > 0) {
                onHourClick(payload.hour, payload.rawLogs);
              }
            }}
          >
            {chartData.map((entry, i) => (
              <Cell key={`in-${i}`} fill="#10b981" fillOpacity={0.85} style={{ cursor: entry.clockIns > 0 && onHourClick ? 'pointer' : 'default' }}/>
            ))}
          </Bar>
          <Bar 
            dataKey="clockOuts" 
            name="Clock Out" 
            fill="#ef4444" 
            radius={[4, 4, 0, 0]} 
            maxBarSize={20}
            onClick={(data: any) => {
              const payload = data?.payload || data;
              if (onHourClick && payload?.rawLogs?.length > 0) {
                onHourClick(payload.hour, payload.rawLogs);
              }
            }}
          >
            {chartData.map((entry, i) => (
              <Cell key={`out-${i}`} fill="#ef4444" fillOpacity={0.85} style={{ cursor: entry.clockOuts > 0 && onHourClick ? 'pointer' : 'default' }}/>
            ))}
          </Bar>
          <Bar 
            dataKey="breakIns" 
            name="Break In" 
            fill="#3b82f6" 
            radius={[4, 4, 0, 0]} 
            maxBarSize={20}
            onClick={(data: any) => {
              const payload = data?.payload || data;
              if (onHourClick && payload?.rawLogs?.length > 0) {
                onHourClick(payload.hour, payload.rawLogs);
              }
            }}
          >
            {chartData.map((entry, i) => (
              <Cell key={`bin-${i}`} fill="#3b82f6" fillOpacity={0.85} style={{ cursor: entry.breakIns > 0 && onHourClick ? 'pointer' : 'default' }}/>
            ))}
          </Bar>
          <Bar 
            dataKey="breakOuts" 
            name="Break Out" 
            fill="#f59e0b" 
            radius={[4, 4, 0, 0]} 
            maxBarSize={20}
            onClick={(data: any) => {
              const payload = data?.payload || data;
              if (onHourClick && payload?.rawLogs?.length > 0) {
                onHourClick(payload.hour, payload.rawLogs);
              }
            }}
          >
            {chartData.map((entry, i) => (
              <Cell key={`bout-${i}`} fill="#f59e0b" fillOpacity={0.85} style={{ cursor: entry.breakOuts > 0 && onHourClick ? 'pointer' : 'default' }}/>
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
