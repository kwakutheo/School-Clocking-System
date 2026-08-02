'use client';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { attendanceApi } from '@/lib/api';
import useSWR from 'swr';
import { X, UserCheck, Clock, LogIn, LogOut, AlertTriangle, CheckCircle } from 'lucide-react';
import { EmployeeCombobox } from './employee-combobox';

/** Returns the current local time as "HH:mm" — refreshes every 10 s so the max cap stays accurate. */
function useCurrentTime(offsetMs: number = 0) {
  const getTrueNow = () => new Date(Date.now() + offsetMs);
  const [now, setNow] = useState(() => format(getTrueNow(), 'HH:mm'));
  
  useEffect(() => {
    const id = setInterval(() => setNow(format(getTrueNow(), 'HH:mm')), 10_000);
    return () => clearInterval(id);
  }, [offsetMs]);
  
  return now;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-fills the date picker and enables custom time when viewing a historical date. */
  selectedDate?: string; // 'yyyy-MM-dd'
  /** The exact ms offset from the server clock to the local device clock. */
  serverTimeOffset?: number;
}

const clockableFetcher = () => attendanceApi.clockableEmployees().then((r) => r.data);

const REASON_CATEGORIES = [
  'Forgot to clock in/out',
  'Device / Phone battery died',
  'Network connectivity issues',
  'No phone',
  'Biometric / QR scan failed',
  'Other'
];

export function AdminManualClockModal({ onClose, onSuccess, selectedDate, serverTimeOffset = 0 }: Props) {
  const { data: employees } = useSWR('clockable-employees', clockableFetcher);
  const currentTime = useCurrentTime(serverTimeOffset); // "HH:mm" — used as max cap on the time input

  const getTrueNow = () => new Date(Date.now() + serverTimeOffset);
  const today = getTrueNow();
  const todayDateString = format(today, 'yyyy-MM-dd');

  // Calculate Monday of the current week
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };
  const mondayDate = getMonday(today);
  const mondayDateString = format(mondayDate, 'yyyy-MM-dd');

  // If the caller passes a historical date, pre-fill it and auto-enable custom time.
  const isHistoricalDate = !!selectedDate && selectedDate !== todayDateString;
  const initialDate = selectedDate ?? todayDateString;

  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState<'clock_in' | 'clock_out'>('clock_in');
  const [useCustomTime, setUseCustomTime] = useState(isHistoricalDate);
  const [customDate, setCustomDate] = useState(initialDate);
  const [customTime, setCustomTime] = useState(''); // stores "HH:mm" only
  const [reasonCategory, setReasonCategory] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Determine the effective date for this clock entry
  const effectiveDate = useCustomTime && customDate ? customDate : todayDateString;

  const allEmployees = employees ?? [];
  const eligibleEmployees = allEmployees.filter((e: any) => {
    if (!e.createdAt) return true; // no creation date info → include safely
    const empDate = format(new Date(e.createdAt), 'yyyy-MM-dd');
    return empDate <= effectiveDate;
  });
  const filteredOutCount = allEmployees.length - eligibleEmployees.length;

  const selectedEmp = eligibleEmployees.find((e: any) => e.id === employeeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!employeeId) { setError('Please select an employee.'); return; }
    if (!reasonCategory) { setError('Please select a reason category.'); return; }
    if (reasonCategory === 'Other' && !note.trim()) { setError('A detailed note is required when "Other" is selected.'); return; }
    if (useCustomTime && (!customTime || !customDate)) { setError('Please enter both a valid date and time (leave unchecked to use current date and time).'); return; }

    let timestamp: string | undefined;
    if (useCustomTime && customTime && customDate) {
      const [year, month, day] = customDate.split('-').map(Number);
      const [hours, minutes] = customTime.split(':').map(Number);
      const selectedDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

      if (isNaN(selectedDateTime.getTime())) { setError('Invalid date or time entered.'); return; }
      if (selectedDateTime > getTrueNow()) { setError('The selected date and time cannot be in the future.'); return; }

      const targetDateZero = new Date(year, month - 1, day);
      const targetDayOfWeek = targetDateZero.getDay();
      
      if (targetDayOfWeek === 0 || targetDayOfWeek === 6) {
        setError('Manual clocking is not allowed on weekends.');
        return;
      }

      const minAllowed = getMonday(getTrueNow());
      minAllowed.setHours(0, 0, 0, 0);
      if (targetDateZero < minAllowed) {
        setError('The selected date must be within the current week (Monday onwards).');
        return;
      }

      timestamp = selectedDateTime.toISOString();
    }

    const fullNote = `[${reasonCategory}] ${note.trim()}`;

    setLoading(true);
    try {
      const { offlineApi } = await import('@/lib/offline-api');
      await offlineApi.adminManualClock({ employeeId, type, timestamp, note: fullNote });
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

  const isTodaySelected = customDate === todayDateString;

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
          maxHeight: '90vh', overflowY: 'auto',
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
                    border: type === t ? (t === 'clock_out' ? '2px solid var(--accent)' : '2px solid var(--primary)') : '1px solid var(--border)',
                    background: type === t ? (t === 'clock_out' ? 'var(--accent-dim)' : 'rgba(59,130,246,0.1)') : 'var(--bg-card)',
                    color: type === t ? (t === 'clock_out' ? 'var(--accent)' : 'var(--primary)') : 'var(--text-secondary)',
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
              Set a specific date & time (leave unchecked to use current time)
            </label>
            {useCustomTime && (
              <div style={{ marginTop: 10, display: 'flex', gap: 12, flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="manual-clock-custom-date" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      Date
                    </label>
                    <input
                      id="manual-clock-custom-date"
                      type="date"
                      className="form-input"
                      value={customDate}
                      min={mondayDateString}
                      max={todayDateString}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const [y, m, d] = val.split('-').map(Number);
                          const testDate = new Date(y, m - 1, d);
                          if (testDate.getDay() === 0 || testDate.getDay() === 6) {
                            setError('Weekends are not allowed for manual clocking.');
                            return;
                          } else {
                            setError('');
                          }
                        }
                        setCustomDate(val);
                        if (val === todayDateString && customTime && customTime > currentTime) {
                          setCustomTime(currentTime);
                        }
                        // Clear the selected employee if they were registered after the new date
                        if (employeeId) {
                          const emp = allEmployees.find((e: any) => e.id === employeeId);
                          if (emp?.createdAt) {
                            const empDate = format(new Date(emp.createdAt), 'yyyy-MM-dd');
                            if (empDate > val) setEmployeeId('');
                          }
                        }
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="manual-clock-custom-time" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                      Time
                    </label>
                    <input
                      id="manual-clock-custom-time"
                      type="time"
                      className="form-input"
                      value={customTime}
                      max={isTodaySelected ? currentTime : undefined}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (isTodaySelected && val && val > currentTime) return;
                        setCustomTime(val);
                      }}
                    />
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0 }}>
                  Entry is restricted to the current week (Monday onwards). Future dates/times and weekends are not permitted.
                </p>
                {filteredOutCount > 0 && (
                  <div style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '8px 12px' }}>
                    <strong>{filteredOutCount}</strong> employee{filteredOutCount !== 1 ? 's' : ''} hidden: Registered after this date and cannot be clocked for it.
                  </div>
                )}
                {customDate !== todayDateString && selectedEmp?.shift && (
                  <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 4, background: 'rgba(59,130,246,0.1)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)' }}>
                    <strong>Shift Constraint:</strong> Time must be within {selectedEmp.shift.startTime} - {selectedEmp.shift.endTime}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reason Category */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label htmlFor="manual-clock-reason" style={{ fontSize: 13, fontWeight: 600 }}>
              Select reason <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              id="manual-clock-reason"
              className="form-input"
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              required
            >
              <option value="">— Select Reason —</option>
              {REASON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Note */}
          {reasonCategory === 'Other' && (
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label htmlFor="manual-clock-note" style={{ fontSize: 13, fontWeight: 600 }}>
                Detailed Note <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <textarea
                id="manual-clock-note"
                className="form-input"
                rows={2}
                placeholder="Please provide details for the audit trail..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ resize: 'vertical', minHeight: 60 }}
                required
              />
            </div>
          )}

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
              className={`btn ${type === 'clock_out' ? 'btn-accent' : 'btn-primary'}`}
              disabled={loading}
            >
              {loading ? 'Saving…' : `Confirm ${type === 'clock_in' ? 'Clock In' : 'Clock Out'}`}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
