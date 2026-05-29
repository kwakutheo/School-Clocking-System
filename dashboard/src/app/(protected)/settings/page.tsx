'use client';
import { useState, useEffect } from 'react';
import { authApi } from '@/lib/api';
import { useAuthStore, initials as getInitials, type AuthUser } from '@/lib/store';

import { Palette, Sparkles, Upload, X, Link, Pencil } from 'lucide-react';

export default function SettingsPage() {
  const { user, setAuth } = useAuthStore();

  // ── Mode Toggle State ──
  const [isEditing, setIsEditing] = useState(false);

  // ── School Branding Customizer State ──
  const [brandingName, setBrandingName] = useState('');
  const [brandingInitials, setBrandingInitials] = useState('');
  const [brandingColor, setBrandingColor] = useState('');
  const [brandingLogo, setBrandingLogo] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [isBrandingSaving, setIsBrandingSaving] = useState(false);
  const [brandingError, setBrandingError] = useState('');
  const [brandingSuccess, setBrandingSuccess] = useState('');

  // Hydrate school branding variables safely
  useEffect(() => {
    if (user?.tenant) {
      setBrandingName(user.tenant.name ?? '');
      setBrandingInitials((user.tenant.initials || getInitials(user.tenant.name)) ?? '');
      setBrandingColor(user.tenant.primaryColor ?? '#3b82f6');
      setBrandingLogo(user.tenant.logoUrl ?? '');

      // Default to 'url' mode if logo is a standard HTTP/HTTPS link, otherwise keep 'file' mode
      if (user.tenant.logoUrl && (user.tenant.logoUrl.startsWith('http') || user.tenant.logoUrl.startsWith('/'))) {
        setUploadMode('url');
      } else {
        setUploadMode('file');
      }
    }
  }, [user]);

  // Cancel edit mode and reset states
  const handleCancel = () => {
    if (user?.tenant) {
      setBrandingName(user.tenant.name ?? '');
      setBrandingInitials((user.tenant.initials || getInitials(user.tenant.name)) ?? '');
      setBrandingColor(user.tenant.primaryColor ?? '#3b82f6');
      setBrandingLogo(user.tenant.logoUrl ?? '');
      if (user.tenant.logoUrl && (user.tenant.logoUrl.startsWith('http') || user.tenant.logoUrl.startsWith('/'))) {
        setUploadMode('url');
      } else {
        setUploadMode('file');
      }
    }
    setIsEditing(false);
    setBrandingError('');
    setBrandingSuccess('');
  };

  // Handle client-side resizing and Base64 conversion
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBrandingError('');
    setBrandingSuccess('');

    // Limit initial file size to 2MB before processing
    if (file.size > 2 * 1024 * 1024) {
      setBrandingError('File size must be less than 2MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setBrandingError('Please select a valid image file (PNG, JPG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        // Create canvas to downscale the image to an optimized size (max 128x128)
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 128;
        const MAX_HEIGHT = 128;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);

          // Downscale to a compact, highly optimized PNG base64 string
          const compressedBase64 = canvas.toDataURL('image/png');
          setBrandingLogo(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Submit Brand Customization Changes
  const handleBrandingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsBrandingSaving(true);
    setBrandingError('');
    setBrandingSuccess('');

    try {
      const res = await authApi.updateMyBranding({
        primaryColor: brandingColor.trim(),
        logoUrl: brandingLogo.trim(),
      });

      const updatedUser: AuthUser = {
        ...user,
        tenant: res.data,
      };
      const token = localStorage.getItem('access_token') ?? '';
      setAuth(updatedUser, token);

      setBrandingSuccess('School branding updated successfully. Your new theme colors and crest are now active!');
      setIsEditing(false); // Switch back to Read-Only mode on success
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setBrandingError(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Failed to update school branding.');
    } finally {
      setIsBrandingSaving(false);
    }
  };

  const isBrandingUnchanged =
    !user?.tenant ? true : (
      brandingColor.trim().toLowerCase() === user.tenant.primaryColor.trim().toLowerCase() &&
      brandingLogo.trim() === (user.tenant.logoUrl ?? '').trim()
    );

  if (!user) {
    return (
      <div className="loading-center">
        <div className="spinner" />
      </div>
    );
  }

  // Guard view to ensure only school admins can see this panel
  if (user.role !== 'super_admin' && user.role !== 'hr_admin') {
    return (
      <div className="card" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>You do not have permission to view or manage global school settings.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">School Settings</h1>
        <p className="page-subtitle">Configure global school configurations and brand identity</p>
      </div>

      <div className="card" style={{ maxWidth: 520, position: 'relative' }}>

        {/* Edit Button in Read-Only Mode */}
        {!isEditing && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsEditing(true)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              fontSize: '13px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Pencil size={14} /> Edit Branding
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingRight: !isEditing ? '120px' : '0px' }}>
          <div style={{
            background: 'var(--primary-dim, rgba(59,130,246,0.1))',
            color: 'var(--primary)',
            padding: '8px',
            borderRadius: '8px'
          }}>
            <Palette size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              School Brand Identity
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Personalize your school's workspace colors, logo, and overall theme accents.
            </p>
          </div>
        </div>

        <form onSubmit={handleBrandingSubmit}>
          {brandingError && <div className="alert alert-danger">{brandingError}</div>}
          {brandingSuccess && <div className="alert alert-success">{brandingSuccess}</div>}

          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="brandName">School Name</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="brandName"
                  className="form-input"
                  value={brandingName}
                  readOnly
                  placeholder="e.g. Otwetiri M/A Basic School"
                  style={{
                    opacity: 0.75,
                    background: 'var(--bg-card-alt, rgba(255,255,255,0.02))',
                    cursor: 'default'
                  }}
                />
                <span style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '2px 6px',
                  borderRadius: '4px', border: '1px solid var(--border)', whiteSpace: 'nowrap'
                }}>Central Control Only</span>
              </div>
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>School name can only be changed from the Central Management Dashboard.</small>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="brandInitials">School Initials (Used for Employee Codes)</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="brandInitials"
                  className="form-input"
                  value={brandingInitials}
                  readOnly
                  placeholder="e.g. OB"
                  maxLength={4}
                  style={{
                    opacity: 0.75,
                    background: 'var(--bg-card-alt, rgba(255,255,255,0.02))',
                    cursor: 'default',
                    letterSpacing: '4px',
                    fontWeight: 700,
                    fontSize: '16px'
                  }}
                />
                <span style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '2px 6px',
                  borderRadius: '4px', border: '1px solid var(--border)', whiteSpace: 'nowrap'
                }}>Central Control Only</span>
              </div>
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>School initials can only be changed from the Central Management Dashboard.</small>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="brandColor">Theme & Accents (Primary Brand Color)</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{
                  position: 'relative',
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  cursor: !isEditing ? 'default' : 'pointer',
                  background: brandingColor || '#3b82f6',
                  flexShrink: 0
                }}>
                  {isEditing && (
                    <input
                      id="brandColor"
                      type="color"
                      value={brandingColor && brandingColor.startsWith('#') ? brandingColor : '#3b82f6'}
                      onChange={(e) => setBrandingColor(e.target.value)}
                      title="Choose school primary brand color"
                      aria-label="Choose school primary brand color"
                      style={{
                        position: 'absolute',
                        top: -5,
                        left: -5,
                        width: '60px',
                        height: '60px',
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                    />
                  )}
                </div>
                <input
                  id="brandColorHex"
                  className="form-input"
                  value={brandingColor}
                  onChange={(e) => setBrandingColor(e.target.value)}
                  placeholder="#3b82f6"
                  pattern="^#([A-Fa-f0-9]{6})$"
                  required
                  disabled={!isEditing}
                  title="School primary brand color hex code"
                  aria-label="School primary brand color hex code"
                  style={{
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    opacity: !isEditing ? 0.75 : 1,
                    background: !isEditing ? 'var(--bg-card-alt, rgba(255,255,255,0.02))' : 'var(--bg-input)',
                    cursor: !isEditing ? 'default' : 'text'
                  }}
                />
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ margin: 0 }}>School Crest / Logo</label>
                {isEditing && (
                  <div style={{ display: 'inline-flex', background: 'var(--bg-card-alt, rgba(255,255,255,0.04))', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setUploadMode('file')}
                      style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        border: 0,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: uploadMode === 'file' ? 'var(--primary)' : 'transparent',
                        color: uploadMode === 'file' ? '#fff' : 'var(--text-secondary)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Upload size={12} /> Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('url')}
                      style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        border: 0,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: uploadMode === 'url' ? 'var(--primary)' : 'transparent',
                        color: uploadMode === 'url' ? '#fff' : 'var(--text-secondary)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Link size={12} /> Image URL
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                /* ── Edit Mode: File / URL Input Options ── */
                uploadMode === 'file' ? (
                  brandingLogo ? (
                    <div style={{
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      background: 'var(--bg-card-alt, rgba(255,255,255,0.02))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden'
                        }}>
                          <img
                            src={brandingLogo}
                            alt="Uploaded school crest"
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                            School Crest Emblem
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {brandingLogo.startsWith('data:') ? 'Optimized client-side image loaded' : 'External image link configured'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBrandingLogo('')}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: 0,
                          padding: '6px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Remove Crest"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => document.getElementById('crest-file-picker')?.click()}
                      style={{
                        border: '2px dashed var(--border)',
                        borderRadius: '10px',
                        padding: '24px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'var(--bg-card-alt, rgba(255,255,255,0.02))',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = 'rgba(59,130,246,0.02)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--bg-card-alt, rgba(255,255,255,0.02))';
                      }}
                    >
                      <input
                        id="crest-file-picker"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        title="Upload school crest logo file"
                        aria-label="Upload school crest logo file"
                        style={{ display: 'none' }}
                      />
                      <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: '8px' }} />
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Click to upload school crest
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        PNG, JPG, or SVG up to 2MB
                      </div>
                    </div>
                  )
                ) : (
                  <input
                    id="brandLogo"
                    className="form-input"
                    value={brandingLogo}
                    onChange={(e) => setBrandingLogo(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                )
              ) : (
                /* ── Read-Only Mode: Pure Visual Logo Card ── */
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px',
                  background: 'var(--bg-card-alt, rgba(255,255,255,0.02))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {brandingLogo ? (
                      <img
                        src={brandingLogo}
                        alt="Current school crest"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <Palette size={24} style={{ color: 'var(--text-secondary)' }} />
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                      Active School Crest
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                      {brandingLogo ? (
                        brandingLogo.startsWith('data:') ? 'Custom local logo uploaded' : brandingLogo
                      ) : (
                        'No school crest logo uploaded yet'
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Logo Preview Container (URL Input Mode Only) */}
            {isEditing && uploadMode === 'url' && brandingLogo && (
              <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                  Logo Preview:
                </span>
                <div style={{
                  background: 'var(--bg-card-alt, #151515)',
                  border: '1px dashed var(--border)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  minHeight: '80px'
                }}>
                  <img
                    src={brandingLogo}
                    alt="Brand Logo Preview"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    style={{ maxHeight: '60px', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons: Displayed in Edit Mode Only */}
          {isEditing && (
            <div style={{ marginTop: 24, display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isBrandingSaving || isBrandingUnchanged}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (isBrandingSaving || isBrandingUnchanged) ? 0.5 : 1,
                  cursor: (isBrandingSaving || isBrandingUnchanged) ? 'not-allowed' : 'pointer'
                }}
              >
                {isBrandingSaving ? 'Saving...' : (
                  <>
                    <Sparkles size={16} /> Save Branding Details
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={isBrandingSaving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <X size={16} /> Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </>
  );
}
