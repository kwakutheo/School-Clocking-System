'use client';
import { useEffect, useState } from 'react';
import { saasAdminApi } from '@/lib/api';
import { Plus, Building2, Globe, Users, Power, X, ShieldAlert, Sparkles, Palette, Link as LinkIcon, Edit3, Trash2, Eye } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

interface SchoolTenant {
  id: string;
  name: string;
  slug: string;
  initials?: string | null;
  isActive: boolean;
  primaryColor: string;
  logoUrl: string | null;
  customDomain: string | null;
  createdAt: string;
  metrics: {
    employees: number;
    branches: number;
    departments: number;
    shifts: number;
  };
}

const configuredPortalBaseDomain =
  process.env.NEXT_PUBLIC_PORTAL_BASE_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '');

function getPortalBaseDomain() {
  if (configuredPortalBaseDomain) return configuredPortalBaseDomain;
  if (typeof window === 'undefined') return 'localhost';

  const host = window.location.host;
  return host.startsWith('www.') ? host.slice(4) : host;
}

function getPortalUrl(slug: string) {
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  return `${protocol}//${slug}.${getPortalBaseDomain()}`;
}

export default function SchoolsRegistryPage() {
  const router = useRouter();
  const { setImpersonatedTenant } = useAuthStore();
  const [schools, setSchools] = useState<SchoolTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Impersonation switch handler
  const handleViewPortal = (school: SchoolTenant) => {
    setImpersonatedTenant({
      id: school.id,
      name: school.name,
      slug: school.slug,
      initials: school.initials || null,
      primaryColor: school.primaryColor,
      logoUrl: school.logoUrl,
      customDomain: school.customDomain
    });
    router.push('/dashboard');
  };

  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Onboarding Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [initials, setInitials] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Branding Modal States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolTenant | null>(null);
  const [editName, setEditName] = useState('');
  const [editInitials, setEditInitials] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editPrimaryColor, setEditPrimaryColor] = useState('#3b82f6');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editCustomDomain, setEditCustomDomain] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [isModalEditing, setIsModalEditing] = useState(false);

  useEffect(() => {
    fetchSchools();
  }, []);

  // Reset pagination to first page when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, itemsPerPage]);

  const fetchSchools = () => {
    setLoading(true);
    saasAdminApi.listTenants()
      .then((res) => {
        setSchools(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load schools registry.');
        setLoading(false);
      });
  };

  // Toggle active/suspended state of a school
  const handleToggleStatus = (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const confirmMsg = nextStatus
      ? `Are you sure you want to activate this school's portal access?`
      : `⚠️ WARNING: Are you sure you want to suspend this school's portal? All their employees and admins will be blocked from accessing the system instantly.`;

    if (!confirm(confirmMsg)) return;

    saasAdminApi.toggleStatus(id, nextStatus)
      .then(() => {
        setSchools(prev => prev.map(s => s.id === id ? { ...s, isActive: nextStatus } : s));
      })
      .catch((err) => {
        console.error(err);
        alert('Failed to update school portal status.');
      });
  };

  // Permanently delete a school tenant and all associated data
  const handleDeleteSchool = (school: SchoolTenant) => {
    const slugInput = prompt(
      `⚠️ DANGER: You are about to PERMANENTLY DELETE "${school.name}".\n` +
      `This will instantly purge all branches, departments, shifts, employees, and years of attendance logs!\n` +
      `This action CANNOT BE UNDONE.\n\n` +
      `To confirm deletion, please type the school subdomain slug: "${school.slug}"`
    );

    if (slugInput === null) return; // Cancelled

    if (slugInput.trim().toLowerCase() !== school.slug.toLowerCase()) {
      alert('❌ Error: Subdomain slug does not match. Deletion aborted.');
      return;
    }

    saasAdminApi.deleteTenant(school.id)
      .then(() => {
        alert(`🟢 Success: "${school.name}" has been permanently purged.`);
        fetchSchools();
      })
      .catch((err: any) => {
        console.error(err);
        alert(err.response?.data?.message || 'Failed to delete school.');
      });
  };

  // Submit dynamic onboarding form
  const handleOnboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug || !initials.trim() || !adminUsername || !adminPassword) {
      setModalError('All fields are required.');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    saasAdminApi.onboardTenant({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      initials: initials.trim().toUpperCase(),
      primaryColor,
      adminUsername: adminUsername.trim(),
      adminPasswordHash: adminPassword,
    })
      .then(() => {
        setSubmitting(false);
        setModalOpen(false);
        // Clear fields
        setName('');
        setSlug('');
        setInitials('');
        setPrimaryColor('#3b82f6');
        setAdminUsername('');
        setAdminPassword('');
        fetchSchools();
      })
      .catch((err) => {
        console.error(err);
        setModalError(err.response?.data?.message || 'Failed to onboard new school.');
        setSubmitting(false);
      });
  };

  // Open Edit Modal with current values
  const openEditModal = (school: SchoolTenant) => {
    setSelectedSchool(school);
    setEditName(school.name);
    setEditInitials((school as any).initials ?? '');
    setEditSlug(school.slug);
    setEditPrimaryColor(school.primaryColor);
    setEditLogoUrl(school.logoUrl || '');
    setEditCustomDomain(school.customDomain || '');
    setEditModalError(null);
    setIsModalEditing(false); // Start in Read-Only mode!
    setEditModalOpen(true);
  };

  // Submit Edit Branding form
  const handleEditBranding = (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!selectedSchool) return;

    if (!editName.trim() || !editSlug.trim() || !editInitials.trim()) {
      setEditModalError('Name, Initials and Subdomain Slug are required.');
      return;
    }

    setEditSubmitting(true);
    setEditModalError(null);

    saasAdminApi.updateBranding(selectedSchool.id, {
      name: editName.trim(),
      slug: editSlug.trim().toLowerCase(),
      initials: editInitials.trim().toUpperCase(),
      primaryColor: selectedSchool.primaryColor,
      logoUrl: selectedSchool.logoUrl || undefined,
      customDomain: editCustomDomain.trim() || '',
    })
      .then(() => {
        setEditSubmitting(false);
        setIsModalEditing(false);
        setEditModalOpen(false);
        fetchSchools();
      })
      .catch((err) => {
        console.error(err);
        setEditModalError(err.response?.data?.message || 'Failed to update school branding details.');
        setEditSubmitting(false);
      });
  };

  // ── Client-Side Search & Filter Logic ──
  const filteredSchools = schools.filter((school) => {
    const matchesSearch = 
      school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      school.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (school.customDomain && school.customDomain.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && school.isActive) ||
      (statusFilter === 'suspended' && !school.isActive);

    return matchesSearch && matchesStatus;
  }).sort((a, b) => a.name.localeCompare(b.name));

  // ── Pagination Math ──
  const totalItems = filteredSchools.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSchools = filteredSchools.slice(indexOfFirstItem, indexOfLastItem);

  // Generate a compact pagination window to avoid rendering all page buttons
  // when there are many pages (e.g., 101 pages). Returns numbers and '...' placeholders.
  const getPaginationPages = (total: number, page: number, maxButtons = 9): (number | '...')[] => {
    if (total <= maxButtons) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    const left = Math.max(2, page - 2);
    const right = Math.min(total - 1, page + 2);
    pages.push(1);
    if (left > 2) pages.push('...');
    for (let p = left; p <= right; p++) pages.push(p);
    if (right < total - 1) pages.push('...');
    pages.push(total);
    return pages;
  };

  const paginationPages = getPaginationPages(totalPages, currentPage);

  if (loading && schools.length === 0) {
    return (
      <div className="loading-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* ── Page Header ── */}
      <div className="page-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Schools Registry
          </h1>
          <p className="page-sub" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Monitor supervised institutions, update branding details, map subdomains, and toggle global portal access.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px' }}
        >
          <Plus size={18} />
          Onboard School
        </button>
      </div>

      {error && (
        <div className="error-card card" style={{ marginBottom: '24px' }}>
          <p className="text-danger">{error}</p>
        </div>
      )}

      {/* ── Search & Filter Controls Toolbar ── */}
      <div className="card" style={{
        padding: '16px 24px',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-card-alt, rgba(255,255,255,0.02))',
        border: '1px solid var(--border)'
      }}>
        {/* Left Side: Search Query & Status Filter Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '400px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by school name, subdomain, or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px', height: '40px', borderRadius: '8px' }}
            />
            <span style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-secondary)' }}>
              <Building2 size={16} />
            </span>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-input, rgba(255,255,255,0.03))', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: statusFilter === 'all' ? 'var(--primary)' : 'none',
                color: statusFilter === 'all' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: statusFilter === 'active' ? 'var(--success)' : 'none',
                color: statusFilter === 'active' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: statusFilter === 'suspended' ? 'var(--danger)' : 'none',
                color: statusFilter === 'suspended' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              Suspended
            </button>
          </div>
        </div>

        {/* Right Side: Page Limits */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="items-per-page-select" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Show</label>
          <select
            id="items-per-page-select"
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            style={{
              background: 'var(--bg-input, rgba(255,255,255,0.03))',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
          </select>
        </div>
      </div>

      {/* ── Schools Table ── */}
      <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>School Name</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>School Portal Links</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Active Seats</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Workforce Status</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Portal Status</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentSchools.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {searchQuery || statusFilter !== 'all' 
                      ? 'No supervised institutions match your active filters.' 
                      : 'No schools onboarded yet. Click "Onboard School" to add your first institution!'}
                  </td>
                </tr>
              ) : (
                currentSchools.map((school) => {
                  const subdomainUrl = getPortalUrl(school.slug);
                  const subdomainLabel = `${school.slug}.${getPortalBaseDomain()}`;

                  return (
                    <tr key={school.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                      {/* Name & Theme color dot */}
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {school.logoUrl ? (
                            <img
                              src={school.logoUrl}
                              alt={`${school.name} Logo`}
                              style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'contain', border: '1px solid var(--border)', background: 'var(--input-bg)' }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '10px', height: '10px',
                                borderRadius: '50%',
                                backgroundColor: school.primaryColor,
                                boxShadow: `0 0 8px ${school.primaryColor}`
                              }} />
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{school.name}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', paddingLeft: '18px' }}>
                              Onboarded: {new Date(school.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Subdomain slug & Custom Domain */}
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <a
                            href={subdomainUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              color: 'var(--primary)', fontWeight: 500, fontSize: '13px'
                            }}
                          >
                            <Globe size={14} />
                            {subdomainLabel}
                          </a>
                          {school.customDomain && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontSize: '11px', color: 'var(--success)', fontWeight: 600
                            }}>
                              <LinkIcon size={10} /> {school.customDomain}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Active seat count */}
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600 }}>
                          <Users size={16} style={{ color: 'var(--text-secondary)' }} />
                          {school.metrics.employees} employees
                        </div>
                      </td>

                      {/* Shifts and branches */}
                      <td style={{ padding: '20px 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {school.metrics.branches} branches • {school.metrics.shifts} active shifts
                      </td>

                      {/* Status state */}
                      <td style={{ padding: '20px 24px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: school.isActive ? 'var(--success-dim)' : 'var(--danger-dim)',
                          color: school.isActive ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {school.isActive ? 'ACTIVE' : 'SUSPENDED'}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                          <button
                            onClick={() => handleViewPortal(school)}
                            className="btn btn-secondary"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              borderColor: 'rgba(236, 72, 153, 0.3)',
                              color: '#ec4899',
                              background: 'rgba(236, 72, 153, 0.05)',
                              transition: 'all 0.2s',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(236, 72, 153, 0.1)';
                              e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(236, 72, 153, 0.05)';
                              e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.3)';
                            }}
                          >
                            <Eye size={12} />
                            View Portal
                          </button>
                          
                          <button
                            onClick={() => openEditModal(school)}
                            className="btn btn-secondary"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Palette size={12} />
                            Domain Slug
                          </button>
                          
                          <button
                            onClick={() => handleToggleStatus(school.id, school.isActive)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: school.isActive ? 'var(--danger-dim)' : 'var(--success-dim)',
                              color: school.isActive ? 'var(--danger)' : 'var(--success)',
                              transition: 'all 0.2s'
                            }}
                          >
                            <Power size={12} />
                            {school.isActive ? 'Suspend' : 'Activate'}
                          </button>

                          <button
                            onClick={() => handleDeleteSchool(school)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: 'rgba(239, 68, 68, 0.08)',
                              color: 'var(--danger)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              transition: 'all 0.2s',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination Footer Controls ── */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '24px',
          padding: '16px 24px',
          background: 'var(--bg-card-alt, rgba(255,255,255,0.01))',
          border: '1px solid var(--border)',
          borderRadius: '12px'
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{indexOfFirstItem + 1}</strong> to <strong style={{ color: 'var(--text-primary)' }}>{Math.min(indexOfLastItem, totalItems)}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong> institutions
          </span>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', borderRadius: '8px', opacity: currentPage === 1 ? 0.5 : 1, flex: '0 0 auto' }}
            >
              Previous
            </button>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', whiteSpace: 'nowrap', maxWidth: 'min(60%, 520px)', paddingBottom: '2px' }}>
              {paginationPages.map((p, idx) => (
                typeof p === 'number' ? (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(Number(p))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '13px',
                      background: currentPage === p ? 'var(--primary)' : 'var(--bg-input, rgba(255,255,255,0.03))',
                      color: currentPage === p ? '#fff' : 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      minWidth: '36px',
                      flex: '0 0 auto'
                    }}
                  >
                    {p}
                  </button>
                ) : (
                  <span
                    key={`dots-${idx}`}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '36px',
                      flex: '0 0 auto'
                    }}
                  >
                    ...
                  </span>
                )
              ))}
            </div>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', borderRadius: '8px', opacity: currentPage === totalPages ? 0.5 : 1, flex: '0 0 auto' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Onboarding Modal ── */}
      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999, animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '480px',
            padding: '32px', position: 'relative',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={22} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Onboard New School</h2>
              </div>
              <button onClick={() => setModalOpen(false)} title="Close" aria-label="Close" style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div className="error-card card" style={{ padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} className="text-danger" />
                <span className="text-danger" style={{ fontSize: '13px' }}>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleOnboard} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>School Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Prempeh College"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>School Initials <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. PC for Prempeh College"
                  value={initials}
                  onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))}
                  maxLength={4}
                  required
                  style={{ letterSpacing: '4px', fontWeight: 700, fontSize: '15px' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>Used as prefix for auto-generated employee codes (e.g. PC-0042).</span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Subdomain Slug</label>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. prempeh"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    style={{ paddingRight: '120px' }}
                    required
                  />
                  <span style={{ position: 'absolute', right: '14px', fontSize: '13px', color: 'var(--text-secondary)', pointerEvents: 'none' }}>
                    .{getPortalBaseDomain()}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Primary Theme Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="color"
                    title="Primary Theme Color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    style={{ width: '40px', height: '40px', padding: '0px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
                  />
                  <span style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {primaryColor.toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>School Master Admin Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. prempeh.admin"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>School Admin Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {submitting ? 'Onboarding School...' : (
                  <>
                    <Sparkles size={16} />
                    Complete School Onboarding
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Branding Modal ── */}
      {editModalOpen && selectedSchool && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999, animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '520px',
            padding: '32px', position: 'relative',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Globe size={22} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Subdomain & Domain Settings</h2>
              </div>
              <button onClick={() => setEditModalOpen(false)} title="Close" aria-label="Close" style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {editModalError && (
              <div className="error-card card" style={{ padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} className="text-danger" />
                <span className="text-danger" style={{ fontSize: '13px' }}>{editModalError}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>School Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Accra Academy"
                  required
                  disabled={!isModalEditing}
                  style={{
                    opacity: !isModalEditing ? 0.75 : 1,
                    background: !isModalEditing ? 'var(--bg-card-alt, rgba(255,255,255,0.02))' : 'var(--bg-input)',
                    cursor: !isModalEditing ? 'default' : 'text'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>School Initials <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={editInitials}
                  onChange={(e) => setEditInitials(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="e.g. AA"
                  maxLength={4}
                  required
                  disabled={!isModalEditing}
                  style={{
                    letterSpacing: '4px', fontWeight: 700, fontSize: '15px',
                    opacity: !isModalEditing ? 0.75 : 1,
                    background: !isModalEditing ? 'var(--bg-card-alt, rgba(255,255,255,0.02))' : 'var(--bg-input)',
                    cursor: !isModalEditing ? 'default' : 'text'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>Used as prefix for auto-generated employee codes (e.g. AA-0001).</span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Subdomain Slug</label>
                <input
                  type="text"
                  className="form-input"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  placeholder="e.g. accra"
                  required
                  disabled={!isModalEditing}
                  style={{
                    opacity: !isModalEditing ? 0.75 : 1,
                    background: !isModalEditing ? 'var(--bg-card-alt, rgba(255,255,255,0.02))' : 'var(--bg-input)',
                    cursor: !isModalEditing ? 'default' : 'text'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <LinkIcon size={13} /> White-Label Custom Domain
                  </span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. portal.accraacademy.edu.gh"
                  value={editCustomDomain}
                  onChange={(e) => setEditCustomDomain(e.target.value)}
                  disabled={!isModalEditing}
                  style={{
                    opacity: !isModalEditing ? 0.75 : 1,
                    background: !isModalEditing ? 'var(--bg-card-alt, rgba(255,255,255,0.02))' : 'var(--bg-input)',
                    cursor: !isModalEditing ? 'default' : 'text'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Leave blank to fall back to the default subdomain slug route.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                {!isModalEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(false)}
                      className="btn btn-secondary"
                      style={{ padding: '10px 20px', borderRadius: '8px' }}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalEditing(true)}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontWeight: 600 }}
                    >
                      <Edit3 size={16} />
                      Edit Settings
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedSchool) {
                          setEditName(selectedSchool.name);
                          setEditInitials((selectedSchool as any).initials ?? '');
                          setEditSlug(selectedSchool.slug);
                          setEditCustomDomain(selectedSchool.customDomain || '');
                        }
                        setIsModalEditing(false);
                        setEditModalError(null);
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '10px 20px', borderRadius: '8px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={editSubmitting}
                      onClick={handleEditBranding}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontWeight: 600 }}
                    >
                      {editSubmitting ? 'Saving Settings...' : (
                        <>
                          <Sparkles size={16} />
                          Save Settings
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
