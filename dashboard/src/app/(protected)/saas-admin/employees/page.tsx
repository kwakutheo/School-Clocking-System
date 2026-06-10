'use client';
import { useEffect, useState, useRef } from 'react';
import { saasAdminApi } from '@/lib/api';
import { Search, Building2, UserCircle, UserX, UserCheck, ShieldAlert, X, Eye, Archive } from 'lucide-react';
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
  const [schoolIdFilter, setSchoolIdFilter] = useState('');
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

  // Archive Modal (requires super_admin password)
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archivePassword, setArchivePassword] = useState('');
  const [archivePasswordError, setArchivePasswordError] = useState<string | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const archivePasswordRef = useRef<HTMLInputElement>(null);

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
  }, [currentPage, itemsPerPage, debouncedSearch, schoolIdFilter]);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await saasAdminApi.getAllEmployees({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        schoolId: schoolIdFilter || undefined,
        status: 'ACTIVE,SUSPENDED', // Main page never shows INACTIVE (archived) employees
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
    try {
      await saasAdminApi.updateGlobalEmployeeStatus(selectedEmp.id, newStatus);
      setStatusModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to update employee status.');
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Employee Registry
          </h1>
          <p className="page-sub" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
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
              placeholder="Filter by School ID (exact)"
              value={schoolIdFilter}
              onChange={(e) => { setSchoolIdFilter(e.target.value); setCurrentPage(1); }}
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
                        {emp.photoUrl ? (
                          <img src={emp.photoUrl} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserCircle size={20} color="var(--text-secondary)" />
                          </div>
                        )}
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

      {/* ── View Profile Modal ── */}
      {viewModalOpen && selectedEmp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, animation: 'fadeIn 0.2s ease-out' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '32px', position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserCircle size={22} color="var(--primary)" />
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Employee Profile</h2>
              </div>
              <button onClick={() => setViewModalOpen(false)} title="Close" aria-label="Close" style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
              {selectedEmp.photoUrl ? (
                <img src={selectedEmp.photoUrl} alt="Avatar" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCircle size={32} color="var(--text-secondary)" />
                </div>
              )}
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedEmp.user?.fullName}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>{selectedEmp.employeeCode} • {selectedEmp.position || 'No Position'}</div>
                <div style={{ marginTop: '6px' }}>{getStatusBadge(selectedEmp.status)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email Address</label>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{selectedEmp.user?.email || '—'}</div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{selectedEmp.user?.phone || '—'}</div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>School / Tenant</label>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {selectedEmp.school && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedEmp.school.primaryColor }} />}
                  {selectedEmp.school?.name || '—'}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Hire Date</label>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{selectedEmp.hireDate ? new Date(selectedEmp.hireDate).toLocaleDateString() : '—'}</div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Department</label>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{selectedEmp.department || '—'}</div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Branch</label>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{selectedEmp.branch || '—'}</div>
              </div>
            </div>
            
            <button type="button" className="btn btn-secondary" onClick={() => setViewModalOpen(false)} style={{ width: '100%', padding: '12px' }}>
              Close
            </button>
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
              <button onClick={() => setStatusModalOpen(false)} title="Close" aria-label="Close" style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
              Are you sure you want to {newStatus === 'SUSPENDED' ? 'suspend' : 'reactivate'}{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{selectedEmp.user?.fullName}</strong>?
              {newStatus === 'SUSPENDED' && ' They will not be able to log in until reactivated.'}
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStatusModalOpen(false)} style={{ flex: 1, padding: '12px' }}>
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
