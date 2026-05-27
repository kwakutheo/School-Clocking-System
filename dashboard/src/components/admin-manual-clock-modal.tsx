'use client';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { attendanceApi } from '@/lib/api';
import useSWR from 'swr';
import { X, UserCheck, Clock, LogIn, LogOut, AlertTriangle, CheckCircle } from 'lucide-react';
import { EmployeeCombobox } from './employee-combobox';

/** Returns the current local time as "HH:mm" — refreshes every 10 s so the max cap stays accurate. */
function useCurrentTime() {
  const [now, setNow] = useState(() => format(new Date(), 'HH:mm'));
  useEffect(() => {
    const id = setInterval(() => setNow(format(new Date(), 'HH:mm')), 10_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const clockableFetcher = () => attendanceApi.clockableEmployees().then((r) => r.data);

export function AdminManualClockModal({ onClose, onSuccess }: Props) {
  const { data: employees } = useSWR('clockable-employees', clockableFetcher);
  const currentTime = useCurrentTime(); // "HH:mm" — used as max cap on the time input

  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState<'clock_in' | 'clock_out'>('clock_in');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customTime, setCustomTime] = useState(''); // stores "HH:mm" only
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const eligibleEmployees = employees ?? [];
  const selectedEmp = eligibleEmployees.find((e: any) => e.id === employeeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!employeeId) { setError('Please select an employee.'); return; }
    if (!note.trim()) { setError('A reason/note is required for the audit trail.'); return; }
    if (useCustomTime && !customTime) { setError('Please enter a valid time.'); return; }

    // Build ISO timestamp: combine today\'s local date with the chosen HH:mm time.
    // This guarantees the entry is always anchored to the current working day.
    let timestamp: string | undefined;
    if (useCustomTime && customTime) {
      const [hours, minutes] = customTime.split(':').map(Number);
      const today = new Date();
      today.setHours(hours, minutes, 0, 0);
      if (isNaN(today.getTime())) { setError('Invalid time entered.'); return; }
      // Reject times that are in the future (belt-and-suspenders guard alongside the input max)
      if (today > new Date()) { setError('The selected time cannot be in the future.'); return; }
      timestamp = today.toISOString();
    }

    setLoading(true);
    try {
      await attendanceApi.adminManualClock({ employeeId, type, timestamp, note: note.trim() });
      setSuccess(
        `Successfully recorded ${type === 'clock_in' ? 'Clock In' : 'Clock Out'} for ${selectedEmp?.user?.fullName}.`,
      );
      setTimeout(() => { onSuccess(); onClose(); }, 1800);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)', zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%', maxWidth: 520,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          zIndex: 1001,
          padding: 28,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(59,130,246,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserCheck size={18} color="var(--primary)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                Manual Clock Override
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                Admin action · recorded in audit log
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            id="manual-clock-modal-close"
            title="Close dialog"
            aria-label="Close dialog"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: 4, borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Warning banner */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 20,
        }}>
          <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            You cannot clock yourself in/out. Use this only when an employee cannot access their phone.
            All manual entries are permanently flagged in the audit trail.
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Employee selector */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label htmlFor="manual-clock-employee" style={{ fontSize: 13, fontWeight: 600 }}>
              Employee <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <EmployeeCombobox
              employees={eligibleEmployees}
              value={employeeId}
              onChange={setEmployeeId}
              placeholder="— Select Employee —"
            />
          </div>

          {/* Action type */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Action <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              {(['clock_in', 'clock_out'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  id={`manual-clock-type-${t}`}
                  onClick={() => setType(t)}
                  style={{
                    flex: 1, padding: '10px 12px',
                    borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    border: type === t ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: type === t ? 'rgba(59,130,246,0.1)' : 'var(--bg-card)',
                    color: type === t ? 'var(--primary)' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'clock_in' ? <LogIn size={15} /> : <LogOut size={15} />}
                  {t === 'clock_in' ? 'Clock In' : 'Clock Out'}
                </button>
              ))}
            </div>
          </div>

          {/* Custom timestamp toggle */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              <input
                id="manual-clock-custom-time-toggle"
                type="checkbox"
                checked={useCustomTime}
                onChange={(e) => setUseCustomTime(e.target.checked)}
              />
              <Clock size={14} />
              Set a specific time (leave unchecked to use current time)
            </label>
            {useCustomTime && (
              <div style={{ marginTop: 8 }}>
                <input
                  id="manual-clock-custom-time"
                  type="time"
                  className="form-input"
                  aria-label="Manual clock time (today only)"
                  title="Select a time on today's working day"
                  value={customTime}
                  max={currentTime}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Extra guard: reject times beyond the current minute
                    if (val && val > currentTime) return;
                    setCustomTime(val);
                  }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Time is applied to <strong>today</strong> ({format(new Date(), 'EEE, MMM d yyyy')}).
                  Cannot be set in the future or on a different day.
                </p>
              </div>
            )}
          </div>

          {/* Note */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label htmlFor="manual-clock-note" style={{ fontSize: 13, fontWeight: 600 }}>
              Reason / Note <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              id="manual-clock-note"
              className="form-input"
              rows={3}
              placeholder="e.g. Employee's phone was dead. Confirmed arrival at 08:05."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ resize: 'vertical', minHeight: 72 }}
              required
            />
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              color: 'var(--danger)', fontSize: 13,
            }}>
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
          {success && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              color: 'var(--success)', fontSize: 13,
            }}>
              <CheckCircle size={14} />
              {success}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              id="manual-clock-cancel"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              id="manual-clock-submit"
              className="btn btn-primary"
              disabled={loading || !employeeId || !note.trim()}
            >
              {loading ? 'Saving…' : `Confirm ${type === 'clock_in' ? 'Clock In' : 'Clock Out'}`}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
