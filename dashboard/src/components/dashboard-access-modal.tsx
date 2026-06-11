import React, { useState, useEffect } from 'react';
import { X, Search, ShieldAlert, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { employeesApi } from '@/lib/api';
import { initials } from '@/lib/store';

interface DashboardAccessModalProps {
  onClose: () => void;
}

export default function DashboardAccessModal({ onClose }: DashboardAccessModalProps) {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // State for the inner "Block Reason" panel
  const [blockingEmployee, setBlockingEmployee] = useState<any | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      // Fetch HR Admins and Supervisors
      const res = await employeesApi.list({ roles: 'hr_admin,supervisor', limit: 500 });
      setStaff(res.data.data);
    } catch (err) {
      console.error('Failed to fetch staff', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockConfirm = async () => {
    if (!blockingEmployee) return;
    try {
      setProcessingId(blockingEmployee.id);
      await employeesApi.setDashboardAccess(blockingEmployee.id, true, blockReason.trim() || undefined);
      
      // Update local state
      setStaff(prev => prev.map(s => 
        s.id === blockingEmployee.id 
          ? { ...s, user: { ...s.user, isDashboardBlocked: true, dashboardBlockReason: blockReason.trim() || null, dashboardBlockedAt: new Date().toISOString() } } 
          : s
      ));
      
      setBlockingEmployee(null);
      setBlockReason('');
    } catch (err) {
      alert('Failed to block access. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRestore = async (employeeId: string) => {
    if (!confirm('Are you sure you want to restore dashboard access for this user?')) return;
    try {
      setProcessingId(employeeId);
      await employeesApi.setDashboardAccess(employeeId, false);
      
      // Update local state
      setStaff(prev => prev.map(s => 
        s.id === employeeId 
          ? { ...s, user: { ...s.user, isDashboardBlocked: false, dashboardBlockReason: null, dashboardBlockedAt: null } } 
          : s
      ));
    } catch (err) {
      alert('Failed to restore access. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredStaff = staff.filter(s => {
    const term = search.toLowerCase();
    return s.user.fullName.toLowerCase().includes(term) || 
           (s.user.email && s.user.email.toLowerCase().includes(term)) ||
           s.employeeCode.toLowerCase().includes(term);
  });

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: 600, width: '95%', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Dashboard Access Restrictions</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Block or restore dashboard access for HR Admins and Supervisors.</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal" title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Inner Block Reason Panel */}
        {blockingEmployee ? (
          <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
            <button 
              className="btn btn-ghost" 
              style={{ marginBottom: 16, padding: '6px 12px', fontSize: 13 }}
              onClick={() => { setBlockingEmployee(null); setBlockReason(''); }}
            >
              &larr; Back to list
            </button>
            
            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>You are about to restrict access for:</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14 }}>
                  {initials(blockingEmployee.user.fullName)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{blockingEmployee.user.fullName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{blockingEmployee.user.role === 'hr_admin' ? 'HR Admin' : 'Supervisor'} • {blockingEmployee.employeeCode}</div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Reason for restriction (Optional)</label>
              <textarea 
                className="input" 
                rows={3} 
                placeholder="e.g. Temporary leave of absence, Awaiting security review..."
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                style={{ resize: 'none' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                This reason will be visible to the user when they attempt to log in to the dashboard.
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button 
                className="btn btn-ghost" 
                style={{ flex: 1 }} 
                onClick={() => { setBlockingEmployee(null); setBlockReason(''); }}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: 'var(--danger, #ef4444)', color: '#fff', border: 'none' }}
                onClick={handleBlockConfirm}
                disabled={processingId === blockingEmployee.id}
              >
                {processingId === blockingEmployee.id ? 'Applying...' : 'Apply Restriction'}
              </button>
            </div>
          </div>
        ) : (
          /* Main List View */
          <>
            {/* Search */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <div className="search-bar" style={{ margin: 0 }}>
                <Search size={16} />
                <input 
                  type="text" 
                  placeholder="Search HR admins or supervisors by name or code..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--bg-base)' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading staff...</div>
              ) : filteredStaff.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {search ? 'No matches found.' : 'No HR Admins or Supervisors found.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredStaff.map(s => {
                    const isBlocked = s.user.isDashboardBlocked;
                    return (
                      <div 
                        key={s.id} 
                        style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                          padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', 
                          borderRadius: 12, gap: 16
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14 }}>
                            {initials(s.user.fullName)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                              {s.user.fullName}
                              <span style={{ 
                                fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                                background: 'var(--bg-input)', color: 'var(--text-secondary)',
                                border: '1px solid var(--border)'
                              }}>
                                {s.user.role === 'hr_admin' ? 'HR ADMIN' : 'SUPERVISOR'}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                              {s.employeeCode}
                            </div>
                            
                            {isBlocked && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: 'var(--danger, #ef4444)' }}>
                                <AlertTriangle size={12} />
                                <span>Restricted</span>
                                {s.user.dashboardBlockReason && (
                                  <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                                    — {s.user.dashboardBlockReason}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          {isBlocked ? (
                            <button 
                              className="btn btn-ghost" 
                              style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)', padding: '6px 12px', fontSize: 13, height: 'auto' }}
                              onClick={() => handleRestore(s.id)}
                              disabled={processingId === s.id}
                            >
                              {processingId === s.id ? 'Restoring...' : <><Unlock size={14} style={{ marginRight: 6 }} /> Restore Access</>}
                            </button>
                          ) : (
                            <button 
                              className="btn btn-ghost" 
                              style={{ color: 'var(--danger, #ef4444)', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '6px 12px', fontSize: 13, height: 'auto' }}
                              onClick={() => setBlockingEmployee(s)}
                            >
                              <Lock size={14} style={{ marginRight: 6 }} /> Block Access
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
