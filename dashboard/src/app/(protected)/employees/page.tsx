'use client';
import useSWR from 'swr';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { employeesApi, branchesApi, departmentsApi, shiftsApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { can } from '@/lib/permissions';
import { useGhanaTime } from '@/lib/useServerTimeOffset';
import { Eye, EyeOff, Users, ShieldAlert } from 'lucide-react';

const LIMIT = 50;

const roleBadge: Record<string, string> = {
  employee: 'badge-blue', supervisor: 'badge-amber',
  hr_admin: 'badge-orange', super_admin: 'badge-red',
};
const roleLabel: Record<string, string> = {
  employee: 'Employee', supervisor: 'Supervisor',
  hr_admin: 'HR Admin', super_admin: 'Super Admin',
};
const statusBadge: Record<string, string> = {
  active: 'badge-green', inactive: 'badge-red', suspended: 'badge-amber',
};

/** Capitalises the first letter of every word in a string. */
const toTitleCase = (val: string) =>
  val.replace(/\b\w/g, (c) => c.toUpperCase());

export default function EmployeesPage() {
  const { user, setAuth } = useAuthStore();
  const getGhanaTime = useGhanaTime();

  // ── Pagination & filter state ──────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<'all' | 'active' | 'inactive' | 'suspended'>('active');
  const [activeBranch, setActiveBranch] = useState<string>('all');
  const [activeRoleView, setActiveRoleView] = useState<'all' | 'staff' | 'admin'>('all');
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });

  // ── Modal state ────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [showSetupWarning, setShowSetupWarning] = useState<{ missingBranch: boolean; missingShift: boolean } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteInputName, setDeleteInputName] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState<string | null>(null);
  const [adminPasswordValue, setAdminPasswordValue] = useState('');
  const [notification, setNotification] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ isOpen: true, message, type });
  };
  const [form, setForm] = useState({
    firstName: '', lastName: '', username: '', email: '', password: '',
    departmentId: '', branchId: '', shiftId: '', position: '',
    phone: '', hireDate: '', role: 'employee', status: 'active',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

  // ── Debounce search ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [activeStatus, activeBranch, activeRoleView]);

  useEffect(() => {
    if (editingId) return; // Only check on create
    const username = form.username?.trim();
    if (!username) {
      setUsernameStatus('idle');
      setUsernameSuggestions([]);
      return;
    }

    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      try {
        const fullName = `${form.firstName} ${form.lastName}`.trim();
        const res = await usersApi.checkUsername(username, fullName);
        if (res.data.available) {
          setUsernameStatus('available');
          setUsernameSuggestions([]);
        } else {
          setUsernameStatus('taken');
          setUsernameSuggestions(res.data.suggestions || []);
        }
      } catch (e) {
        setUsernameStatus('idle');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.username, form.firstName, form.lastName, editingId]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const listKey = ['employees-paginated', page, LIMIT, debouncedSearch, activeStatus, activeBranch];
  const { data: listData, isLoading, mutate } = useSWR(listKey, () =>
    employeesApi.list({
      page, limit: LIMIT,
      search: debouncedSearch || undefined,
      status: activeStatus !== 'all' ? activeStatus : undefined,
      branchId: activeBranch !== 'all' ? activeBranch : undefined,
    }).then(r => r.data),
  );

  const { data: branchesData } = useSWR('branches-list', () => branchesApi.list().then(r => r.data));
  const { data: departmentsData } = useSWR('departments-list', () => departmentsApi.list().then(r => r.data));
  const { data: shiftsData } = useSWR('shifts-list', () => shiftsApi.list().then(r => r.data));

  const pageEmployees: any[] = listData?.data ?? [];
  const total = listData?.total ?? 0;
  const counts = listData?.counts ?? { all: 0, active: 0, inactive: 0, suspended: 0 };
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const branches: any[] = branchesData ?? [];
  const departments: any[] = departmentsData ?? [];
  const shifts: any[] = shiftsData ?? [];

  // Client-side role view filter (on current page)
  const filtered = useMemo(() => pageEmployees.filter(e => {
    const role = e.user?.role ?? 'employee';
    if (activeRoleView === 'staff' && (role === 'hr_admin' || role === 'super_admin')) return false;
    if (activeRoleView === 'admin' && (role === 'employee' || role === 'supervisor')) return false;
    return true;
  }), [pageEmployees, activeRoleView]);

  const groupedEmployees = filtered.reduce((acc: Record<string, any[]>, emp) => {
    const deptName = emp.department?.name || 'Unassigned Department';
    if (!acc[deptName]) acc[deptName] = [];
    acc[deptName].push(emp);
    return acc;
  }, {});

  const toggleDept = (deptName: string) => setExpandedDepts(prev => ({
    ...prev, [deptName]: prev[deptName] === undefined ? false : !prev[deptName],
  }));

  // ── Form helpers ───────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setForm({ firstName: '', lastName: '', username: '', email: '', password: '', departmentId: '',
      branchId: '', shiftId: '', position: '', phone: '',
      hireDate: format(getGhanaTime(), 'yyyy-MM-dd'), role: 'employee', status: 'active' });
    setEditingId(null); setError('');
    setUsernameStatus('idle'); setUsernameSuggestions([]);
    setConfirmPassword(''); setShowPassword(false); setShowConfirmPassword(false);
  }, []);

  const openCreate = useCallback(() => {
    const missingBranch = branches.length === 0;
    const missingShift = shifts.length === 0;
    if (missingBranch || missingShift) {
      setShowSetupWarning({ missingBranch, missingShift });
      return;
    }
    resetForm();
    setShowModal(true);
  }, [resetForm, branches, shifts]);

  const openEdit = useCallback((emp: any) => {
    const nameParts = (emp.user?.fullName ?? '').split(' ');
    setForm({
      firstName: nameParts[0] ?? '', lastName: nameParts.slice(1).join(' ') ?? '',
      username: emp.user?.username ?? '', email: emp.user?.email ?? '', password: '',
      departmentId: emp.department?.id ?? '', branchId: emp.branch?.id ?? '',
      shiftId: emp.shift?.id ?? '', position: emp.position ?? '',
      phone: emp.user?.phone ?? '', hireDate: emp.hireDate ? emp.hireDate.slice(0, 10) : '',
      role: emp.user?.role ?? 'employee', status: emp.status ?? 'active',
    });
    setEditingId(emp.id); setShowModal(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); setError('');
    const fullName = `${form.firstName} ${form.lastName}`.trim();
    try {
      const { offlineApi } = await import('@/lib/offline-api');
      if (editingId) {
        const res = await offlineApi.updateEmployee(editingId, {
          fullName, email: form.email || undefined, departmentId: form.departmentId || undefined,
          branchId: form.branchId || undefined, shiftId: form.shiftId || undefined,
          position: form.position || undefined, phone: form.phone || undefined,
          hireDate: form.hireDate || undefined, role: form.role, status: form.status,
        });
        if (user && (res as any).data?.user?.id === user.id) {
          const token = localStorage.getItem('access_token') || '';
          setAuth((res as any).data.user, token);
        }
      } else {
        if (usernameStatus === 'taken') {
          setError('Please choose an available username.');
          setIsSubmitting(false);
          return;
        }
        if (form.password !== confirmPassword) {
          setError('Passwords do not match.');
          setIsSubmitting(false);
          return;
        }
        await offlineApi.registerEmployee({
          fullName, username: form.username, email: form.email || undefined, password: form.password,
          departmentId: form.departmentId || undefined, branchId: form.branchId || undefined,
          shiftId: form.shiftId || undefined, position: form.position || undefined,
          phone: form.phone || undefined, hireDate: form.hireDate || undefined, role: form.role,
        });
      }
      await mutate(); setShowModal(false); resetForm();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Something went wrong.');
    } finally { setIsSubmitting(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordConfirm || !adminPasswordValue) return;
    setIsSubmitting(true);
    try {
      const response = await employeesApi.resetPassword(resetPasswordConfirm, adminPasswordValue);
      showAlert(`Account Unlocked!\n\nPlease give this temporary PIN to the employee: ${response.data.pin}\n\nThey must enter this PIN in the mobile app to create a new password.`, 'success');
      setResetPasswordConfirm(null); setAdminPasswordValue('');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      showAlert(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Failed to request password reset.', 'error');
    } finally { setIsSubmitting(false); }
  };

  const handleStatusToggle = async (id: string, newStatus: string) => {
    try { await employeesApi.update(id, { status: newStatus }); await mutate(); }
    catch (err: any) {
      const msg = err.response?.data?.message;
      showAlert(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Failed to update status.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try { await employeesApi.delete(id); await mutate(); setDeleteConfirm(null); }
    catch (err: any) {
      const msg = err.response?.data?.message;
      showAlert(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Failed to delete employee.', 'error');
    }
  };

  const userRole = useMemo(() =>
    typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') ?? '{}')?.role as string : ''
  , []);

  // Determine if current user belongs to a tenant (school admin)
  const isTenantUser = !!user?.tenantId;

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));
  const startItem = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const endItem = Math.min(page * LIMIT, total);

  // employees array needed for delete confirm modal lookup
  const employees: any[] = pageEmployees;

  return (
    <>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
            <Users size={28} style={{ color: 'var(--primary)' }} />
            Staff Registry
          </h1>
          <p className="page-subtitle">
            Manage your workforce — {total} total{debouncedSearch ? ` · searching "${debouncedSearch}"` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', background: 'var(--bg-secondary)', padding: 4, borderRadius: 8, gap: 4, border: '1px solid var(--border)' }}>
          {(['all', 'staff', 'admin'] as const).map(rv => (
            <button key={rv} className={`btn btn-sm ${activeRoleView === rv ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveRoleView(rv)}
              style={{ border: 'none', boxShadow: activeRoleView === rv ? '0 2px 4px rgba(0,0,0,0.2)' : 'none' }}>
              {rv === 'all' ? 'All Staff' : rv === 'staff' ? 'Regular Employees' : 'HR & Admins'}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        {/* Status tabs with server counts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          {([
            { key: 'all', label: 'All', count: counts.all },
            { key: 'active', label: 'Active', count: counts.active },
            { key: 'suspended', label: 'Suspended', count: counts.suspended },
            { key: 'inactive', label: 'Inactive', count: counts.inactive },
          ] as const).map(({ key, label, count }) => (
            <button key={key} className={`btn btn-sm ${activeStatus === key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveStatus(key); setPage(1); }}
              style={{ borderRadius: 20, whiteSpace: 'nowrap' }}>
              {label} ({count})
            </button>
          ))}
        </div>

        {/* Branch filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 8 }}>
          <button className={`btn btn-sm ${activeBranch === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setActiveBranch('all'); setPage(1); }}
            style={{ borderRadius: 20, whiteSpace: 'nowrap' }}>All Branches</button>
          {branches.map((b: any) => (
            <button key={b.id} className={`btn btn-sm ${activeBranch === b.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveBranch(b.id); setPage(1); }}
              style={{ borderRadius: 20, whiteSpace: 'nowrap' }}>{b.name}</button>
          ))}
        </div>

        {/* Search + Register */}
        <div className="table-header">
          <span className="table-title">Employees List</span>
          <div className="table-controls">
            <input className="form-input" placeholder="Search by name, code or department…"
              value={searchInput} onChange={e => setSearchInput(e.target.value)} style={{ width: 280 }} />
            {can(userRole, 'employees.create') && (
              <button className="btn btn-primary" onClick={openCreate}>+ Register Employee</button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <p className="empty-state-text">{searchInput ? 'No employees match your search.' : 'No employees found.'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th>Employee</th><th>Username</th><th>Code</th><th>Department</th>
                  <th>Branch</th><th>Position</th><th>Role</th><th>Status</th>
                  <th>Hired</th><th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              {Object.keys(groupedEmployees).sort().map(deptName => {
                const isExpanded = expandedDepts[deptName] !== false;
                const deptEmployees = groupedEmployees[deptName];
                return (
                  <tbody key={deptName}>
                    <tr onClick={() => toggleDept(deptName)}
                      style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.02)', borderTop: '2px solid var(--border)', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}>
                      <td colSpan={10} style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, opacity: 0.5, display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>▶</span>
                          <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{deptName}</span>
                          <span className="badge badge-gray" style={{ fontSize: 11 }}>{deptEmployees.length}</span>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && deptEmployees.map((emp: any, index: number) => {
                      const isInactive = emp.status === 'inactive' || emp.status === 'suspended';
                      return (
                        <tr key={emp.id} className="emp-row-animate"
                          style={{ background: 'transparent', opacity: isInactive ? 0.6 : 1, transition: 'opacity 0.2s', animationDelay: `${index * 0.05}s` }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="avatar">
                                {emp.photoUrl ? (
                                  <img src={emp.photoUrl} alt={emp.user?.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  (emp.user?.fullName ?? '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600 }}>{emp.user?.fullName}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  {emp.user?.email} {emp.user?.email && emp.user?.phone ? '•' : ''} {emp.user?.phone}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{emp.user?.username ?? '—'}</td>
                          <td style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{emp.employeeCode}</td>
                          <td style={{ fontSize: 13 }}>{emp.department?.name ?? '—'}</td>
                          <td style={{ fontSize: 13 }}>{emp.branch?.name ?? '—'}</td>
                          <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{emp.position ?? '—'}</td>
                          <td><span className={`badge ${roleBadge[emp.user?.role] ?? 'badge-blue'}`}>{roleLabel[emp.user?.role] ?? emp.user?.role}</span></td>
                          <td>
                            {can(userRole, 'employees.toggle_status') ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 36, height: 20, background: emp.status === 'active' ? 'var(--success)' : 'var(--border)', borderRadius: 10, position: 'relative', opacity: 0.9 }}>
                                  <div style={{ width: 16, height: 16, background: 'white', borderRadius: '50%', position: 'absolute', top: 2, left: emp.status === 'active' ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                </div>
                                <span style={{ fontSize: 12, color: emp.status === 'active' ? 'var(--success)' : 'var(--text-secondary)' }}>
                                  {emp.status.charAt(0).toUpperCase() + emp.status.slice(1)}
                                </span>
                              </div>
                            ) : (
                              <span className={`badge ${statusBadge[emp.status] ?? 'badge-blue'}`}>{emp.status}</span>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {emp.hireDate ? format(new Date(emp.hireDate), 'MMM d, yyyy') : '—'}
                          </td>
                          <td>
                            <button className="btn btn-sm btn-ghost"
                              style={{ padding: 0, fontSize: 18, borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid transparent' }}
                              onClick={e => {
                                e.stopPropagation();
                                if (openActionMenu === emp.id) { setOpenActionMenu(null); return; }
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                const menuHeight = 140;
                                const spaceBelow = window.innerHeight - rect.bottom;
                                if (spaceBelow < menuHeight) {
                                  setMenuPosition({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
                                } else {
                                  setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                }
                                setOpenActionMenu(emp.id);
                              }}
                              title="More Actions">⋮</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {total > LIMIT && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, padding: '14px 4px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Showing <strong>{startItem}–{endItem}</strong> of <strong>{total}</strong> employees
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => goToPage(1)} disabled={page === 1} style={{ borderRadius: 6 }} title="First">«</button>
              <button className="btn btn-sm btn-ghost" onClick={() => goToPage(page - 1)} disabled={page === 1} style={{ borderRadius: 6 }}>‹ Prev</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => goToPage(p)} style={{ borderRadius: 6, minWidth: 36 }}>{p}</button>
                );
              })}
              <button className="btn btn-sm btn-ghost" onClick={() => goToPage(page + 1)} disabled={page === totalPages} style={{ borderRadius: 6 }}>Next ›</button>
              <button className="btn btn-sm btn-ghost" onClick={() => goToPage(totalPages)} disabled={page === totalPages} style={{ borderRadius: 6 }} title="Last">»</button>
            </div>
          </div>
        )}
      </div>

      {/* Fixed-position action menu — rendered outside table to avoid z-index clipping */}
      {openActionMenu && (() => {
        const emp = pageEmployees.find(e => e.id === openActionMenu);
        if (!emp) return null;
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={() => setOpenActionMenu(null)} />
            <div style={{ position: 'fixed', top: menuPosition.top, bottom: menuPosition.bottom, right: menuPosition.right, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 901, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)', minWidth: 175 }} onClick={e => e.stopPropagation()}>
              {can(userRole, 'employees.edit') && (
                <button className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start', width: '100%', padding: '8px 12px', fontSize: 13, border: 'none', background: 'transparent' }} onClick={() => { setOpenActionMenu(null); openEdit(emp); }}>
                  <span style={{ marginRight: 10 }}>✏️</span> Edit Profile
                </button>
              )}
              {can(userRole, 'employees.reset_password') && (
                <button className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start', width: '100%', padding: '8px 12px', fontSize: 13, color: 'var(--amber-600)', border: 'none', background: 'transparent' }} onClick={() => { setOpenActionMenu(null); setResetPasswordConfirm(emp.id); setAdminPasswordValue(''); }}>
                  <span style={{ marginRight: 10 }}>🔑</span> Reset Password
                </button>
              )}
            </div>
          </>
        );
      })()}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Employee' : 'Register New Employee'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close Modal">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="firstName">First Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    id="firstName"
                    className="form-input"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: toTitleCase(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    id="lastName"
                    className="form-input"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: toTitleCase(e.target.value) })}
                    required
                  />
                </div>
                {!editingId && (
                  <div className="form-group">
                    <label htmlFor="username">Username <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      id="username"
                      className="form-input"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      required
                      style={{ 
                        borderColor: usernameStatus === 'taken' ? 'var(--danger)' : usernameStatus === 'available' ? 'var(--success)' : undefined
                      }}
                    />
                    {usernameStatus === 'checking' && <small style={{ color: 'var(--text-secondary)' }}>Checking availability...</small>}
                    {usernameStatus === 'available' && <small style={{ color: 'var(--success)' }}>✓ Username is available</small>}
                    {usernameStatus === 'taken' && (
                      <div style={{ marginTop: 4 }}>
                        <small style={{ color: 'var(--danger)' }}>✗ Username already taken</small>
                        {usernameSuggestions.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <small style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Suggestions:</small>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {usernameSuggestions.map(sug => (
                                <button 
                                  key={sug} 
                                  type="button" 
                                  onClick={() => setForm({ ...form, username: sug })}
                                  className="badge badge-blue" 
                                  style={{ border: 'none', cursor: 'pointer', padding: '4px 10px', fontSize: 13 }}
                                >
                                  {sug}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group" style={{ gridColumn: editingId ? '1 / -1' : undefined }}>
                  <label htmlFor="role">Role</label>
                  <select
                    id="role"
                    className="form-input"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="employee">Employee</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="hr_admin">HR Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                {!editingId && (
                  <>
                    <div className="form-group">
                      <label htmlFor="password">Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="password"
                          className="form-input"
                          type={showPassword ? "text" : "password"}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          required
                          minLength={6}
                          style={{ paddingRight: '44px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer'
                          }}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="confirmPassword">Confirm Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="confirmPassword"
                          className="form-input"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={6}
                          style={{ paddingRight: '44px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{
                            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer'
                          }}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="email">
                    Email Address
                    {['super_admin', 'hr_admin', 'supervisor'].includes(form.role) && (
                      <span style={{ color: 'var(--danger)' }}> *</span>
                    )}
                  </label>
                  <input
                    id="email"
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="john.doe@example.com"
                    required={['super_admin', 'hr_admin', 'supervisor'].includes(form.role)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="departmentId">Department</label>
                  <select
                    id="departmentId"
                    className="form-input"
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  >
                    <option value="">— Select —</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="branchId">Branch <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select
                    id="branchId"
                    className="form-input"
                    value={form.branchId}
                    onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                    required
                  >
                    <option value="">— Select —</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="shiftId">Assigned Shift <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select
                    id="shiftId"
                    className="form-input"
                    value={form.shiftId}
                    onChange={(e) => setForm({ ...form, shiftId: e.target.value })}
                    required
                  >
                    <option value="">— Select Shift —</option>
                    {shifts.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="position">Position</label>
                  <input
                    id="position"
                    className="form-input"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: toTitleCase(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="hireDate">Date Registered</label>
                  <input
                    id="hireDate"
                    className="form-input"
                    type="date"
                    value={form.hireDate}
                    max={format(getGhanaTime(), 'yyyy-MM-dd')}
                    onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                    disabled={isTenantUser}
                    title={isTenantUser ? 'Hire date cannot be modified by school admins' : undefined}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    className="form-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+233..."
                  />
                </div>


                {editingId && can(userRole, 'employees.toggle_status') && (
                  <div className="form-group">
                    <label htmlFor="status">Status</label>
                    <select
                      id="status"
                      className="form-input"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : editingId ? 'Save Changes' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (() => {
        const empToDelete = employees.find(e => e.id === deleteConfirm);
        if (!empToDelete) return null;
        
        return (
          <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="modal-content" style={{ maxWidth: 450 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Delete Employee</h3>
                <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
              </div>
              <div style={{ padding: '0 4px' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Are you sure you want to delete <strong>{empToDelete.user?.fullName}</strong>? This action cannot be undone and will permanently remove all their historical data.
                </p>
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label>Please type <strong>{empToDelete.user?.fullName}</strong> to confirm.</label>
                  <input
                    type="text"
                    className="form-input"
                    value={deleteInputName}
                    onChange={(e) => setDeleteInputName(e.target.value)}
                    placeholder={empToDelete.user?.fullName}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleteInputName !== empToDelete.user?.fullName}
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Setup Required Warning Modal */}
      {showSetupWarning && (
        <div className="modal-overlay" onClick={() => setShowSetupWarning(null)}>
          <div className="modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>⚠️</span> Setup Required
              </h3>
              <button className="modal-close" onClick={() => setShowSetupWarning(null)} aria-label="Close">✕</button>
            </div>
            <div style={{ padding: '8px 4px 20px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                Before registering an employee, your school must have at least one
                {showSetupWarning.missingBranch && showSetupWarning.missingShift
                  ? ' branch (geofenced location) and one shift (working hours)'
                  : showSetupWarning.missingBranch
                  ? ' branch (geofenced location)'
                  : ' shift (working hours)'}{' '}
                configured in the system.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {showSetupWarning.missingBranch && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 10,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  }}>
                    <span style={{ fontSize: 24 }}>🏢</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>No Branches (geofenced locations) Found</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Create at least one branch/location for your school.</div>
                    </div>
                    <a href="/branches" className="btn btn-sm btn-primary" style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}
                      onClick={() => setShowSetupWarning(null)}>
                      Create One
                    </a>
                  </div>
                )}
                {showSetupWarning.missingShift && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 10,
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                  }}>
                    <span style={{ fontSize: 24 }}>🕐</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>No Shifts (working hours) Found</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Create at least one work shift for your school.</div>
                    </div>
                    <a href="/shifts" className="btn btn-sm btn-primary" style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}
                      onClick={() => setShowSetupWarning(null)}>
                      Create One
                    </a>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowSetupWarning(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

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

      {/* Reset Password Modal */}
      {resetPasswordConfirm && (
        <div className="modal-overlay" onClick={() => setResetPasswordConfirm(null)}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button className="modal-close" onClick={() => setResetPasswordConfirm(null)}>✕</button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Confirm with your Admin Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={adminPasswordValue}
                  onChange={(e) => setAdminPasswordValue(e.target.value)}
                  placeholder="Your admin password"
                  required
                />
              </div>
              <div className="modal-footer" style={{ marginTop: 24 }}>
                <button type="button" className="btn" onClick={() => { setResetPasswordConfirm(null); setAdminPasswordValue(''); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting || !adminPasswordValue}>
                  {isSubmitting ? 'Requesting…' : 'Generate PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
