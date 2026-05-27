'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import QRCode from 'qrcode';
import { branchesApi } from '@/lib/api';
import { can } from '@/lib/permissions';

const fetcher = () => branchesApi.list().then((r) => r.data);

function QrCodeImage({ text, size = 180 }: { text: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const generate = async () => {
      try {
        const canvas = document.createElement('canvas');
        // Use High error correction to allow for logo overlay
        await QRCode.toCanvas(canvas, text, {
          width: size * 4, // High resolution for printing
          margin: 1,
          errorCorrectionLevel: 'H',
          color: { dark: '#000', light: '#fff' }
        });

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const logo = new Image();
          logo.src = '/logo.png';
          await new Promise((resolve) => {
            logo.onload = resolve;
            logo.onerror = resolve;
          });

          if (logo.complete && logo.naturalWidth > 0) {
            const qrSize = canvas.width;
            const logoSize = qrSize * 0.22; // 22% of QR size
            const x = (qrSize - logoSize) / 2;
            const y = (qrSize - logoSize) / 2;

            // White border/background for logo
            ctx.fillStyle = '#fff';
            ctx.fillRect(x - 5, y - 5, logoSize + 10, logoSize + 10);
            ctx.drawImage(logo, x, y, logoSize, logoSize);
          }
        }
        setDataUrl(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('QR Generation Error:', err);
        setDataUrl(null);
      }
    };

    generate();
  }, [text, size]);

  if (!dataUrl) return <div style={{ width: size, height: size, background: 'rgba(0,0,0,0.1)', borderRadius: 8 }} />;

  return (
    <img
      src={dataUrl}
      alt="QR Code"
      style={{ width: size, height: size, borderRadius: 8, border: '1px solid var(--border)' }}
    />
  );
}

function PasswordModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  isLoading: boolean;
}) {
  const [password, setPassword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          padding: 28,
          maxWidth: 400,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Confirm Password</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
          Enter your login password to regenerate this branch QR code. The old code will become invalid immediately.
        </div>

        <div className="form-group">
          <label htmlFor="modalPassword">Your Password</label>
          <input
            id="modalPassword"
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password.length >= 6 && !isLoading) {
                onConfirm(password);
              }
            }}
            className="form-input"
            style={{ marginBottom: 24 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            className="btn"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(password)}
            disabled={password.length < 6 || isLoading}
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {isLoading ? '⏳ Verifying…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BranchCard({ branch, onEdit, onDelete, canDelete }: { branch: any; onEdit: () => void; onDelete: () => void; canDelete: boolean }) {
  const [qrCode, setQrCode] = useState<string | null>(branch.qrCode ?? null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleRegenerate = async (password: string) => {
    setIsRegenerating(true);
    try {
      const res = await branchesApi.regenerateQr(branch.id, password);
      setQrCode(res.data.qrCode);
      setShowPasswordModal(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to regenerate QR code.';
      alert(msg);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopy = () => {
    if (qrCode) {
      navigator.clipboard.writeText(qrCode);
      alert('QR code copied to clipboard!');
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${branch.name}</title>
          <style>
            @page { size: A4; margin: 0; }
            body { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
              font-family: system-ui, sans-serif; 
              background: #fff;
            }
            .container { 
              text-align: center; 
              width: 100%;
              max-width: 800px;
            }
            img { 
              width: 500px; 
              height: 500px; 
              border: 4px solid #000; 
              border-radius: 24px; 
              padding: 20px;
              background: #fff;
            }
            h1 { 
              margin: 48px 0 12px; 
              font-size: 56px; 
              font-weight: 800;
              letter-spacing: -1px;
            }
            p { 
              margin: 0; 
              color: #4b5563; 
              font-size: 28px; 
              font-weight: 500;
            }
            .hint { 
              margin-top: 40px; 
              padding: 16px 24px; 
              background: #f3f4f6; 
              border-radius: 12px; 
              font-size: 18px; 
              color: #374151; 
            }
            @media print { 
              .no-print { display: none; } 
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 60px; padding-top: 40px;">
              <img src="/logo.png" style="width: 60px; height: 60px; border: none; padding: 0; border-radius: 12px;" />
              <div style="font-size: 32px; font-weight: 800; letter-spacing: -1px; color: #111827;">TK Clocking System</div>
            </div>

            <img src="${printRef.current.querySelector('img')?.src}" alt="QR Code" />
            <h1>${branch.name}</h1>
            <p>Scan to clock in / out</p>
            <div class="hint no-print">Print this page on A4 paper and paste it at the entrance.</div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{branch.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-ghost" onClick={onEdit} aria-label="Edit Branch">✏️</button>
          {canDelete && (
            <button className="btn btn-sm btn-danger-ghost" onClick={onDelete} aria-label="Delete Branch">🗑️</button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-card-alt)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Latitude</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{branch.latitude ? Number(branch.latitude).toFixed(6) : '—'}</div>
        </div>
        <div style={{ background: 'var(--bg-card-alt)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Longitude</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{branch.longitude ? Number(branch.longitude).toFixed(6) : '—'}</div>
        </div>
        <div style={{ background: 'var(--bg-card-alt)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Geofence Radius</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{branch.allowedRadius ? `${branch.allowedRadius}m` : '300m'}</div>
            </div>
            {branch.latitude && branch.longitude && (
              <a
                href={`https://maps.google.com/?q=${branch.latitude},${branch.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-ghost"
                style={{ fontSize: 12 }}
              >
                🗺 View Map
              </a>
            )}
          </div>
        </div>
      </div>

      <div style={{ 
        marginTop: 'auto', 
        padding: '20px', 
        background: 'var(--bg-card-alt)', 
        borderRadius: 16, 
        border: '1px dashed var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, textAlign: 'center' }}>
          Branch Access QR Code
        </div>
        
        {qrCode ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div ref={printRef} style={{ background: '#fff', padding: 12, borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <QrCodeImage text={qrCode} size={160} />
            </div>
            <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 20 }}>
              <button onClick={handlePrint} className="btn btn-sm btn-ghost" style={{ flex: 1, background: 'var(--bg-card)' }}>
                🖨️ Print
              </button>
              <button
                onClick={() => setShowPasswordModal(true)}
                disabled={isRegenerating}
                className="btn btn-sm btn-primary"
                style={{ flex: 1 }}
                title="Regenerate QR Code"
              >
                {isRegenerating ? '⏳' : '🔄 Refresh'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>No QR code generated yet.</p>
            <button
              onClick={() => setShowPasswordModal(true)}
              disabled={isRegenerating}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {isRegenerating ? 'Generating…' : 'Generate QR Code'}
            </button>
          </div>
        )}
      </div>

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onConfirm={handleRegenerate}
        isLoading={isRegenerating}
      />
    </div>
  );
}

export default function BranchesPage() {
  const { data, isLoading, mutate } = useSWR('branches', fetcher);
  const branches: any[] = data ?? [];
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
    allowedRadius: '300',
  });
  const [mapsUrl, setMapsUrl] = useState('');

  const resetForm = () => {
    setForm({ name: '', latitude: '', longitude: '', allowedRadius: '300' });
    setMapsUrl('');
    setEditingId(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (branch: any) => {
    setForm({
      name: branch.name ?? '',
      latitude: branch.latitude != null ? String(branch.latitude) : '',
      longitude: branch.longitude != null ? String(branch.longitude) : '',
      allowedRadius: branch.allowedRadius != null ? String(branch.allowedRadius) : '300',
    });
    setMapsUrl('');
    setEditingId(branch.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const payload = {
      name: form.name,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      allowedRadius: form.allowedRadius ? Number(form.allowedRadius) : undefined,
    };

    try {
      if (editingId) {
        await branchesApi.update(editingId, payload);
      } else {
        await branchesApi.create(payload);
      }
      await mutate();
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await branchesApi.delete(id);
      await mutate();
      setDeleteConfirm(null);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Failed to delete branch.');
    }
  };

  const userRole = useMemo(() =>
    typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('user') ?? '{}')?.role as string
      : ''
  , []);

  if (!can(userRole, 'branches.manage')) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ color: 'var(--danger)' }}>🚫</div>
        <p className="empty-state-text">Access Denied. You do not have permission to manage branches.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Branches</h1>
          <p className="page-subtitle">Physical attendance locations and geofence settings</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Branch</button>
      </div>

      {isLoading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {branches.map((branch: any) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              onEdit={() => openEdit(branch)}
              onDelete={() => setDeleteConfirm(branch.id)}
              canDelete={can(userRole, 'branches.manage')}
            />
          ))}

          {branches.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state-icon">📍</div>
              <p className="empty-state-text">No branches configured yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Branch' : 'Add Branch'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close Modal">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="branchName">Branch Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    id="branchName"
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="e.g. Accra Central"
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="mapsUrl">Google Maps URL <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(paste to auto-fill coordinates)</span></label>
                  <input
                    id="mapsUrl"
                    className="form-input"
                    type="text"
                    value={mapsUrl}
                    placeholder="https://www.google.com/maps/place/..."
                    onChange={(e) => {
                      const url = e.target.value;
                      setMapsUrl(url);
                      const match = url.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
                      if (match) {
                        setForm((prev) => ({ ...prev, latitude: match[1], longitude: match[2] }));
                      }
                    }}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <a
                    href={`https://www.google.com/maps/@${form.latitude || '0'},${form.longitude || '0'},15z`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    style={{ flexShrink: 0 }}
                    onClick={(e) => {
                      if (!form.latitude || !form.longitude) {
                        e.preventDefault();
                        window.open('https://www.google.com/maps', '_blank');
                      }
                    }}
                  >
                    🗺 Pick on Google Maps
                  </a>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Right-click a spot → copy coordinates → paste above
                  </span>
                </div>
                <div className="form-group">
                  <label htmlFor="latitude">Latitude <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    id="latitude"
                    className="form-input"
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    placeholder="e.g. 5.6037"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="longitude">Longitude <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    id="longitude"
                    className="form-input"
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    placeholder="e.g. -0.1870"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="radius">Geofence Radius (meters) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    id="radius"
                    className="form-input"
                    type="number"
                    value={form.allowedRadius}
                    onChange={(e) => setForm({ ...form, allowedRadius: e.target.value })}
                    placeholder="300"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Branch</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <p>Are you sure you want to delete this branch? This action cannot be undone.</p>
            <div className="modal-footer">
              <button className="btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
