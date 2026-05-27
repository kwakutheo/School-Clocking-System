'use client';
import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { format } from 'date-fns';
import { attendanceApi, employeesApi, branchesApi, saasAdminApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { AttendanceChart } from '@/components/attendance-chart';
import { StatCardSkeleton, TableSkeleton } from '@/components/skeleton';
import { AdminManualClockModal } from '@/components/admin-manual-clock-modal';
import {
  TrendingUp, TrendingDown, Users, FileText, Building2, Clock, Calendar, AlertTriangle, UserCheck, X, ChevronLeft, ChevronRight, Plane, Megaphone
} from 'lucide-react';

const fetcher = (fn: () => Promise<unknown>) => () => fn().then((r: any) => r.data);

// Parses a 'yyyy-MM-dd' string as LOCAL midnight, avoiding UTC timezone shift errors.
// Returns null for incomplete/invalid strings (e.g. when user is mid-typing).
function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // Check the date actually round-trips (guards against e.g. Feb 30)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function StatCard({
  icon,
  value,
  label,
  color,
  trend,
  trendUp,
  secondary,
  onClick,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
  trend?: string;
  trendUp?: boolean;
  secondary?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div 
      className="stat-card" 
      style={{ ['--stat-color' as any]: color, ['--stat-color-dim' as any]: `${color}15`, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div className="stat-card-glow" />
      <div className="stat-card-content">
        <div className="stat-icon-wrapper">
          <div className="stat-icon">{icon}</div>
          {trend && (
            <div className={`stat-trend ${trendUp ? 'up' : 'down'}`}>
              {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend}
            </div>
          )}
        </div>
        <div className="stat-main">
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
        {secondary && <div className="stat-secondary">{secondary}</div>}
      </div>
    </div>
  );
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    clock_in: 'Clock In', clock_out: 'Clock Out',
    break_in: 'Break In', break_out: 'Break Out',
  };
  return map[type] ?? type;
}

function typeBadge(type: string) {
  if (type === 'clock_in') return 'badge-green';
  if (type === 'clock_out') return 'badge-red';
  if (type === 'break_in') return 'badge-blue';
  return 'badge-amber';
}

/** Converts a raw minute count into a human-friendly "Xh Ymin" string. */
function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'hr_admin' || user?.role === 'super_admin';

  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showManualClock, setShowManualClock] = useState(false);
  const [modalDetails, setModalDetails] = useState<{ title: string; type: string; data: any[] } | null>(null);
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');

  // Bulletins announcement notifications
  const [activeBulletins, setActiveBulletins] = useState<any[]>([]);
  const [currentBulletinIdx, setCurrentBulletinIdx] = useState(0);
  const [showBulletin, setShowBulletin] = useState(false);

  useEffect(() => {
    if (user?.tenantId) {
      saasAdminApi.getActiveBulletins()
        .then((res) => {
          if (res.data && res.data.length > 0) {
            setActiveBulletins(res.data);
            setShowBulletin(true);
          }
        })
        .catch((err) => console.error('Failed to load active announcements:', err));
    }
  }, [user]);

  const { data: live, isLoading: liveLoading } = useSWR(
    ['live', selectedDate], 
    fetcher(() => attendanceApi.live(isToday ? undefined : selectedDate)), 
    { refreshInterval: isToday ? 30_000 : 0 }
  );
  const { data: stats, isLoading: statsLoading } = useSWR(
    ['attendance-stats', selectedDate], 
    fetcher(() => attendanceApi.stats(isToday ? undefined : selectedDate)), 
    { refreshInterval: isToday ? 30_000 : 0 }
  );
  const { data: employees, isLoading: empLoading } = useSWR('employees', fetcher(() => employeesApi.listAll()));
  const { data: branches, isLoading: branchLoading } = useSWR('branches', fetcher(() => branchesApi.list()));

  const liveList: any[] = live ?? [];
  const employeeList: any[] = employees ?? [];
  const activeWorkforce = employeeList.filter(emp => emp.status === 'active' || emp.status === 'suspended');
  const activeCount = employeeList.filter(emp => emp.status === 'active').length;
  const suspendedCount = employeeList.filter(emp => emp.status === 'suspended').length;
  const branchList: any[] = branches ?? [];
  const dashboardStats = stats ?? { totalUniqueAttendance: 0, currentlyOnSite: 0 };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const isLoading = liveLoading || empLoading || statsLoading || branchLoading;

  const activeBranchNames = branchList.slice(0, 2).map(b => b.name).join(' & ') + (branchList.length > 2 ? ` + ${branchList.length - 2} more` : '');

  const handlePrevDate = () => {
    const d = parseLocalDate(selectedDate);
    if (!d) return;
    d.setDate(d.getDate() - 1);
    setSelectedDate(format(d, 'yyyy-MM-dd'));
  };

  const handleNextDate = () => {
    const d = parseLocalDate(selectedDate);
    if (!d) return;
    d.setDate(d.getDate() + 1);
    const today = parseLocalDate(format(new Date(), 'yyyy-MM-dd'))!;
    if (d <= today) {
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    }
  };

  return (
    <div className="dashboard-container">
      <div className="page-header dashboard-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">
            {greeting}, <span className="text-gradient">{user?.fullName}</span>
          </h1>
          <p className="page-subtitle">
            {(() => {
              const d = parseLocalDate(selectedDate);
              return d ? format(d, 'EEEE, MMMM d, yyyy') : selectedDate;
            })()} · 
            {isToday ? (
              <span style={{ color: 'var(--success)', fontWeight: 600 }}> ● Live</span>
            ) : (
              <span style={{ color: 'var(--warning)', fontWeight: 600 }}> ● Historical</span>
            )} Workforce Overview
          </p>
        </div>
        <div className="dashboard-date-picker" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <button
            onClick={handlePrevDate}
            style={{ transition: 'background 0.2s ease', background: 'transparent', border: 'none', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', borderRight: '1px solid var(--border-color)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(128, 128, 128, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Previous day"
          >
            <ChevronLeft size={18} />
          </button>
          
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => {
              const val = e.target.value;
              const parsed = parseLocalDate(val);
              if (!parsed) return;
              const today = parseLocalDate(format(new Date(), 'yyyy-MM-dd'))!;
              // Clamp future dates to today
              setSelectedDate(parsed > today ? format(new Date(), 'yyyy-MM-dd') : val);
            }}
            max={format(new Date(), 'yyyy-MM-dd')}
            className="input-field"
            aria-label="Select date for attendance history"
            title="Select date for attendance history"
            style={{ 
              transition: 'background 0.2s ease',
              width: 'auto', 
              padding: '10px 16px', 
              border: 'none', 
              background: 'transparent', 
              color: 'var(--text-primary)', 
              fontFamily: 'inherit',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(128, 128, 128, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          />

          <button
            onClick={handleNextDate}
            disabled={isToday}
            style={{ 
              transition: 'background 0.2s ease',
              background: 'transparent', 
              border: 'none', 
              padding: '10px 14px', 
              cursor: isToday ? 'not-allowed' : 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: isToday ? 'var(--text-muted)' : 'var(--text-secondary)', 
              borderLeft: '1px solid var(--border-color)',
              opacity: isToday ? 0.5 : 1
            }}
            onMouseEnter={(e) => { if(!isToday) e.currentTarget.style.background = 'rgba(128, 128, 128, 0.15)'}}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Next day"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {dashboardStats.dayStatus?.isNonWorking && (
        <div style={{
          padding: '16px 20px',
          background: 'var(--primary-color-dim)',
          border: '1px solid var(--primary-color)',
          borderRadius: 12,
          marginBottom: 16,
          color: 'var(--primary-color)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <Calendar size={20} />
          {isToday ? 'Today is' : 'This was'} a non-working day: {dashboardStats.dayStatus.name}
        </div>
      )}
      
      <div className="stats-grid">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            {isToday && <StatCardSkeleton />}
          </>
        ) : (
          <>
            <StatCard
              icon={<Clock size={20} />}
              value={dashboardStats.currentlyOnSite}
              label={isToday ? "Currently at work" : "Total Present"}
              color="#10b981"
              trendUp={true}
              secondary={isToday ? "Active clock-ins right now" : "Total employees who clocked in"}
              onClick={() => setModalDetails({
                title: isToday ? "Currently at Work" : "Total Present",
                type: 'present',
                data: dashboardStats.presentEmployees ?? []
              })}
            />
            <StatCard
              icon={<TrendingDown size={20} />}
              value={dashboardStats.lateArrivals ?? 0}
              label="Late Arrivals"
              color="#f43f5e"
              secondary="Employees who arrived late"
              onClick={() => setModalDetails({
                title: "Late Arrivals",
                type: 'late',
                data: dashboardStats.lateEmployees ?? []
              })}
            />
            <StatCard
              icon={<Users size={20} />}
              value={dashboardStats.absentToday ?? 0}
              label={isToday ? "Absent Today" : "Absent"}
              color="#f59e0b"
              secondary={isToday ? "Expected but not clocked in" : "Expected but didn't clock in"}
              onClick={() => setModalDetails({
                title: isToday ? "Absent Today" : "Absent",
                type: 'absent',
                data: dashboardStats.absentEmployees ?? []
              })}
            />
            {(dashboardStats.onLeaveToday ?? 0) > 0 && (
              <StatCard
                icon={<Plane size={20} />}
                value={dashboardStats.onLeaveToday}
                label={isToday ? "On Leave Today" : "On Leave"}
                color="#0284c7"
                secondary={isToday ? "Approved leave — authorized absence" : "On approved leave this day"}
                onClick={() => setModalDetails({
                  title: isToday ? "On Leave Today" : "On Leave",
                  type: 'onLeave',
                  data: dashboardStats.onLeaveEmployees ?? []
                })}
              />
            )}
            <StatCard
              icon={<Clock size={20} />}
              value={dashboardStats.earlyOuts ?? 0}
              label="Early Outs"
              color="#f97316"
              secondary="Left before shift ended"
              onClick={() => setModalDetails({
                title: "Early Outs",
                type: 'earlyOut',
                data: dashboardStats.earlyOutEmployees ?? []
              })}
            />
            <StatCard
              icon={<AlertTriangle size={20} />}
              value={dashboardStats.forgotClockOut ?? 0}
              label="Forgot Out"
              color="#a1887f"
              secondary="Missing clock-out logs"
              onClick={() => setModalDetails({
                title: "Forgot Out",
                type: 'forgotOut',
                data: dashboardStats.forgotOutEmployees ?? []
              })}
            />
            {isToday && (
              <StatCard
                icon={<Building2 size={20} />}
                value={activeWorkforce.length}
                label="Total Employees"
                color="#3b82f6"
                secondary={
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>{activeCount} Active</span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: '#f43f5e', fontWeight: 600 }}>{suspendedCount} Suspended</span>
                  </div>
                }
              />
            )}
          </>
        )}
      </div>

      <div className="dashboard-content-grid">
        <div className="table-wrap" style={{ padding: '20px 24px' }}>
          <div className="table-header" style={{ padding: '0 0 16px', borderBottom: 'none' }}>
            <span className="table-title">Attendance Overview</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{isToday ? 'Today' : 'Date'} by hour</span>
          </div>
          {isLoading ? (
            <div className="loading-center" style={{ padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : (
            <AttendanceChart data={liveList} />
          )}
        </div>

        <div className="table-wrap" style={{ padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
          <div className="table-header" style={{ padding: '0 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="table-title">Absent {isToday ? 'Today' : 'This Day'}</span>
            {!isLoading && !dashboardStats.dayStatus?.isNonWorking && (
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '3px 10px',
                borderRadius: 20, background: 'rgba(245,158,11,0.12)',
                color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)',
              }}>
                {dashboardStats.absentToday ?? 0} missing
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="loading-center" style={{ padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : dashboardStats.dayStatus?.isNonWorking ? (
            <div className="empty-state" style={{ padding: '24px 20px' }}>
              <div className="empty-state-icon"><Calendar size={32} /></div>
              <p className="empty-state-text" style={{ fontSize: 13 }}>
                No absences — {dashboardStats.dayStatus.name ?? 'Non-working day'}.
              </p>
            </div>
          ) : (dashboardStats.absentEmployees ?? []).length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 20px' }}>
              <div className="empty-state-icon" style={{ color: 'var(--success)' }}>
                <Users size={32} />
              </div>
              <p className="empty-state-text" style={{ fontSize: 13 }}>
                All active employees have clocked in! 🎉
              </p>
            </div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: 340, padding: '0 4px' }}>
              {(dashboardStats.absentEmployees ?? []).map((emp: any) => (
                <div key={emp.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 24px',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="avatar" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', flexShrink: 0 }}>
                    {emp.fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.fullName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {emp.employeeCode}
                      {emp.branch && <span> · {emp.branch}</span>}
                    </div>
                  </div>
                  {emp.isSuspended ? (
                    <div style={{
                      fontSize: 11, color: '#f43f5e', fontWeight: 600,
                      background: 'rgba(244,63,94,0.1)', padding: '3px 8px',
                      borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      SUSPENDED
                    </div>
                  ) : emp.shift && (
                    <div style={{
                      fontSize: 11, color: '#f59e0b', fontWeight: 600,
                      background: 'rgba(245,158,11,0.1)', padding: '3px 8px',
                      borderRadius: 6, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {emp.shift}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live attendance feed */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
        <div className="table-wrap">
          <div className="table-header">
            <span className="table-title">
              {isToday && <span className="live-dot" style={{ marginRight: 8 }} />}
              {isToday ? 'Live Attendance Feed' : 'Attendance Log'}
            </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isToday && isAdmin && !dashboardStats.dayStatus?.isNonWorking && (
                <button
                  id="manual-clock-open-btn"
                  className="btn btn-primary"
                  style={{ fontSize: 13, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setShowManualClock(true)}
                >
                  <UserCheck size={15} />
                  Manual Clock
                </button>
              )}
              {isToday && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Auto-syncing
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {liveList.length} events {isToday ? 'today' : 'on this date'}
              </span>
            </div>
          </div>

          {liveList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Clock size={42} /></div>
              <p className="empty-state-text">No attendance recorded {isToday ? 'today' : 'on this date'} yet.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Event</th>
                  <th>Branch</th>
                  <th>Time</th>
                  <th>GPS</th>
                </tr>
              </thead>
              <tbody>
                {liveList.map((log: any) => (
                  <tr key={log.id} style={log.isAdminOverride ? { background: 'rgba(59,130,246,0.04)' } : {}}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar">
                          {(log.employee?.user?.fullName ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{log.employee?.user?.fullName ?? 'Unknown'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{log.employee?.employeeCode}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className={`badge ${typeBadge(log.type)}`}>{typeLabel(log.type)}</span>
                        {log.isAdminOverride && (
                          <span className="badge badge-blue" style={{ fontSize: 10 }} title={log.adminNote}>
                            Admin Override
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{log.branch?.name ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{format(new Date(log.timestamp), 'HH:mm:ss')}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {log.latitude ? `${Number(log.latitude).toFixed(4)}, ${Number(log.longitude).toFixed(4)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Admin Manual Clock Modal */}
      {showManualClock && (
        <AdminManualClockModal
          onClose={() => setShowManualClock(false)}
          onSuccess={() => {
            mutate(['live', selectedDate]);
            mutate(['attendance-stats', selectedDate]);
          }}
        />
      )}

      {/* Details Modal */}
      {modalDetails && (
        <>
          <div
            onClick={() => setModalDetails(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)', zIndex: 1000,
            }}
          />
          <div
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%', maxWidth: 700, maxHeight: '80vh',
              display: 'flex', flexDirection: 'column',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
              zIndex: 1001,
            }}
          >
            <div style={{ padding: 24, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>{modalDetails.title}</h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {format(parseLocalDate(selectedDate)!, 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
              <button
                onClick={() => setModalDetails(null)}
                title="Close details"
                aria-label="Close details"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', padding: 4, borderRadius: 6,
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ overflowY: 'auto', padding: 24 }}>
              {modalDetails.data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  No records found.
                </div>
              ) : (
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Employee</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Branch</th>
                      {modalDetails.type === 'present' && (
                        <>
                          <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Clock In</th>
                          <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>{isToday ? 'Status' : 'Clock Out'}</th>
                        </>
                      )}
                      {modalDetails.type === 'late' && (
                        <>
                          <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Shift Start</th>
                          <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Minutes Late</th>
                        </>
                      )}
                      {modalDetails.type === 'absent' && (
                        <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Shift</th>
                      )}
                      {modalDetails.type === 'onLeave' && (
                        <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Leave Type</th>
                      )}
                      {modalDetails.type === 'earlyOut' && (
                        <>
                          <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Shift End</th>
                          <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Minutes Early</th>
                        </>
                      )}
                      {modalDetails.type === 'forgotOut' && (
                        <>
                          <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Clock In</th>
                          <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Status</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {modalDetails.data.map((emp: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{emp.fullName}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{emp.employeeCode}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{emp.branch || '—'}</td>
                        
                        {modalDetails.type === 'present' && (
                          <>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                              {emp.clockInTime ? format(new Date(emp.clockInTime), 'HH:mm') : '—'}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                              {isToday ? (
                                <span className="status-badge badge-green">{emp.status || 'Working'}</span>
                              ) : (
                                emp.clockOutTime ? format(new Date(emp.clockOutTime), 'HH:mm') : '—'
                              )}
                            </td>
                          </>
                        )}

                        {modalDetails.type === 'late' && (
                          <>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                              {emp.shiftStart ? format(new Date(emp.shiftStart), 'HH:mm') : '—'}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--danger)', fontWeight: 500 }}>
                              {formatMinutes(emp.minutesLate)}
                            </td>
                          </>
                        )}

                        {modalDetails.type === 'absent' && (
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{emp.shift || '—'}</td>
                        )}

                        {modalDetails.type === 'onLeave' && (
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 10px',
                              borderRadius: 20, background: 'rgba(2,132,199,0.12)',
                              color: '#0284c7', border: '1px solid rgba(2,132,199,0.3)',
                              textTransform: 'uppercase', letterSpacing: 0.5,
                            }}>
                              {emp.leaveType ?? '—'}
                            </span>
                          </td>
                        )}

                        {modalDetails.type === 'earlyOut' && (
                          <>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                              {emp.shiftEnd ? format(new Date(emp.shiftEnd), 'HH:mm') : '—'}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--warning)', fontWeight: 500 }}>
                              {formatMinutes(emp.minutesEarly)}
                            </td>
                          </>
                        )}

                        {modalDetails.type === 'forgotOut' && (
                          <>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                              {emp.clockInTime ? format(new Date(emp.clockInTime), 'HH:mm') : '—'}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                              <span className="status-badge badge-amber">{emp.status || 'Unknown'}</span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Slide-in Platform Bulletin Announcement ── */}
      {showBulletin && activeBulletins[currentBulletinIdx] && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes slideInRight {
              from { transform: translateX(120%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}} />
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '100%',
            maxWidth: '380px',
            background: 'var(--bg-card)',
            borderLeft: `5px solid ${
              activeBulletins[currentBulletinIdx].type === 'warning' ? '#ef4444' :
              activeBulletins[currentBulletinIdx].type === 'success' ? '#22c55e' :
              activeBulletins[currentBulletinIdx].type === 'maintenance' ? '#eab308' : '#3b82f6'
            }`,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.3)',
            borderRadius: '12px',
            padding: '20px',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--border)',
            borderRight: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  color:
                    activeBulletins[currentBulletinIdx].type === 'warning' ? '#ef4444' :
                    activeBulletins[currentBulletinIdx].type === 'success' ? '#22c55e' :
                    activeBulletins[currentBulletinIdx].type === 'maintenance' ? '#eab308' : '#3b82f6',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Megaphone size={18} />
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                  Announcement
                </span>
              </div>
              <button
                onClick={() => setShowBulletin(false)}
                title="Close"
                aria-label="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                {activeBulletins[currentBulletinIdx].title}
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' }}>
                {activeBulletins[currentBulletinIdx].content}
              </p>
            </div>

            {activeBulletins.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {currentBulletinIdx + 1} of {activeBulletins.length} announcements
                </span>
                <button
                  onClick={() => setCurrentBulletinIdx(prev => (prev + 1) % activeBulletins.length)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Next Notice &rarr;
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
