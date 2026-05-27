'use client';
import { useState, useEffect } from 'react';
import { authApi } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/lib/store';

import { Pencil, X } from 'lucide-react';

export default function ProfilePage() {
  const { user, setAuth } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingFullName, setEditingFullName] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    username: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });



  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName ?? '',
        username: user.username ?? '',
        phone: user.phone ?? '',
        password: '',
        confirmPassword: '',
      });
    }
  }, [user]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    const payload: any = {};
    if (editingFullName) payload.fullName = form.fullName.trim();
    if (editingUsername) payload.username = form.username.trim();
    if (editingPhone) payload.phone = form.phone.trim();
    if (isChangingPassword) payload.password = form.password;

    if (Object.keys(payload).length === 0) return;

    if (isChangingPassword && form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      setIsSaving(false);
      return;
    }

    try {
      const res = await authApi.updateProfile(payload);
      const token = localStorage.getItem('access_token') ?? '';
      setAuth(res.data.user ?? res.data, token);
      setSuccess('Profile updated successfully.');
      setEditingFullName(false);
      setEditingUsername(false);
      setEditingPhone(false);
      setIsChangingPassword(false);
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };



  const isDirty = 
    (editingFullName && form.fullName !== user?.fullName) ||
    (editingUsername && form.username !== user?.username) ||
    (editingPhone && form.phone !== user?.phone) ||
    (isChangingPassword && form.password !== '');

  const isValid = 
    (!editingFullName || form.fullName.trim() !== '') &&
    (!editingUsername || form.username.trim() !== '') &&
    (!editingPhone || form.phone.trim() !== '') &&
    (!isChangingPassword || (form.password.trim() !== '' && form.password === form.confirmPassword));

  const canSave = isDirty && isValid && !isSaving;



  if (!user) {
    return (
      <div className="loading-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Update your account details</p>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label htmlFor="fullName" style={{ margin: 0 }}>Full Name</label>
                <button 
                  type="button" 
                  onClick={() => {
                    if (editingFullName) {
                      setEditingFullName(false);
                      setForm(prev => ({ ...prev, fullName: user?.fullName ?? '' }));
                    } else {
                      setEditingFullName(true);
                    }
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
                >
                  {editingFullName ? <X size={16} /> : <Pencil size={16} />}
                </button>
              </div>
              <input
                id="fullName"
                className="form-input"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                readOnly={!editingFullName}
                required={editingFullName}
                style={{ backgroundColor: !editingFullName ? 'var(--bg-card-alt)' : undefined, opacity: !editingFullName ? 0.7 : 1 }}
              />
            </div>
            
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label htmlFor="username" style={{ margin: 0 }}>Username</label>
                <button 
                  type="button" 
                  onClick={() => {
                    if (editingUsername) {
                      setEditingUsername(false);
                      setForm(prev => ({ ...prev, username: user?.username ?? '' }));
                    } else {
                      setEditingUsername(true);
                    }
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
                >
                  {editingUsername ? <X size={16} /> : <Pencil size={16} />}
                </button>
              </div>
              <input
                id="username"
                className="form-input"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                readOnly={!editingUsername}
                required={editingUsername}
                style={{ backgroundColor: !editingUsername ? 'var(--bg-card-alt)' : undefined, opacity: !editingUsername ? 0.7 : 1 }}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label htmlFor="phone" style={{ margin: 0 }}>Phone Number</label>
                <button 
                  type="button" 
                  onClick={() => {
                    if (editingPhone) {
                      setEditingPhone(false);
                      setForm(prev => ({ ...prev, phone: user?.phone ?? '' }));
                    } else {
                      setEditingPhone(true);
                    }
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
                >
                  {editingPhone ? <X size={16} /> : <Pencil size={16} />}
                </button>
              </div>
              <input
                id="phone"
                className="form-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                readOnly={!editingPhone}
                required={editingPhone}
                placeholder="+233..."
                style={{ backgroundColor: !editingPhone ? 'var(--bg-card-alt)' : undefined, opacity: !editingPhone ? 0.7 : 1 }}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label htmlFor="password" style={{ margin: 0 }}>New Password</label>
                <button 
                  type="button" 
                  onClick={() => {
                    if (isChangingPassword) {
                      setIsChangingPassword(false);
                      setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
                    } else {
                      setIsChangingPassword(true);
                    }
                  }}
                  style={{ 
                    background: 'transparent', 
                    border: '1px solid var(--border)', 
                    borderRadius: 4,
                    cursor: 'pointer', 
                    color: 'var(--text-primary)', 
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 500
                  }}
                >
                  {isChangingPassword ? 'Cancel' : 'Change Password'}
                </button>
              </div>
              <input
                id="password"
                className="form-input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={isChangingPassword ? "Enter new password" : "••••••••"}
                minLength={6}
                readOnly={!isChangingPassword}
                required={isChangingPassword}
                style={{ backgroundColor: !isChangingPassword ? 'var(--bg-card-alt)' : undefined, opacity: !isChangingPassword ? 0.7 : 1 }}
              />
            </div>

            {isChangingPassword && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  className="form-input"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  minLength={6}
                  required
                />
                {form.password !== form.confirmPassword && form.confirmPassword !== '' && (
                  <div style={{ color: 'var(--error)', fontSize: 13, marginTop: 4 }}>
                    Passwords do not match
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: 24 }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={!canSave}
              style={{ opacity: !canSave ? 0.5 : 1, cursor: !canSave ? 'not-allowed' : 'pointer' }}
            >
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>


    </>
  );
}
