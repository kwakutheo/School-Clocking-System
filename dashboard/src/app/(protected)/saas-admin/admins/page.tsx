'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { saasAdminApi, auditApi, usersApi } from '@/lib/api';
import { useAuthStore, roleLabel } from '@/lib/store';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Edit3,
  Lock,
  Plus,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  X,
  Search,
  KeyRound,
  Archive,
  ListTodo,
  Calendar,
} from 'lucide-react';

type AdminRole = 'super_admin' | 'hr_admin' | 'supervisor';

interface GlobalAdminUser {
  id: string;
  fullName: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accountScope: 'global';
  lastLoginAt?: string | null;
  mfaEnabled?: boolean;
  deletedAt?: string | null;
}

const roleDescriptions: Record<AdminRole, string> = {
  super_admin: 'Full central dashboard control.',
  hr_admin: 'Can monitor operations and manage platform announcements.',
  supervisor: 'Read-only central monitoring access.',
};

const emptyForm = {
  fullName: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  role: 'supervisor' as AdminRole,
  isActive: true,
};

export default function CentralAdminsPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const [admins, setAdmins] = useState<GlobalAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GlobalAdminUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [notification, setNotification] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });
  const [confirmAction, setConfirmAction] = useState<{ isOpen: boolean; payload: any; message: string; onConfirm: (payload: any) => void }>({ isOpen: false, payload: null, message: '', onConfirm: () => {} });

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ isOpen: true, message, type });
  };
  const usernameCheckTimer = useRef<number | null>(null);

  // Debounced username availability check while creating a new admin
  useEffect(() => {
    if (editing) return; // only run for the create form where username input is shown
    const username = form.username?.trim();
    if (!username) {
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);
    setUsernameAvailable(null);
    if (usernameCheckTimer.current) window.clearTimeout(usernameCheckTimer.current);
    usernameCheckTimer.current = window.setTimeout(async () => {
      try {
        const res = await usersApi.checkUsername(username, form.fullName?.trim());
        setUsernameAvailable(!!res.data?.available);
        setUsernameSuggestions(res.data?.suggestions || []);
      } catch (err) {
        console.warn('Username availability check failed', err);
        setUsernameAvailable(null);
        setUsernameSuggestions([]);
      } finally {
        setCheckingUsername(false);
      }
    }, 350);

    return () => {
      if (usernameCheckTimer.current) window.clearTimeout(usernameCheckTimer.current);
    };
  }, [form.username, form.fullName, editing]);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<AdminRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');

  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [viewingAdmin, setViewingAdmin] = useState<GlobalAdminUser | null>(null);

  const filteredAndSortedAdmins = useMemo(() => {
    return admins
      .filter((admin) => {
        const matchesSearch =
          searchTerm === '' ||
          admin.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          admin.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          admin.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || admin.role === roleFilter;
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'active' && admin.isActive) ||
          (statusFilter === 'disabled' && !admin.isActive);
        return matchesSearch && matchesRole && matchesStatus && !admin.deletedAt;
      })
      .sort((a, b) => {
        const roleOrder: Record<AdminRole, number> = {
          super_admin: 0,
          hr_admin: 1,
          supervisor: 2,
        };
        return roleOrder[a.role] - roleOrder[b.role] || a.fullName.localeCompare(b.fullName);
      });
  }, [admins, searchTerm, roleFilter, statusFilter]);

  const fetchAdmins = () => {
    setLoading(true);
    setError(null);
    saasAdminApi
      .listAdminUsers()
      .then((res) => setAdmins(res.data))
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to load central admin accounts.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalError(null);
    setModalOpen(true);
  };

  const openEdit = (admin: GlobalAdminUser) => {
    setEditing(admin);
    setForm({
      fullName: admin.fullName,
      username: admin.username ?? '',
      email: admin.email ?? '',
      phone: admin.phone ?? '',
      password: '',
      role: admin.role,
      isActive: admin.isActive,
    });
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setModalError(null);
  };

  const handleArchiveClick = (id: string) => {
    setConfirmAction({
      isOpen: true,
      payload: id,
      message: 'Are you sure you want to archive this central admin account?',
      onConfirm: executeArchive
    });
  };

  const executeArchive = async (id: string) => {
    setConfirmAction({ isOpen: false, payload: null, message: '', onConfirm: () => {} });
    try {
      await saasAdminApi.deleteAdminUser(id);
      fetchAdmins();
    } catch (err: any) {
      showAlert(err.response?.data?.message || 'Failed to archive account.', 'error');
    }
  };

  const handleRestoreClick = (id: string) => {
    setConfirmAction({
      isOpen: true,
      payload: id,
      message: 'Are you sure you want to restore this central admin account?',
      onConfirm: executeRestore
    });
  };

  const executeRestore = async (id: string) => {
    setConfirmAction({ isOpen: false, payload: null, message: '', onConfirm: () => {} });
    try {
      await saasAdminApi.restoreAdminUser(id);
      fetchAdmins();
    } catch (err: any) {
      showAlert(err.response?.data?.message || 'Failed to restore account.', 'error');
    }
  };

  const handleResetPasswordClick = (id: string) => {
    setConfirmAction({
      isOpen: true,
      payload: id,
      message: 'Are you sure you want to generate a password reset PIN for this admin?',
      onConfirm: executeResetPassword
    });
  };

  const executeResetPassword = async (id: string) => {
    setConfirmAction({ isOpen: false, payload: null, message: '', onConfirm: () => {} });
    try {
      const res = await saasAdminApi.sendAdminResetLink(id);
      showAlert(res.data?.message || 'Password reset request sent.', 'success');
    } catch (err: any) {
      showAlert(err.response?.data?.message || 'Failed to send reset link.', 'error');
    }
  };

  const openLogs = async (admin: GlobalAdminUser) => {
    setViewingAdmin(admin);
    setLogsModalOpen(true);
    setLoadingLogs(true);
    try {
      const res = await auditApi.list({ userId: admin.id, limit: 50 });
      setAdminLogs(res.data?.data || []);
    } catch (err) {
      console.error(err);
      showAlert('Failed to load audit logs for this admin.', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setModalError(null);

    // Require full name always. Username is required only when creating a new admin.
    if (!form.fullName.trim() || (!editing && !form.username.trim())) {
      setModalError(editing ? 'Full name is required.' : 'Full name and username are required.');
      return;
    }
    if (!editing && form.password.length < 8) {
      setModalError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);

    // Pre-check username availability when creating a new admin (defensive UX)
    if (!editing) {
      try {
        setCheckingUsername(true);
        const res = await usersApi.checkUsername(form.username.trim(), form.fullName.trim());
        if (!res.data?.available) {
          setUsernameAvailable(false);
          setUsernameSuggestions(res.data?.suggestions || []);
          setModalError('Username already in use.');
          setSubmitting(false);
          return;
        }
        setUsernameAvailable(true);
      } catch (err) {
        // If the check fails we fall back to the server-side validation during create.
        console.warn('Username availability check failed, will proceed and let server validate', err);
      } finally {
        setCheckingUsername(false);
      }
    }

    const payload = {
      fullName: form.fullName.trim(),
      username: form.username.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      isActive: form.isActive,
      ...(form.password ? { password: form.password } : {}),
    };

    const request = editing
      ? saasAdminApi.updateAdminUser(editing.id, payload)
      : saasAdminApi.createAdminUser({
          fullName: payload.fullName,
          username: payload.username,
          email: payload.email || undefined,
          phone: payload.phone || undefined,
          role: payload.role,
          password: form.password,
        });

    try {
      await request;
      closeModal();
      fetchAdmins();
    } catch (err: any) {
      console.error(err);
      setModalError(err.response?.data?.message || 'Failed to save admin account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (currentUser?.role !== 'super_admin' || currentUser?.tenantId !== null) {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 720 }}>
        <ShieldAlert size={32} style={{ color: 'var(--danger)', marginBottom: 16 }} />
        <h1 className="page-title">Access Restricted</h1>
        <p className="page-sub">Only global super admins can manage central dashboard accounts.</p>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div
        className="page-header" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}
      >
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
            <ShieldCheck size={28} color='var(--primary)' />
            Admin Users
          </h1>
          <p className="page-sub" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            Register and manage central dashboard accounts that are separate from school admin users.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            className="btn btn-ghost" 
            onClick={() => router.push('/saas-admin/admins/archived')}
            style={{ display: 'inline-flex', gap: 8, color: 'var(--text-secondary)' }}
          >
            <Archive size={18} />
            View Archived Admins
          </button>
          <button className="btn btn-primary" onClick={openCreate} style={{ display: 'inline-flex', gap: 8 }}>
            <Plus size={18} />
            Register Admin
          </button>
        </div>
      </div>

      {error && (
        <div className="error-card card" style={{ marginBottom: 20, padding: 16 }}>
          <span className="text-danger">{error}</span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 250px' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--text-secondary)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 42 }}
            placeholder="Search admins by name, username or email..."
            aria-label="Search admins"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="form-input"
          style={{ width: 'auto' }}
          aria-label="Filter by role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
        >
          <option value="all">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="hr_admin">HR Admin</option>
          <option value="supervisor">Supervisor</option>
        </select>
        <select
          className="form-input"
          style={{ width: 'auto' }}
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '16px 24px' }}>Name</th>
                <th style={{ padding: '16px 24px' }}>Role</th>
                <th style={{ padding: '16px 24px' }}>Contact</th>
                <th style={{ padding: '16px 24px' }}>Status & Security</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : filteredAndSortedAdmins.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No central admin accounts found.
                  </td>
                </tr>
              ) : (
                filteredAndSortedAdmins.map((admin) => (
                  <tr key={admin.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '18px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="user-avatar" style={{ width: 36, height: 36 }}>
                          <UserCog size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{admin.fullName}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                            @{admin.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '18px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldCheck size={16} style={{ color: 'var(--primary)' }} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{roleLabel[admin.role]}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                            {roleDescriptions[admin.role]}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '18px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
                      <div>{admin.email || 'No email'}</div>
                      <div>{admin.phone || 'No phone'}</div>
                    </td>
                    <td style={{ padding: '18px 24px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                        {admin.deletedAt ? (
                          <span
                            className="badge-ghost"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 8px',
                              borderRadius: 6,
                              color: 'var(--text-secondary)',
                              background: 'var(--bg-secondary)',
                            }}
                          >
                            <Archive size={12} />
                            Archived
                          </span>
                        ) : (
                          <span
                            className="badge-ghost"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 8px',
                              borderRadius: 6,
                              color: admin.isActive ? 'var(--success)' : 'var(--danger)',
                              background: admin.isActive ? 'var(--success-dim)' : 'var(--danger-dim)',
                            }}
                          >
                            <CheckCircle2 size={12} />
                            {admin.isActive ? 'Active' : 'Disabled'}
                          </span>
                        )}
                        {admin.mfaEnabled && (
                          <span className="badge-ghost" style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, background: 'var(--primary-dim)', color: 'var(--primary)' }}>
                            MFA Enabled
                          </span>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={10} />
                          {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString() : 'Never logged in'}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          className="btn btn-ghost"
                          onClick={() => openLogs(admin)}
                          title="Audit Logs"
                          style={{ padding: '6px 10px' }}
                        >
                          <ListTodo size={16} style={{ color: 'var(--text-secondary)' }} />
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleResetPasswordClick(admin.id)}
                          title="Send Password Reset"
                          style={{ padding: '6px 10px' }}
                        >
                          <KeyRound size={16} style={{ color: 'var(--text-secondary)' }} />
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => openEdit(admin)}
                          title="Edit"
                          disabled={!!admin.deletedAt}
                          style={{ padding: '6px 10px', opacity: admin.deletedAt ? 0.5 : 1 }}
                        >
                          <Edit3 size={16} style={{ color: 'var(--primary)' }} />
                        </button>
                        {currentUser?.id !== admin.id && (
                          admin.deletedAt ? (
                            <button
                              className="btn btn-ghost"
                              onClick={() => handleRestoreClick(admin.id)}
                              title="Restore"
                              style={{ padding: '6px 10px' }}
                            >
                              <Archive size={16} style={{ color: 'var(--success)' }} />
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost"
                              onClick={() => handleArchiveClick(admin.id)}
                              title="Archive"
                              style={{ padding: '6px 10px' }}
                            >
                              <Archive size={16} style={{ color: 'var(--danger)' }} />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)' }}>
              {notification.type === 'error' ? 'Error' : notification.type === 'success' ? 'Success' : 'Notice'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {notification.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={() => setNotification({ ...notification, isOpen: false })} style={{ minWidth: 120 }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Global Confirmation Modal */}
      {confirmAction.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ marginBottom: 20 }}>
              <ShieldAlert size={48} style={{ color: 'var(--danger)', margin: '0 auto' }} />
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)' }}>Are you sure?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>{confirmAction.message}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmAction({ isOpen: false, payload: null, message: '', onConfirm: () => {} })}>Cancel</button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => confirmAction.onConfirm(confirmAction.payload)}>Yes, Proceed</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={22} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>
                  {editing ? 'Edit Admin Account' : 'Register Admin Account'}
                </h2>
              </div>
              <button onClick={closeModal} aria-label="Close" title="Close">
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div className="error-card card" style={{ padding: 12, marginBottom: 18 }}>
                <span className="text-danger">{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label className="form-label" htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  className="form-input"
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr' : '1fr 1fr', gap: 14 }}>
                {!editing && (
                  <div>
                    <label className="form-label" htmlFor="username">Username</label>
                    <input
                      id="username"
                      className="form-input"
                      value={form.username}
                      onChange={(e) => { setForm((prev) => ({ ...prev, username: e.target.value })); setUsernameAvailable(null); }}
                      required
                    />
                    <div style={{ marginTop: 8 }}>
                      {checkingUsername && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Checking availability…</div>
                      )}

                      {usernameAvailable === true && (
                        <div style={{ color: 'var(--success)', fontSize: 13 }}>Username is available ✓</div>
                      )}

                      {usernameAvailable === false && (
                        <div style={{ fontSize: 13 }}>
                          <div style={{ color: 'var(--danger)', marginBottom: 6 }}>Username is taken.</div>
                          {usernameSuggestions.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {usernameSuggestions.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setForm((prev) => ({ ...prev, username: s }))}
                                  style={{
                                    background: 'var(--bg-input)',
                                    border: '1px dashed var(--border)',
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    fontSize: 13,
                                  }}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <label className="form-label" htmlFor="role">Role</label>
                  <select
                    id="role"
                    className="form-input"
                    value={form.role}
                    onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as AdminRole }))}
                    disabled={editing?.id === currentUser.id}
                  >
                    <option value="supervisor">Supervisor</option>
                    <option value="hr_admin">HR Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    className="form-input"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>

              {!editing && (
                <div>
                  <label className="form-label" htmlFor="password">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password"
                      className="form-input"
                      type="password"
                      minLength={8}
                      value={form.password}
                      placeholder={'At least 8 characters'}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                      required
                      style={{ paddingLeft: 42 }}
                    />
                    <Lock size={16} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--text-secondary)' }} />
                  </div>
                </div>
              )}

              {editing && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    disabled={editing.id === currentUser.id}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Account is active
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Register Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {logsModalOpen && viewingAdmin && (
        <div className="modal-overlay" onClick={() => setLogsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>Audit Logs</h2>
                <p className="page-sub">Recent activity for {viewingAdmin.fullName}</p>
              </div>
              <button onClick={() => setLogsModalOpen(false)} aria-label="Close" title="Close">
                <X size={20} />
              </button>
            </div>
            
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {loadingLogs ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
              ) : adminLogs.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No recent activity found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {adminLogs.map((log, idx) => (
                    <div key={idx} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong style={{ fontSize: 13 }}>{log.action}</strong>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Module: {log.module} {log.targetId && `| Target: ${log.targetId}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
