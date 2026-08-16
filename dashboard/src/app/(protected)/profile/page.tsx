'use client';
import { useState, useEffect, useRef } from 'react';
import { authApi, usersApi } from '@/lib/api';
import { useAuthStore, type AuthUser, initials } from '@/lib/store';

import { Pencil, X, UserPen, Eye, EyeOff, Camera, Trash2, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, setAuth } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingFullName, setEditingFullName] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    username: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckTimer = useRef<number | null>(null);



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

  // Debounced live username availability check when editing username in profile
  useEffect(() => {
    if (!editingUsername) {
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
      setCheckingUsername(false);
      if (usernameCheckTimer.current) window.clearTimeout(usernameCheckTimer.current);
      return;
    }

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
        // If the username equals current user's username, treat as available
        if (username === user?.username) {
          setUsernameAvailable(true);
          setUsernameSuggestions([]);
        } else {
          setUsernameAvailable(!!res.data?.available);
          setUsernameSuggestions(res.data?.suggestions || []);
        }
      } catch (err) {
        console.warn('Profile username check failed', err);
        setUsernameAvailable(null);
        setUsernameSuggestions([]);
      } finally {
        setCheckingUsername(false);
      }
    }, 350);

    return () => {
      if (usernameCheckTimer.current) window.clearTimeout(usernameCheckTimer.current);
    };
  }, [form.username, form.fullName, editingUsername, user]);



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



  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setError('');
    setSuccess('');

    try {
      const res = await authApi.uploadProfilePhoto(file);
      const token = localStorage.getItem('access_token') ?? '';
      // The backend returns the updated Employee object, but we need to re-fetch me()
      // to update the publicUser payload in the store properly, OR we can just call authApi.me()
      const meRes = await authApi.me();
      setAuth(meRes.data, token);
      setSuccess('Profile photo updated.');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Failed to upload photo.');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;
    
    setIsUploadingPhoto(true);
    setError('');
    setSuccess('');

    try {
      await authApi.removeProfilePhoto();
      const token = localStorage.getItem('access_token') ?? '';
      const meRes = await authApi.me();
      setAuth(meRes.data, token);
      setSuccess('Profile photo removed.');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Failed to remove photo.');
    } finally {
      setIsUploadingPhoto(false);
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
    <div className="dashboard-container">
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
          <UserPen size={28} style={{ color: 'var(--primary)' }} />
          My Profile
        </h1>
        <p className="page-subtitle">
          Update your account details
          </p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <div style={{ position: 'relative', width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 36, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              {isUploadingPhoto ? (
                <Loader2 size={32} className="spinner-lucide" />
              ) : user.photoUrl ? (
                <img src={user.photoUrl} alt={user.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                initials(user.fullName)
              )}
              
              <div 
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'space-around', padding: '4px 0', opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0'}
              >
                {user.photoUrl && (
                  <button type="button" onClick={() => setShowFullImage(true)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 4 }} title="View Full Photo">
                    <Eye size={16} />
                  </button>
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 4 }} title="Upload Photo">
                  <Camera size={16} />
                </button>
                {user.photoUrl && (
                  <button type="button" onClick={handleRemovePhoto} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 }} title="Remove Photo">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/jpeg, image/png, image/webp" style={{ display: 'none' }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>Profile Photo</div>
          </div>

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
              <div style={{ marginTop: 8 }}>
                {checkingUsername && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Checking availability…</div>}
                {usernameAvailable === true && <div style={{ color: 'var(--success)', fontSize: 13 }}>Username is available ✓</div>}
                {usernameAvailable === false && (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ color: 'var(--danger)', marginBottom: 6 }}>Username is taken.</div>
                    {usernameSuggestions.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {usernameSuggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setForm({ ...form, username: s })}
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
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  className="form-input"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={isChangingPassword ? "Enter new password" : "••••••••"}
                  minLength={6}
                  readOnly={!isChangingPassword}
                  required={isChangingPassword}
                  style={{ backgroundColor: !isChangingPassword ? 'var(--bg-card-alt)' : undefined, opacity: !isChangingPassword ? 0.7 : 1, width: '100%', paddingRight: '40px' }}
                />
                {isChangingPassword && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                )}
              </div>
            </div>

            {isChangingPassword && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirmPassword"
                    className="form-input"
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                    minLength={6}
                    required
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
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

      {showFullImage && user.photoUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowFullImage(false)}>
          <img src={user.photoUrl} alt="Full Profile" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8, objectFit: 'contain', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
          <button type="button" onClick={() => setShowFullImage(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
