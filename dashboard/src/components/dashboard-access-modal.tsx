import React, { useState, useEffect } from 'react';
import { X, Search, ShieldAlert, Lock, Unlock, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { employeesApi } from '@/lib/api';
import { initials } from '@/lib/store';

interface DashboardAccessModalProps {
  onClose: () => void;
}

export default function DashboardAccessModal({ onClose }: DashboardAccessModalProps) {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // State for the inner panels (Block / Restore)
  const [blockingEmployee, setBlockingEmployee] = useState<any | null>(null);
  const [restoringEmployee, setRestoringEmployee] = useState<any | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    if (!adminPassword) return alert('Administrator password is required.');
    
    try {
      setProcessingId(blockingEmployee.id);
      await employeesApi.setDashboardAccess(blockingEmployee.id, true, blockReason.trim() || undefined, adminPassword);
      
      // Update local state
      setStaff(prev => prev.map(s => 
        s.id === blockingEmployee.id 
          ? { ...s, user: { ...s.user, isDashboardBlocked: true, dashboardBlockReason: blockReason.trim() || null, dashboardBlockedAt: new Date().toISOString() } } 
          : s
      ));
      
      setBlockingEmployee(null);
      setBlockReason('');
      setAdminPassword('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to block access. Please check your password and try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRestoreConfirm = async () => {
    if (!restoringEmployee) return;
    if (!adminPassword) return alert('Administrator password is required.');

    try {
      setProcessingId(restoringEmployee.id);
      await employeesApi.setDashboardAccess(restoringEmployee.id, false, undefined, adminPassword);
      
      // Update local state
      setStaff(prev => prev.map(s => 
        s.id === restoringEmployee.id 
          ? { ...s, user: { ...s.user, isDashboardBlocked: false, dashboardBlockReason: null, dashboardBlockedAt: null } } 
          : s
      ));

      setRestoringEmployee(null);
      setAdminPassword('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to restore access. Please check your password and try again.');
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

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>Reason for restriction (Optional)</label>
              <div style={{ position: 'relative' }}>
                <textarea 
                  rows={3} 
                  placeholder="e.g. Temporary leave of absence, Awaiting security review..."
                  value={blockReason}
                  onChange={e => setBlockReason(e.target.value)}
                  style={{ 
                    width: '100%',
                    resize: 'none',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(var(--primary-rgb), 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border)';
                    e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)';
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'block' }}>
                This reason will be visible to the user when they attempt to log in to the dashboard.
              </span>
            </div>

            <div className="form-group" style={{ marginTop: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>
                Administrator Password <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}>
                  <Lock size={16} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password to confirm"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 40px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--danger, #ef4444)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border)';
                    e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button 
                className="btn btn-ghost" 
                style={{ flex: 1 }} 
                onClick={() => { setBlockingEmployee(null); setBlockReason(''); setAdminPassword(''); }}
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
        ) : restoringEmployee ? (
          <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
            <button 
              className="btn btn-ghost" 
              style={{ marginBottom: 16, padding: '6px 12px', fontSize: 13 }}
              onClick={() => { setRestoringEmployee(null); setAdminPassword(''); }}
            >
              &larr; Back to list
            </button>
            
            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>You are about to restore access for:</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14 }}>
                  {initials(restoringEmployee.user.fullName)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{restoringEmployee.user.fullName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{restoringEmployee.user.role === 'hr_admin' ? 'HR Admin' : 'Supervisor'} • {restoringEmployee.employeeCode}</div>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 24 }}>
              <label>Administrator Password <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
              <input 
                type="password"
                className="input" 
                placeholder="Enter your password to confirm"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button 
                className="btn btn-ghost" 
                style={{ flex: 1 }} 
                onClick={() => { setRestoringEmployee(null); setAdminPassword(''); }}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none' }}
                onClick={handleRestoreConfirm}
                disabled={processingId === restoringEmployee.id}
              >
                {processingId === restoringEmployee.id ? 'Restoring...' : 'Restore Access'}
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
                              onClick={() => setRestoringEmployee(s)}
                            >
                              <Unlock size={14} style={{ marginRight: 6 }} /> Restore Access
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
