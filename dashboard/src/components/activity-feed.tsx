'use client';
import { formatDistanceToNow } from 'date-fns';
import { LogIn, LogOut, Coffee, Clock, User } from 'lucide-react';

interface Log {
  id: string;
  type: string;
  timestamp: string;
  employee?: {
    user?: { fullName?: string };
    employeeCode?: string;
  };
  branch?: { name?: string };
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  clock_in:  { icon: <LogIn size={14} />,  color: '#10b981', label: 'clocked in' },
  clock_out: { icon: <LogOut size={14} />,  color: '#ef4444', label: 'clocked out' },
  break_in:  { icon: <Coffee size={14} />,  color: '#3b82f6', label: 'started break' },
  break_out: { icon: <Clock size={14} />,   color: '#f59e0b', label: 'ended break' },
};

export function ActivityFeed({ logs }: { logs: Log[] }) {
  const items = logs.slice(0, 8);

  if (items.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 40 }}>
        <div className="empty-state-icon"><User size={32} /></div>
        <p className="empty-state-text">No recent activity</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((log) => {
        const cfg = TYPE_CONFIG[log.type] ?? { icon: <Clock size={14} />, color: '#64748b', label: log.type };
        const name = log.employee?.user?.fullName ?? 'Unknown';
        const timeAgo = formatDistanceToNow(new Date(log.timestamp), { addSuffix: true });

        return (
          <div
            key={log.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 10,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${cfg.color}18`,
                color: cfg.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {cfg.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
                <span style={{ color: 'var(--text-primary)' }}>{name}</span>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>{cfg.label}</span>
                {log.branch?.name && (
                  <span style={{ color: 'var(--text-muted)' }}> · {log.branch.name}</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {timeAgo}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
