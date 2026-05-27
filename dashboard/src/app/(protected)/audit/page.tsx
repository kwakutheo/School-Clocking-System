'use client';
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { auditApi } from '@/lib/api';
import { format } from 'date-fns';
import { 
  ShieldCheck, ShieldAlert, Search, Filter, 
  Users, Building, Clock, MapPin, Settings, Key, 
  FileJson, ArrowRight, LayoutDashboard, CalendarDays
} from 'lucide-react';
import { can } from '@/lib/permissions';
import { useAuthStore } from '@/lib/store';

const fetcher = () => auditApi.list().then((r) => r.data);

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useSWR(can(user?.role, 'audit.view') ? 'audit-logs' : null, fetcher);
  const logs: any[] = data ?? [];

  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [showRawJson, setShowRawJson] = useState<Record<string, boolean>>({});

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter(log => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (log.user?.fullName || '').toLowerCase().includes(searchLower) ||
        (log.action || '').toLowerCase().includes(searchLower);
      
      const matchesModule = moduleFilter === 'ALL' || log.module === moduleFilter;

      return matchesSearch && matchesModule;
    });
  }, [logs, searchTerm, moduleFilter]);

  const uniqueModules = useMemo(() => {
    const modules = new Set<string>();
    logs.forEach(log => {
      if (log.module) modules.add(log.module);
    });
    return Array.from(modules).sort();
  }, [logs]);

  if (!can(user?.role, 'audit.view')) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ color: 'var(--danger)' }}><ShieldAlert size={48} /></div>
        <p className="empty-state-text">Access Denied. You do not have permission to view Audit Logs.</p>
      </div>
    );
  }

  const formatJson = (val: any) => {
    if (!val) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    return (
      <pre style={{ 
        fontSize: 12, 
        margin: 0, 
        padding: '16px', 
        background: 'rgba(0,0,0,0.2)', 
        color: 'var(--text-primary)',
        lineHeight: '1.6',
        borderRadius: '8px', 
        border: '1px solid var(--border)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all'
      }}>
        {JSON.stringify(val, null, 2)}
      </pre>
    );
  };

  const renderDiff = (oldVals: any, newVals: any) => {
    const o = typeof oldVals === 'object' && oldVals !== null ? oldVals : {};
    const n = typeof newVals === 'object' && newVals !== null ? newVals : {};
    const allKeys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]));
    
    if (allKeys.length === 0) {
      return <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No structured changes to display.</span>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {allKeys.map(key => {
          const oldVal = o[key];
          const newVal = n[key];
          
          if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;

          return (
            <div key={key} style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '16px', 
              fontSize: '13px',
              background: 'rgba(255,255,255,0.02)',
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)'
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', minWidth: '140px', paddingTop: '2px' }}>{key}</span>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, flexWrap: 'wrap' }}>
                {oldVal !== undefined && (
                  <span style={{ 
                    color: 'var(--danger)', 
                    textDecoration: 'line-through', 
                    opacity: 0.9, 
                    background: 'var(--danger-dim)', 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    wordBreak: 'break-all'
                  }}>
                    {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)}
                  </span>
                )}
                
                {oldVal !== undefined && newVal !== undefined && (
                  <div style={{ paddingTop: '2px' }}>
                    <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                  </div>
                )}

                {newVal !== undefined && (
                  <span style={{ 
                    color: 'var(--success)', 
                    fontWeight: 600, 
                    background: 'var(--success-dim)', 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    wordBreak: 'break-all'
                  }}>
                    {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getActionColor = (action: string) => {
    if (action.includes('UPDATE') || action.includes('RESET')) return '#0ea5e9';
    if (action.includes('MANUAL')) return '#f59e0b';
    if (action.includes('CREATE') || action.includes('ADD')) return '#10b981';
    if (action.includes('DELETE') || action.includes('REMOVE')) return '#ef4444';
    return '#8b5cf6';
  };

  const getModuleIcon = (module: string) => {
    switch (module.toUpperCase()) {
      case 'EMPLOYEES': return <Users size={14} />;
      case 'BRANCHES': return <Building size={14} />;
      case 'DEPARTMENTS': return <LayoutDashboard size={14} />;
      case 'SHIFTS': return <Clock size={14} />;
      case 'LOCATIONS': return <MapPin size={14} />;
      case 'PERMISSIONS': return <Key size={14} />;
      case 'CALENDAR': return <CalendarDays size={14} />;
      default: return <Settings size={14} />;
    }
  };

  const toggleRawJson = (id: string) => {
    setShowRawJson(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <h1 className="page-title text-gradient">System Audit Logs</h1>
          <p className="page-subtitle">Compliance tracking of all administrative changes</p>
        </div>
      </div>

      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-container" style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search by admin name or action..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 42, height: '44px', fontSize: '14px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ paddingLeft: '12px', color: 'var(--text-muted)' }}>
              <Filter size={18} />
            </div>
            <select 
              aria-label="Filter logs by module"
              title="Filter logs by module"
              className="form-input" 
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              style={{ minWidth: '180px', border: 'none', background: 'transparent', height: '34px', boxShadow: 'none' }}
            >
              <option value="ALL">All Modules</option>
              {uniqueModules.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="table-wrap" style={{ border: 'none', background: 'transparent' }}>
        {isLoading ? (
          <div className="loading-center" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', minHeight: 400 }}>
            <div className="spinner" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', minHeight: 400 }}>
            <div className="empty-state-icon"><ShieldCheck size={48} /></div>
            <p className="empty-state-text">No audit logs match your criteria.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {filteredLogs.map((log: any) => {
              const actionColor = getActionColor(log.action);
              const isRawOpen = showRawJson[log.id];

              return (
                <div key={log.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                  {/* Card Header */}
                  <div style={{ 
                    padding: '20px 24px', 
                    borderBottom: '1px solid var(--border)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '20px',
                    background: 'rgba(255,255,255,0.015)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
                      {/* User Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div className="avatar" style={{ 
                          width: 42, 
                          height: 42, 
                          fontSize: 14,
                          background: `linear-gradient(135deg, ${actionColor}, ${actionColor}90)`,
                          boxShadow: `0 4px 12px ${actionColor}30`
                        }}>
                          {(log.user?.fullName ?? '?').split(' ').map((w: any) => w[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {log.user?.fullName}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {format(new Date(log.createdAt), 'MMM dd, yyyy • HH:mm')}
                          </div>
                        </div>
                      </div>

                      <div style={{ width: '1px', height: '40px', background: 'var(--border)' }}></div>

                      {/* Action & Module */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <span style={{ 
                          fontSize: 12, 
                          fontWeight: 800, 
                          padding: '6px 14px', 
                          borderRadius: '8px', 
                          background: `${actionColor}15`, 
                          color: actionColor,
                          border: `1px solid ${actionColor}30`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          letterSpacing: '0.5px'
                        }}>
                          {log.action}
                        </span>
                        
                        <span style={{ 
                          fontSize: 13, 
                          fontWeight: 600, 
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: 'var(--bg-surface)',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)'
                        }}>
                          {getModuleIcon(log.module)}
                          {log.module}
                        </span>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button 
                      onClick={() => toggleRawJson(log.id)}
                      className="btn btn-secondary"
                      style={{ fontSize: 13, padding: '8px 16px', borderRadius: '8px' }}
                    >
                      <FileJson size={16} />
                      {isRawOpen ? 'View Structured' : 'View Raw JSON'}
                    </button>
                  </div>

                  {/* Card Body - Changes */}
                  <div style={{ padding: '24px' }}>
                    <div style={{ 
                      fontSize: 12, 
                      fontWeight: 700, 
                      color: 'var(--text-secondary)', 
                      marginBottom: '16px', 
                      textTransform: 'uppercase', 
                      letterSpacing: '1px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{ width: '4px', height: '12px', background: 'var(--primary)', borderRadius: '2px' }}></div>
                      Changes Recorded
                    </div>
                    
                    {isRawOpen ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.5px' }}>OLD VALUES</div>
                          {formatJson(log.oldValues)}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.5px' }}>NEW VALUES</div>
                          {formatJson(log.newValues)}
                        </div>
                      </div>
                    ) : (
                      renderDiff(log.oldValues, log.newValues)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
