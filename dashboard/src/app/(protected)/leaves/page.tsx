'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/lib/store';
import { can } from '@/lib/permissions';
import { employeesApi } from '@/lib/api';
import { CheckCircle, XCircle, Clock, FileText, Plus, ChevronDown, ChevronUp, AlertTriangle, Search, Filter, ChevronLeft, ChevronRight, Calendar, Tag, AlignLeft } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const LEAVE_TYPES = ['SICK', 'ANNUAL', 'CASUAL', 'MATERNITY', 'PATERNITY', 'OTHER'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:   { bg: 'rgba(234,179,8,0.12)',  text: '#eab308' },
  APPROVED:  { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e' },
  REJECTED:  { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' },
  CANCELLED: { bg: 'rgba(100,116,139,0.12)', text: '#64748b' },
};

const TYPE_COLORS: Record<string, string> = {
  SICK: '#f97316', ANNUAL: '#3b82f6', CASUAL: '#8b5cf6',
  MATERNITY: '#ec4899', PATERNITY: '#06b6d4', OTHER: '#64748b',
};

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.04em', background: bg, color,
    }}>{label}</span>
  );
}

function LeaveCard({ leave, isAdmin, onReview, onCancel }: {
  leave: any; isAdmin: boolean;
  onReview?: (id: string, status: 'APPROVED' | 'REJECTED', note?: string) => void;
  onCancel?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const statusColor = STATUS_COLORS[leave.status] ?? STATUS_COLORS.PENDING;
  const typeColor = TYPE_COLORS[leave.leaveType] ?? '#64748b';

  const dayCount = Math.ceil(
    (new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '18px 20px', transition: 'box-shadow 0.2s',
      borderLeft: `3px solid ${typeColor}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <Badge label={leave.leaveType} color={typeColor} bg={`${typeColor}20`} />
            <Badge label={leave.status} color={statusColor.text} bg={statusColor.bg} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {dayCount} day{dayCount !== 1 ? 's' : ''}
            </span>
          </div>

          {isAdmin && (
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>
              {leave.employee?.user?.fullName ?? 'Unknown'} 
              <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                ({leave.employee?.employeeCode})
              </span>
            </div>
          )}

          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {leave.startDate} → {leave.endDate}
          </div>

          {leave.reason && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
              "{leave.reason}"
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {isAdmin && leave.status === 'PENDING' && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'var(--bg-card-hover)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              Review {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}

          {!isAdmin && leave.status === 'PENDING' && onCancel && (
            <button
              onClick={() => onCancel(leave.id)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Admin Review Panel */}
      {isAdmin && expanded && leave.status === 'PENDING' && (
        <div style={{
          marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Optional review note (reason for approval/rejection)..."
            rows={2}
            aria-label="Review note"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: 13, resize: 'vertical',
              fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { onReview?.(leave.id, 'APPROVED', reviewNote); setExpanded(false); }}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
                color: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <CheckCircle size={15} /> Approve
            </button>
            <button
              onClick={() => { onReview?.(leave.id, 'REJECTED', reviewNote); setExpanded(false); }}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <XCircle size={15} /> Reject
            </button>
          </div>

          {leave.reviewedBy && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Reviewed by {leave.reviewedBy.fullName}
              {leave.reviewNote && ` — "${leave.reviewNote}"`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeavesPage() {
  const { user } = useAuthStore();
  const isAdmin = can(user?.role, 'leaves.manage');

  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [allLeaves, setAllLeaves] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Pagination & Search State ──
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 15;

  const [form, setForm] = useState({
    leaveType: 'SICK', startDate: '', endDate: '', reason: '', employeeId: '', status: 'APPROVED'
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const fetchMyLeaves = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API}/leaves/my`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setMyLeaves(await res.json());
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchAllLeaves = useCallback(async () => {
    if (!token || !isAdmin) return;
    const url = new URL(`${API}/leaves`);
    if (filterStatus !== 'ALL') url.searchParams.append('status', filterStatus);
    if (filterYear !== 'ALL') url.searchParams.append('year', filterYear);
    if (debouncedSearchTerm) url.searchParams.append('search', debouncedSearchTerm);
    url.searchParams.append('page', currentPage.toString());
    url.searchParams.append('limit', itemsPerPage.toString());

    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const result = await res.json();
      setAllLeaves(result.data || []);
      if (result.meta) {
        setTotalPages(result.meta.totalPages);
        setTotalItems(result.meta.totalItems);
      }
    }
  }, [token, isAdmin, filterStatus, filterYear, debouncedSearchTerm, currentPage]);

  const fetchEmployees = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const res = await employeesApi.listAll();
      if (res.data) setEmployees(res.data);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  }, [token, isAdmin]);

  useEffect(() => { fetchMyLeaves(); }, [fetchMyLeaves]);
  useEffect(() => { fetchAllLeaves(); }, [fetchAllLeaves]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate) { setError('Start and end dates are required.'); return; }
    if (form.endDate < form.startDate) { setError('End date cannot be before start date.'); return; }
    setLoading(true); setError('');
    try {
      const isBehalf = isAdmin && form.employeeId !== '';
      const url = isBehalf ? `${API}/leaves/admin-request` : `${API}/leaves/request`;
      
      const payload = isBehalf 
        ? {
            employeeId: form.employeeId,
            leaveType: form.leaveType,
            startDate: form.startDate,
            endDate: form.endDate,
            reason: form.reason,
            status: form.status,
          }
        : {
            leaveType: form.leaveType,
            startDate: form.startDate,
            endDate: form.endDate,
            reason: form.reason,
          };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Failed to submit leave'); }
      setSuccess('Leave request submitted successfully!');
      setShowForm(false);
      setForm({ leaveType: 'SICK', startDate: '', endDate: '', reason: '', employeeId: '', status: 'APPROVED' });
      fetchMyLeaves();
      if (isAdmin) fetchAllLeaves();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED', reviewNote?: string) => {
    try {
      const res = await fetch(`${API}/leaves/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, reviewNote }),
      });
      if (!res.ok) throw new Error('Failed to review leave');
      setSuccess(`Leave ${status.toLowerCase()} successfully.`);
      fetchAllLeaves();
    } catch (err: any) { setError(err.message); }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`${API}/leaves/${id}/cancel`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to cancel leave');
      setSuccess('Leave request cancelled.');
      fetchMyLeaves();
    } catch (err: any) { setError(err.message); }
  };

  // ── Computed Variables ──
  const paginatedLeaves = allLeaves;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterYear, filterStatus]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={26} /> Leave Requests
          </h1>
          <p className="page-subtitle">
            {isAdmin ? 'Review and manage staff leave requests' : 'Submit and track your personal leave requests'}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); setSuccess(''); }}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, outline: 'none', border: 'none' }}
        >
          <Plus size={16} /> Request Leave
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
        }}>
          <AlertTriangle size={16} /> {error}
          <button aria-label="Dismiss error" onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}
      {success && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
        }}>
          <CheckCircle size={16} /> {success}
          <button aria-label="Dismiss success message" onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Request Leave Form */}
      {showForm && (
        <div style={{
          background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(128,128,128,0.03) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(128, 128, 128, 0.15)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
          borderRadius: 20, padding: 28, marginBottom: 32,
          position: 'relative', overflow: 'hidden'
        }}>
          {/* Subtle gradient accent line at the top */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--primary), #8b5cf6, #ec4899)' }} />
          
          <h3 style={{ margin: '0 0 24px', color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} style={{ color: 'var(--primary)' }} /> New Leave Request
          </h3>
          
          <form onSubmit={handleSubmit}>
            {isAdmin && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Search size={14} /> Apply on Behalf of Employee
                  </label>
                  <select
                    className="form-input"
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    aria-label="Target Employee"
                    style={{
                      padding: '12px 16px', borderRadius: 10, background: 'var(--bg-input)',
                      border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14,
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)', outline: 'none', cursor: 'pointer',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  >
                    <option value="">Self (Apply for Me)</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.user?.fullName} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={14} /> Submission Status
                  </label>
                  <select
                    className="form-input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    aria-label="Initial Submission Status"
                    disabled={form.employeeId === ''}
                    style={{
                      padding: '12px 16px', borderRadius: 10, background: 'var(--bg-input)',
                      border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14,
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)', outline: 'none', cursor: form.employeeId === '' ? 'not-allowed' : 'pointer',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      opacity: form.employeeId === '' ? 0.6 : 1
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  >
                    <option value="APPROVED">Approved (Log Directly)</option>
                    <option value="PENDING">Pending (Requires standard review)</option>
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 20 }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Tag size={14} /> Leave Type
                </label>
                <select
                  className="form-input"
                  value={form.leaveType}
                  onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                  aria-label="Leave type"
                  style={{
                    padding: '12px 16px', borderRadius: 10, background: 'var(--bg-input)',
                    border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14,
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)', outline: 'none', cursor: 'pointer',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                >
                  {LEAVE_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} /> Start Date
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                  aria-label="Start date"
                  style={{
                    padding: '12px 16px', borderRadius: 10, background: 'var(--bg-input)',
                    border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14,
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} /> End Date
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                  aria-label="End date"
                  style={{
                    padding: '12px 16px', borderRadius: 10, background: 'var(--bg-input)',
                    border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14,
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <AlignLeft size={14} /> Reason (optional)
              </label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={3}
                placeholder="Describe the reason for your leave (e.g. Doctor's appointment, Personal matters)..."
                aria-label="Reason"
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 10,
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 14, resize: 'vertical',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button 
                type="submit" 
                disabled={loading} 
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 10,
                  background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)', transition: 'all 0.2s ease',
                  opacity: loading ? 0.7 : 1
                }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Submitting...</> : <><CheckCircle size={18} /> Submit Request</>}
              </button>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                style={{
                  padding: '12px 24px', borderRadius: 10, background: 'var(--bg-card-hover)',
                  border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Admin Panel ─────────────────────────────────────────────────────── */}
      {isAdmin && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              All Leave Requests
            </h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: filterStatus === s ? 'var(--primary)' : 'var(--bg-card)',
                    color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                    border: filterStatus === s ? 'none' : '1px solid var(--border)',
                    transition: 'all 0.15s',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap',
            background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 12,
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-secondary)' }} />
              <input
                type="text"
                aria-label="Search leaves"
                placeholder="Search by employee name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8,
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
              <select
                className="form-input"
                aria-label="Filter by year"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                style={{
                  padding: '10px 14px', borderRadius: 8, background: 'var(--bg-input)',
                  border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13,
                  outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="ALL">All Years</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {paginatedLeaves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
              <Clock size={36} style={{ opacity: 0.3, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              No {filterStatus === 'ALL' ? '' : filterStatus.toLowerCase()} leave requests found matching your filters.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {paginatedLeaves.map(leave => (
                  <LeaveCard key={leave.id} leave={leave} isAdmin onReview={handleReview} />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      aria-label="Previous page"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{
                        padding: '6px 10px', borderRadius: 6, background: 'var(--bg-input)',
                        border: '1px solid var(--border)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                        display: 'flex', alignItems: 'center'
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', padding: '0 8px' }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      aria-label="Next page"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: '6px 10px', borderRadius: 6, background: 'var(--bg-input)',
                        border: '1px solid var(--border)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                        display: 'flex', alignItems: 'center'
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── My Leaves Panel ──────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          My Leave Requests
        </h2>
        {myLeaves.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            <FileText size={36} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
            You have no leave requests yet. Click "Request Leave" to submit one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {myLeaves.map(leave => (
              <LeaveCard key={leave.id} leave={leave} isAdmin={false} onCancel={handleCancel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
