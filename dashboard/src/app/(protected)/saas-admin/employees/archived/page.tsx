'use client';
import { useEffect, useState } from 'react';
import { saasAdminApi } from '@/lib/api';
import { Search, Building2, UserCircle, UserCheck, ArrowLeft, Archive, X } from 'lucide-react';
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

export default function ArchivedEmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeGlobal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Reactivate Confirmation Modal
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeGlobal | null>(null);
  const [reactivateSubmitting, setReactivateSubmitting] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchArchivedEmployees();
  }, [currentPage, itemsPerPage, debouncedSearch]);

  const fetchArchivedEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await saasAdminApi.getAllEmployees({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        status: 'INACTIVE', // Only fetch archived employees
      });
      setEmployees(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalItems(res.data.total || 0);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load archived employees.');
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!selectedEmp) return;
    setReactivateSubmitting(true);
    try {
      await saasAdminApi.updateGlobalEmployeeStatus(selectedEmp.id, 'ACTIVE');
      setReactivateModalOpen(false);
      fetchArchivedEmployees();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to reactivate employee.');
    } finally {
      setReactivateSubmitting(false);
    }
  };

  const openReactivateModal = (emp: EmployeeGlobal) => {
    setSelectedEmp(emp);
    setReactivateModalOpen(true);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            id="back-to-registry-btn"
            onClick={() => router.push('/saas-admin/employees')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}
          >
            <ArrowLeft size={15} />
            Back to Registry
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Archive size={22} color="var(--text-secondary)" />
              <h1 className="page-title" style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                Archived Staff
              </h1>
            </div>
            <p className="page-sub" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              Employees who have been deactivated. You can reactivate them from here.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-card card" style={{ marginBottom: '24px' }}>
          <p className="text-danger">{error}</p>
        </div>
      )}

      {/* ── Summary Banner ── */}
      <div className="card" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(107,114,128,0.06)', border: '1px solid var(--border)' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(107,114,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Archive size={18} color="#9ca3af" />
        </div>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{totalItems}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Total Archived Employees</div>
        </div>
      </div>

      {/* ── Search Toolbar ── */}
      <div className="card" style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card-alt, rgba(255,255,255,0.02))', border: '1px solid var(--border)' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="archived-items-per-page" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Show</label>
          <select
            id="archived-items-per-page"
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
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Date Archived</th>
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
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <Archive size={40} color="var(--text-secondary)" style={{ opacity: 0.4 }} />
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>No archived employees found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {emp.photoUrl ? (
                          <img src={emp.photoUrl} alt="Avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', opacity: 0.7, filter: 'grayscale(30%)' }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}>
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
                    <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <button
                        onClick={() => openReactivateModal(emp)}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', cursor: 'pointer', transition: 'all 0.2s' }}
                        title="Reactivate Employee"
                        aria-label="Reactivate Employee"
                      >
                        <UserCheck size={14} />
                        Reactivate
                      </button>
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
              Showing {employees.length} of {totalItems} archived employees
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

      {/* ── Reactivate Confirmation Modal ── */}
      {reactivateModalOpen && selectedEmp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, animation: 'fadeIn 0.2s ease-out' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '32px', position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserCheck size={22} color="#22c55e" />
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Reactivate Employee</h2>
              </div>
              <button onClick={() => setReactivateModalOpen(false)} title="Close" aria-label="Close" style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
              Are you sure you want to reactivate{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{selectedEmp.user?.fullName}</strong>? 
              Their account and login access will be restored immediately.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setReactivateModalOpen(false)} style={{ flex: 1, padding: '12px' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReactivate}
                disabled={reactivateSubmitting}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }}
              >
                {reactivateSubmitting ? 'Reactivating...' : 'Yes, Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
