"use client";
import { useEffect, useMemo, useState } from "react";
import { saasAdminApi, auditApi } from "@/lib/api";
import { useAuthStore, roleLabel } from "@/lib/store";
import { useRouter } from "next/navigation";
import {
  Archive,
  ListTodo,
  Search,
  X,
  Calendar,
  ChevronLeft,
  UserCog,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

type AdminRole = "super_admin" | "hr_admin" | "supervisor";

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
  accountScope: "global";
  lastLoginAt?: string | null;
  mfaEnabled?: boolean;
  deletedAt?: string | null;
}

const roleDescriptions: Record<AdminRole, string> = {
  super_admin: "Full central dashboard control.",
  hr_admin: "Can monitor operations and manage platform announcements.",
  supervisor: "Read-only central monitoring access.",
};

export default function ArchivedAdminsPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);

  const [admins, setAdmins] = useState<GlobalAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRole | "all">("all");

  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [viewingAdmin, setViewingAdmin] = useState<GlobalAdminUser | null>(null);

  // Per-row restoring state
  const [restoringIds, setRestoringIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });
  const [confirmAction, setConfirmAction] = useState<{ isOpen: boolean; payload: any; message: string; onConfirm: (payload: any) => void }>({ isOpen: false, payload: null, message: '', onConfirm: () => {} });

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ isOpen: true, message, type });
  };

  const fetchArchivedAdmins = () => {
    setLoading(true);
    setError(null);
    saasAdminApi
      .listAdminUsers(true)
      .then((res) => setAdmins(res.data))
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load archived admin accounts.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchArchivedAdmins();
  }, []);

  const filteredAndSortedAdmins = useMemo(() => {
    return admins
      .filter((admin) => admin.deletedAt) // ensure only archived
      .filter((admin) => {
        const matchesSearch =
          searchTerm === "" ||
          admin.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          admin.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          admin.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === "all" || admin.role === roleFilter;
        return matchesSearch && matchesRole;
      })
      .sort((a, b) => {
        const roleOrder: Record<AdminRole, number> = {
          super_admin: 0,
          hr_admin: 1,
          supervisor: 2,
        };
        return roleOrder[a.role] - roleOrder[b.role] || a.fullName.localeCompare(b.fullName);
      });
  }, [admins, searchTerm, roleFilter]);

  const openLogs = async (admin: GlobalAdminUser) => {
    setViewingAdmin(admin);
    setLogsModalOpen(true);
    setLoadingLogs(true);
    try {
      const res = await auditApi.list({ userId: admin.id, limit: 50 });
      setAdminLogs(res.data?.data || []);
    } catch (err) {
      console.error(err);
      showAlert("Failed to load audit logs for this admin.", 'error');
    } finally {
      setLoadingLogs(false);
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
    setRestoringIds((prev) => [...prev, id]);
    try {
      await saasAdminApi.restoreAdminUser(id);
      setAdmins((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      console.error(err);
      showAlert(err.response?.data?.message || "Failed to restore account.", 'error');
    } finally {
      setRestoringIds((prev) => prev.filter((x) => x !== id));
    }
  };

  if (currentUser?.role !== "super_admin" || currentUser?.tenantId !== null) {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 720 }}>
        <ShieldAlert size={32} style={{ color: "var(--danger)", marginBottom: 16 }} />
        <h1 className="page-title">Access Restricted</h1>
        <p className="page-sub">Only global super admins can manage central dashboard accounts.</p>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => router.push('/saas-admin/admins')} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <ChevronLeft size={18} />
            Back to Active Admins
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: 28, fontWeight: 800 }}>
              Archived Admin Accounts
            </h1>
            <p className="page-sub" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
              Manage soft-deleted central dashboard accounts.
            </p>
          </div>
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
            placeholder="Search archived admins by name, username or email..."
            aria-label="Search archived admins"
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
      </div>

      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '16px 24px' }}>Name</th>
                <th style={{ padding: '16px 24px' }}>Role</th>
                <th style={{ padding: '16px 24px' }}>Archived Date</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: 40, textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : filteredAndSortedAdmins.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No archived central admin accounts found.
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
                          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>@{admin.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '18px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldCheck size={16} style={{ color: 'var(--primary)' }} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{roleLabel[admin.role]}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{roleDescriptions[admin.role]}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '18px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>
                      <div>{admin.deletedAt ? new Date(admin.deletedAt).toLocaleString() : 'Unknown'}</div>
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

                        {currentUser?.id !== admin.id && (
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleRestoreClick(admin.id)}
                            title="Restore"
                            disabled={restoringIds.includes(admin.id)}
                            style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                          >
                            {restoringIds.includes(admin.id) ? (
                              <div className="spinner" style={{ width: 14, height: 14 }} />
                            ) : (
                              <Archive size={16} style={{ color: 'var(--success)' }} />
                            )}
                          </button>
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
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)' }}>{notification.type === 'error' ? 'Error' : notification.type === 'success' ? 'Success' : 'Notice'}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{notification.message}</p>
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
            <div style={{ marginBottom: 20 }}><ShieldAlert size={48} style={{ color: 'var(--danger)', margin: '0 auto' }} /></div>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)' }}>Are you sure?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>{confirmAction.message}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmAction({ isOpen: false, payload: null, message: '', onConfirm: () => {} })}>Cancel</button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => confirmAction.onConfirm(confirmAction.payload)}>Yes, Proceed</button>
            </div>
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
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(log.createdAt).toLocaleString()}</span>
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
