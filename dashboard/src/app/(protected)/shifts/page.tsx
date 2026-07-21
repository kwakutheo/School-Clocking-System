'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { shiftsApi, calendarApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Clock, Plus, Trash2, Save, Edit, ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { can } from '@/lib/permissions';

const fetcher = () => shiftsApi.list().then((r) => r.data);

export default function ShiftsPage() {
  const { data, isLoading, mutate } = useSWR('shifts-list', fetcher);
  const { user } = useAuthStore();
  
  const canManage = can(user?.role, 'shifts.manage');
  const shifts: any[] = data ?? [];

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    startTime: '',
    endTime: '',
    graceMinutes: 0,
  });
  const [notification, setNotification] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });
  const [confirmAction, setConfirmAction] = useState<{ isOpen: boolean; payload: any; message: string; onConfirm: (payload: any) => void }>({ isOpen: false, payload: null, message: '', onConfirm: () => {} });

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ isOpen: true, message, type });
  };

  if (!canManage) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ color: 'var(--danger)' }}><ShieldAlert size={48} /></div>
        <p className="empty-state-text">Access Denied. You do not have permission to manage shifts.</p>
      </div>
    );
  }



  const handleOpenEdit = (shift: any) => {
    setEditingId(shift.id);
    setForm({
      name: shift.name,
      startTime: shift.startTime.slice(0, 5), // Handle HH:mm:ss if returned
      endTime: shift.endTime.slice(0, 5),
      graceMinutes: shift.graceMinutes,
    });
    setShowAdd(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await shiftsApi.update(editingId, {
          ...form,
          graceMinutes: Number(form.graceMinutes),
        });
      } else {
        await shiftsApi.create({
          ...form,
          graceMinutes: Number(form.graceMinutes),
        });
      }
      mutate();
      setShowAdd(false);
      setEditingId(null);
      setForm({ name: '', startTime: '08:00', endTime: '17:00', graceMinutes: 15 });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save shift';
      showAlert(Array.isArray(msg) ? msg.join('\n') : msg, 'error');
    }
  };

  const handleClose = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm({ name: '', startTime: '08:00', endTime: '17:00', graceMinutes: 15 });
  };

  const handleDeleteClick = (id: string) => {
    setConfirmAction({
      isOpen: true,
      payload: id,
      message: 'Are you sure you want to delete this shift?',
      onConfirm: executeDelete
    });
  };

  const executeDelete = async (id: string) => {
    setConfirmAction({ isOpen: false, payload: null, message: '', onConfirm: () => {} });
    try {
      await shiftsApi.delete(id);
      mutate();
    } catch (err) {
      showAlert('Failed to delete shift', 'error');
    }
  };

  return (
    <>
      <Link href="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '24px', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }} className="hover-primary">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
            <Clock size={28} style={{ color: 'var(--primary)' }} />Shift Management</h1>
          <p className="page-subtitle">
            Define working hours to track lateness and early departures</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={18} style={{ marginRight: 8 }} />
            Create New Shift
          </button>
        )}
      </div>

      <div className="table-wrap">
        <div className="table-header">
          <Clock size={20} style={{ marginRight: 8, color: 'var(--primary)' }} />
          <span className="table-title">Configured Shifts</span>
        </div>

        {isLoading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : shifts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏰</div>
            <p className="empty-state-text">No shifts defined yet. Create one to start tracking working hours.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Shift Name</th>
                <th>Working Hours</th>
                <th>Grace Period</th>
                {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>
                    <span style={{ color: 'var(--success)', fontWeight: 500 }}>{s.startTime}</span>
                    <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>→</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{s.endTime}</span>
                  </td>
                  <td>{s.graceMinutes} minutes</td>
                  {canManage && (
                     <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-sm btn-ghost" 
                        onClick={() => handleOpenEdit(s)}
                        aria-label="Edit Shift"
                        title="Edit Shift"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="btn btn-sm btn-ghost" 
                        style={{ color: 'var(--danger)' }} 
                        onClick={() => handleDeleteClick(s.id)}
                        aria-label="Delete Shift"
                        title="Delete Shift"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
              <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => confirmAction.onConfirm(confirmAction.payload)}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Shift' : 'Create New Shift'}</h3>
              <button className="modal-close" onClick={handleClose}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label htmlFor="shiftName">Shift Name</label>
                <input 
                  id="shiftName"
                  className="form-input" 
                  required 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  placeholder="e.g. Morning Shift, Night Shift" 
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="startTime">Start Time</label>
                  <input 
                    id="startTime"
                    type="time" 
                    className="form-input" 
                    required 
                    value={form.startTime} 
                    onChange={e => setForm({...form, startTime: e.target.value})} 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="endTime">End Time</label>
                  <input 
                    id="endTime"
                    type="time" 
                    className="form-input" 
                    required 
                    value={form.endTime} 
                    onChange={e => setForm({...form, endTime: e.target.value})} 
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="graceMinutes">Grace Minutes (Late threshold)</label>
                <input 
                  id="graceMinutes"
                  type="number" 
                  className="form-input" 
                  required 
                  value={form.graceMinutes} 
                  onChange={e => setForm({...form, graceMinutes: Number(e.target.value)})} 
                  placeholder="e.g. 15"
                />
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Clock-ins after {form.startTime} + this many minutes will be flagged as LATE.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={handleClose}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Save size={18} style={{ marginRight: 8 }} />
                  {editingId ? 'Update Shift' : 'Save Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
