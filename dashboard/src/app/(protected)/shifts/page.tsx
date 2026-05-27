'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { shiftsApi, calendarApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Clock, Plus, Trash2, Save, Edit, ShieldAlert } from 'lucide-react';
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
    startTime: '08:00',
    endTime: '17:00',
    graceMinutes: 15,
  });

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
      alert(Array.isArray(msg) ? msg.join('\n') : msg);
    }
  };

  const handleClose = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm({ name: '', startTime: '08:00', endTime: '17:00', graceMinutes: 15 });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    try {
      await shiftsApi.delete(id);
      mutate();
    } catch (err) {
      alert('Failed to delete shift');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Shift Management</h1>
          <p className="page-subtitle">Define working hours to track lateness and early departures</p>
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
                        onClick={() => handleDelete(s.id)}
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
