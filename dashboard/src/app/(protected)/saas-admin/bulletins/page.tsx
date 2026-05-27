'use client';
import { useEffect, useState } from 'react';
import { saasAdminApi } from '@/lib/api';
import {
  Megaphone, AlertCircle, CheckCircle, Info, Hammer,
  Trash2, Plus, X, ToggleLeft, ToggleRight, Loader2,
  Globe, Target, School, Search, CheckSquare, Square,
} from 'lucide-react';

interface Bulletin {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'maintenance';
  isActive: boolean;
  createdAt: string;
  targetTenantIds: string[] | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function BulletinsManagerPage() {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formType, setFormType] = useState<'info' | 'warning' | 'success' | 'maintenance'>('info');

  // Audience picker state
  const [audienceMode, setAudienceMode] = useState<'all' | 'selected'>('all');
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [tenantSearch, setTenantSearch] = useState('');

  const fetchBulletins = () => {
    setLoading(true);
    saasAdminApi.getBulletins()
      .then((res) => {
        setBulletins(res.data);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to fetch platform bulletins.');
        setLoading(false);
      });
  };

  const fetchTenants = () => {
    saasAdminApi.listTenants()
      .then((res) => {
        setTenants(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error('Failed to load school list:', err);
      });
  };

  useEffect(() => {
    fetchBulletins();
    fetchTenants();
  }, []);

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormType('info');
    setAudienceMode('all');
    setSelectedTenantIds([]);
    setTenantSearch('');
    setFormError(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setShowComposeModal(true);
  };

  const handleCompose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      setFormError('Please fill in both title and content fields.');
      return;
    }
    if (audienceMode === 'selected' && selectedTenantIds.length === 0) {
      setFormError('Please select at least one school, or switch audience to "All Schools".');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    saasAdminApi.publishBulletin({
      title: formTitle,
      content: formContent,
      type: formType,
      targetTenantIds: audienceMode === 'selected' ? selectedTenantIds : undefined,
    })
      .then(() => {
        setFormLoading(false);
        setShowComposeModal(false);
        resetForm();
        fetchBulletins();
      })
      .catch((err) => {
        console.error(err);
        setFormError(err.response?.data?.message || 'Failed to publish bulletin announcement.');
        setFormLoading(false);
      });
  };

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    saasAdminApi.updateBulletin(id, { isActive: !currentStatus })
      .then(() => {
        setBulletins(prev => prev.map(b => b.id === id ? { ...b, isActive: !currentStatus } : b));
      })
      .catch((err) => {
        console.error(err);
        alert('Failed to update bulletin status.');
      });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you absolutely sure you want to permanently delete this bulletin? This action is irreversible.')) {
      return;
    }
    saasAdminApi.deleteBulletin(id)
      .then(() => {
        setBulletins(prev => prev.filter(b => b.id !== id));
      })
      .catch((err) => {
        console.error(err);
        alert('Failed to delete bulletin.');
      });
  };

  const toggleTenantSelection = (tenantId: string) => {
    setSelectedTenantIds(prev =>
      prev.includes(tenantId) ? prev.filter(id => id !== tenantId) : [...prev, tenantId],
    );
  };

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
    t.slug.toLowerCase().includes(tenantSearch.toLowerCase()),
  );

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'warning':
        return (
          <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', fontSize: '12px' }}>
            <AlertCircle size={13} /> Danger Alert
          </span>
        );
      case 'success':
        return (
          <span style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', fontSize: '12px' }}>
            <CheckCircle size={13} /> Update Success
          </span>
        );
      case 'maintenance':
        return (
          <span style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', fontSize: '12px' }}>
            <Hammer size={13} /> Maintenance
          </span>
        );
      default:
        return (
          <span style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', fontSize: '12px' }}>
            <Info size={13} /> Platform Info
          </span>
        );
    }
  };

  const getAudienceBadge = (bulletin: Bulletin) => {
    const ids = bulletin.targetTenantIds;
    if (!ids || ids.length === 0) {
      return (
        <span style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, padding: '3px 9px', borderRadius: '10px', fontSize: '11px' }}>
          <Globe size={11} /> All Schools
        </span>
      );
    }
    // Resolve names from the cached tenants list
    const names = ids.map(id => tenants.find(t => t.id === id)?.name ?? id);
    const label = names.length <= 2 ? names.join(', ') : `${names[0]} +${names.length - 1} more`;
    return (
      <span style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, padding: '3px 9px', borderRadius: '10px', fontSize: '11px' }} title={names.join(', ')}>
        <Target size={11} /> {label}
      </span>
    );
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Announcements
          </h1>
          <p className="page-sub" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Broadcast platform announcements globally or target specific schools.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', fontWeight: 600 }}
        >
          <Plus size={18} /> Compose Message
        </button>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="loading-center" style={{ minHeight: '40vh' }}>
          <div className="spinner" />
        </div>
      ) : error ? (
        <div className="error-card card">
          <h3 className="text-danger">Failed to Load Bulletins</h3>
          <p>{error}</p>
        </div>
      ) : bulletins.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 40px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px' }}>
          <Megaphone size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 20px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>No Bulletins Broadcasted Yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '400px', margin: '8px auto 0' }}>
            Create and send your first platform announcement — broadcast to everyone or select specific schools.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          {bulletins.map((bulletin) => (
            <div
              key={bulletin.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '24px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                transition: 'all 0.3s ease',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {getTypeBadge(bulletin.type)}
                    {getAudienceBadge(bulletin)}
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Published on {new Date(bulletin.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {bulletin.title}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                    {bulletin.content}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', alignSelf: 'flex-start', paddingTop: '4px' }}>
                  {/* Toggle Active state */}
                  <button
                    onClick={() => handleToggleActive(bulletin.id, bulletin.isActive)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px',
                      color: bulletin.isActive ? 'var(--success)' : 'var(--text-secondary)',
                      fontSize: '13px', fontWeight: 600, padding: 0,
                    }}
                    title={bulletin.isActive ? 'Announcement is active' : 'Announcement is hidden'}
                  >
                    {bulletin.isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    <span>{bulletin.isActive ? 'Active' : 'Draft'}</span>
                  </button>

                  <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDelete(bulletin.id)}
                    className="text-danger"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '8px', borderRadius: '8px', transition: 'background 0.2s',
                    }}
                    title="Delete Announcement"
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compose Announcement Modal */}
      {showComposeModal && (
        <div className="modal-overlay" onClick={() => setShowComposeModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '640px', padding: '32px', position: 'relative', animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowComposeModal(false)}
              title="Close"
              aria-label="Close"
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
              <Megaphone size={22} style={{ color: 'var(--primary)' }} />
              Compose Platform Bulletin
            </h3>

            {formError && (
              <div className="error-card card" style={{ padding: '12px 16px', marginBottom: '20px', borderRadius: '8px' }}>
                <span className="text-danger" style={{ fontSize: '13px', fontWeight: 600 }}>⚠️ {formError}</span>
              </div>
            )}

            <form onSubmit={handleCompose} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Title */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                  Bulletin Title
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Scheduled Engine Maintenance this Sunday"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                  Notification Banner Type
                </label>
                <select
                  className="form-input"
                  title="Notification Banner Type"
                  aria-label="Notification Banner Type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                >
                  <option value="info">🔵 Platform Info (Blue)</option>
                  <option value="warning">🔴 Alert/Urgent Danger (Red)</option>
                  <option value="success">🟢 Update Success (Green)</option>
                  <option value="maintenance">🟡 Maintenance Downtime (Yellow)</option>
                </select>
              </div>

              {/* Content */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                  Announcement Message Content
                </label>
                <textarea
                  className="form-input"
                  placeholder="Provide details about the bulletin. School administrators will see this announcement in their dashboard."
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', resize: 'vertical' }}
                  required
                />
              </div>

              {/* ── Audience Picker ─────────────────────────────────── */}
              <div>
                <label style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '10px', display: 'block' }}>
                  Audience
                </label>

                {/* Mode toggle tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setAudienceMode('all')}
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: '8px', border: '2px solid',
                      borderColor: audienceMode === 'all' ? 'var(--primary)' : 'var(--border)',
                      background: audienceMode === 'all' ? 'rgba(99,102,241,0.08)' : 'var(--bg-base)',
                      color: audienceMode === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Globe size={15} /> All Schools
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudienceMode('selected')}
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: '8px', border: '2px solid',
                      borderColor: audienceMode === 'selected' ? 'var(--primary)' : 'var(--border)',
                      background: audienceMode === 'selected' ? 'rgba(99,102,241,0.08)' : 'var(--bg-base)',
                      color: audienceMode === 'selected' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Target size={15} /> Selected Schools
                  </button>
                </div>

                {/* School multi-select picker */}
                {audienceMode === 'selected' && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                    {/* Search bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                      <Search size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                      <input
                        type="text"
                        placeholder="Search schools..."
                        value={tenantSearch}
                        onChange={e => setTenantSearch(e.target.value)}
                        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--text-primary)' }}
                      />
                      {selectedTenantIds.length > 0 && (
                        <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                          {selectedTenantIds.length} selected
                        </span>
                      )}
                    </div>

                    {/* School list */}
                    <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      {filteredTenants.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                          No schools found
                        </div>
                      ) : (
                        filteredTenants.map(tenant => {
                          const isSelected = selectedTenantIds.includes(tenant.id);
                          return (
                            <button
                              key={tenant.id}
                              type="button"
                              onClick={() => toggleTenantSelection(tenant.id)}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--border)',
                                background: isSelected ? 'rgba(99,102,241,0.06)' : 'var(--card-bg)',
                                cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                              }}
                              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(99,102,241,0.03)'; }}
                              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'var(--card-bg)'; }}
                            >
                              {isSelected
                                ? <CheckSquare size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                : <Square size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                              }
                              <School size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{tenant.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>{tenant.slug}</div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {audienceMode === 'all' && (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    📢 This announcement will be visible to every registered school on the platform.
                  </p>
                )}
              </div>
              {/* ── End Audience Picker ──────────────────────────────── */}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600 }}
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', fontWeight: 600 }}
                  disabled={formLoading}
                >
                  {formLoading ? (
                    <><Loader2 className="spinner" size={16} /> Publishing...</>
                  ) : (
                    <><Megaphone size={16} /> Broadcast Announcement</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
