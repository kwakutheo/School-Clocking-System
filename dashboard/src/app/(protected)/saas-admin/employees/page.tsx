'use client';
import { useEffect, useState, useRef } from 'react';
import { saasAdminApi } from '@/lib/api';
import { Search, User, Building2, UserCircle, UserX, UserCheck, ShieldAlert, X, Eye, Archive } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface EmployeeGlobal {
  id: string;
  employeeCode: string;
  position: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  photoUrl: string | null;
  hireDate: string | null;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
  } | null;
  school: {
    id: string;
    name: string;
    slug: string;
    primaryColor: string;
  } | null;
  department: string | null;
  branch: string | null;
  shift: string | null;
}

export default function GlobalEmployeeRegistryPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeGlobal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [schoolNameFilter, setSchoolNameFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // View Profile Modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeGlobal | null>(null);

  // Status Modal (Suspend / Reactivate)
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Archive Modal (requires super_admin password)
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archivePassword, setArchivePassword] = useState('');
  const [archivePasswordError, setArchivePasswordError] = useState<string | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const archivePasswordRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ isOpen: true, message, type });
  };

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchEmployees();
  }, [currentPage, itemsPerPage, debouncedSearch, schoolNameFilter]);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await saasAdminApi.getAllEmployees({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        schoolName: schoolNameFilter || undefined,
        isArchived: false, // Hide globally archived employees
      });
      setEmployees(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalItems(res.data.total || 0);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load employees.');
    } finally {
      setLoading(false);
    }
  };

  // ── Status Toggle (Suspend / Reactivate) ──
  const handleStatusUpdate = async () => {
    if (!selectedEmp) return;
    setStatusSubmitting(true);
    setStatusError(null);
    try {
      await saasAdminApi.updateGlobalEmployeeStatus(selectedEmp.id, newStatus);
      setStatusModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      console.error(err);
      setStatusError(err.response?.data?.message || 'Failed to update employee status.');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // ── Archive (Soft-Delete) with password ──
  const handleArchive = async () => {
    if (!selectedEmp || !archivePassword) return;
    setArchivePasswordError(null);
    setArchiveSubmitting(true);
    try {
      await saasAdminApi.archiveGlobalEmployee(selectedEmp.id, archivePassword);
      setArchiveModalOpen(false);
      setArchivePassword('');
      fetchEmployees();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to archive employee.';
      setArchivePasswordError(msg);
    } finally {
      setArchiveSubmitting(false);
    }
  };

  const openStatusModal = (emp: EmployeeGlobal, status: 'ACTIVE' | 'SUSPENDED') => {
    setSelectedEmp(emp);
    setNewStatus(status);
    setStatusModalOpen(true);
  };

  const openArchiveModal = (emp: EmployeeGlobal) => {
    setSelectedEmp(emp);
    setArchivePassword('');
    setArchivePasswordError(null);
    setArchiveModalOpen(true);
    setTimeout(() => archivePasswordRef.current?.focus(), 100);
  };

  const openViewModal = (emp: EmployeeGlobal) => {
    setSelectedEmp(emp);
    setViewModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>Active</span>;
      case 'SUSPENDED':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Suspended</span>;
      case 'INACTIVE':
        return <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: 'rgba(107,114,128,0.15)', color: '#9ca3af' }}>Archived</span>;
      default:
        return <span>{status}</span>;
    }
  };

  const getPaginationPages = (total: number, page: number, maxButtons = 7): (number | '...')[] => {
    if (total <= maxButtons) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    const left = Math.max(2, page - 1);
    const right = Math.min(total - 1, page + 1);
    pages.push(1);
    if (left > 2) pages.push('...');
    for (let p = left; p <= right; p++) pages.push(p);
    if (right < total - 1) pages.push('...');
    pages.push(total);
    return pages;
  };

  const paginationPages = getPaginationPages(totalPages, currentPage);

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className='page-title' style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
            <User size={28} style={{ color: 'var(--primary)' }} />
            Staff Registry
          </h1>
          <p className="page-subtitle">
            Active and suspended staff registered across all onboarded schools.
          </p>
        </div>
        <button
          id="view-archived-staff-btn"
          className="btn btn-secondary"
          onClick={() => router.push('/saas-admin/employees/archived')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', border: '1px solid var(--border)' }}
        >
          <Archive size={16} />
          View Archived Staff
        </button>
      </div>

      {error && (
        <div className="error-card card" style={{ marginBottom: '24px' }}>
          <p className="text-danger">{error}</p>
        </div>
      )}

      {/* ── Search & Filter Toolbar ── */}
      <div className="card" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-alt, rgba(255,255,255,0.02))', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '400px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by name, email, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px', height: '40px', borderRadius: '8px' }}
            />
            <span style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-secondary)' }}>
              <Search size={16} />
            </span>
          </div>

          <div style={{ position: 'relative', minWidth: '200px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Filter by School Name..."
              value={schoolNameFilter}
              onChange={(e) => { setSchoolNameFilter(e.target.value); setCurrentPage(1); }}
              style={{ paddingLeft: '40px', height: '40px', borderRadius: '8px' }}
            />
            <span style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-secondary)' }}>
              <Building2 size={16} />
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="items-per-page-select" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Show</label>
          <select
            id="items-per-page-select"
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            style={{ background: 'var(--bg-input, rgba(255,255,255,0.03))', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, outline: 'none' }}
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', minWidth: '250px' }}>Employee</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Contact</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>School</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Department</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && employees.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No employees found matching your criteria.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={emp.photoUrl || '/icons/default_profile_photo.jpg'}
                          alt="Avatar"
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{emp.user?.fullName || 'Unknown'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {emp.employeeCode} {emp.position ? `• ${emp.position}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '13px' }}>
                      <div style={{ color: 'var(--text-primary)' }}>{emp.user?.email || '—'}</div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{emp.user?.phone || '—'}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {emp.school ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: emp.school.primaryColor }} />
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{emp.school.name}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {emp.department || '—'}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {getStatusBadge(emp.status)}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => openViewModal(emp)} className="btn btn-secondary" style={{ padding: '6px', minWidth: 'unset', height: 'auto', background: 'transparent' }} title="View Profile" aria-label="View Profile">
                          <Eye size={16} color="var(--text-secondary)" />
                        </button>
                        {emp.status === 'ACTIVE' && (
                          <button onClick={() => openStatusModal(emp, 'SUSPENDED')} className="btn btn-secondary" style={{ padding: '6px', minWidth: 'unset', height: 'auto', background: 'transparent' }} title="Suspend" aria-label="Suspend">
                            <UserX size={16} color="var(--text-secondary)" />
                          </button>
                        )}
                        {emp.status === 'SUSPENDED' && (
                          <button onClick={() => openStatusModal(emp, 'ACTIVE')} className="btn btn-secondary" style={{ padding: '6px', minWidth: 'unset', height: 'auto', background: 'transparent' }} title="Reactivate" aria-label="Reactivate">
                            <UserCheck size={16} color="var(--text-secondary)" />
                          </button>
                        )}
                        <button onClick={() => openArchiveModal(emp)} className="btn btn-secondary" style={{ padding: '6px', minWidth: 'unset', height: 'auto', background: 'transparent' }} title="Archive Employee" aria-label="Archive Employee">
                          <Archive size={16} color="var(--danger)" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card-alt, rgba(255,255,255,0.01))' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Showing {employees.length} of {totalItems} employees
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{ padding: '6px 12px', border: '1px solid var(--border)', background: 'var(--bg-input)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                Prev
              </button>
              {paginationPages.map((p, i) => (
                <button
                  key={i}
                  disabled={p === '...'}
                  onClick={() => p !== '...' && setCurrentPage(p)}
                  style={{ padding: '6px 12px', border: p === currentPage ? '1px solid var(--primary)' : '1px solid var(--border)', background: p === currentPage ? 'var(--primary)' : 'var(--bg-input)', color: p === currentPage ? '#fff' : 'var(--text-secondary)', borderRadius: '6px', cursor: p === '...' ? 'default' : 'pointer', fontWeight: p === currentPage ? 700 : 500 }}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{ padding: '6px 12px', border: '1px solid var(--border)', background: 'var(--bg-input)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Global Notification Modal */}
      {notification.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ marginBottom: 20 }}>
              {notification.type === 'error' ? (
                <ShieldAlert size={48} style={{ color: 'var(--danger)', margin: '0 auto' }} />
              ) : notification.type === 'success' ? (
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </div>
              )}
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)' }}>{notification.type === 'error' ? 'Error' : notification.type === 'success' ? 'Success' : 'Notice'}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{notification.message}</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={() => setNotification({ ...notification, isOpen: false })} style={{ minWidth: 120 }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Profile Modal ── */}
      {viewModalOpen && selectedEmp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px', animation: 'fadeIn 0.2s ease-out' }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '0', position: 'relative', boxShadow: '0 32px 64px rgba(0,0,0,0.5)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>

            {/* Modal Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCircle size={18} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Employee Profile</h2>
              </div>
              <button
                onClick={() => setViewModalOpen(false)}
                title="Close"
                aria-label="Close"
                style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Avatar + Identity Hero */}
            <div style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, transparent 60%)', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--border)' }}>
              <img
                src={selectedEmp.photoUrl || '/icons/default_profile_photo.jpg'}
                alt="Avatar"
                style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedEmp.user?.fullName || 'Unknown'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', fontFamily: 'monospace', letterSpacing: '0.03em' }}>{selectedEmp.employeeCode}{selectedEmp.position ? ` · ${selectedEmp.position}` : ''}</div>
                <div style={{ marginTop: '8px' }}>{getStatusBadge(selectedEmp.status)}</div>
              </div>
            </div>

            {/* Info Grid */}
            <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', background: 'var(--bg-card)' }}>
              {[
                { label: 'Email Address', value: selectedEmp.user?.email || '—' },
                { label: 'Phone Number', value: selectedEmp.user?.phone || '—' },
                { label: 'Department', value: selectedEmp.department || '—' },
                { label: 'Branch', value: selectedEmp.branch || '—' },
                { label: 'Shift', value: selectedEmp.shift || '—' },
                {
                  label: 'Hire Date',
                  value: selectedEmp.hireDate
                    ? new Date(selectedEmp.hireDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '—'
                },
              ].map((field, i) => (
                <div key={field.label} style={{ padding: '12px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', paddingRight: i % 2 === 0 ? '20px' : '0', paddingLeft: i % 2 === 1 ? '20px' : '0', borderLeft: i % 2 === 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{field.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{field.value}</div>
                </div>
              ))}
            </div>

            {/* School row */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>School</div>
              <div style={{ flexGrow: 1 }} />
              {selectedEmp.school ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedEmp.school.primaryColor, flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEmp.school.name}</span>
                </div>
              ) : <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>—</span>}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-card)' }}>
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Modal (Suspend / Reactivate) ── */}
      {statusModalOpen && selectedEmp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, animation: 'fadeIn 0.2s ease-out' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '32px', position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={22} color="var(--warning)" />
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Confirm Action</h2>
              </div>
              <button onClick={() => { setStatusModalOpen(false); setStatusError(null); }} title="Close" aria-label="Close" style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
              Are you sure you want to {newStatus === 'SUSPENDED' ? 'suspend' : 'reactivate'}{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{selectedEmp.user?.fullName}</strong>?
              {newStatus === 'SUSPENDED' && ' They will not be able to log in until reactivated.'}
            </p>

            {statusError && (
              <p style={{ fontSize: '13px', color: 'var(--danger)', marginBottom: '16px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                {statusError}
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setStatusModalOpen(false); setStatusError(null); }} style={{ flex: 1, padding: '12px' }}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleStatusUpdate} disabled={statusSubmitting} style={{ flex: 1, padding: '12px', background: newStatus === 'SUSPENDED' ? 'var(--warning)' : 'var(--success)' }}>
                {statusSubmitting ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Archive Modal (requires Super Admin password) ── */}
      {archiveModalOpen && selectedEmp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, animation: 'fadeIn 0.2s ease-out' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '32px', position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Archive size={22} color="var(--danger)" />
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Archive Employee</h2>
              </div>
              <button onClick={() => setArchiveModalOpen(false)} title="Close" aria-label="Close" style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                You are about to archive <strong style={{ color: 'var(--text-primary)' }}>{selectedEmp.user?.fullName}</strong> from{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{selectedEmp.school?.name || 'their school'}</strong>.
                Their account will be deactivated immediately. This action requires Super Admin password confirmation.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="archive-password-input" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Your Super Admin Password
              </label>
              <input
                id="archive-password-input"
                ref={archivePasswordRef}
                type="password"
                className="form-input"
                placeholder="Enter your password to confirm"
                value={archivePassword}
                onChange={(e) => { setArchivePassword(e.target.value); setArchivePasswordError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && archivePassword) handleArchive(); }}
                style={{ width: '100%', borderColor: archivePasswordError ? 'var(--danger)' : undefined }}
              />
              {archivePasswordError && (
                <p style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '6px' }}>{archivePasswordError}</p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setArchiveModalOpen(false)} style={{ flex: 1, padding: '12px' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiveSubmitting || !archivePassword}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: !archivePassword ? 'rgba(239,68,68,0.4)' : 'var(--danger)', color: '#fff', fontWeight: 700, cursor: !archivePassword ? 'not-allowed' : 'pointer', fontSize: '14px', transition: 'all 0.2s' }}
              >
                {archiveSubmitting ? 'Archiving...' : 'Archive Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
