'use client';
import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { holidaysApi } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { Calendar, Plus, Trash2, Edit, ShieldAlert, DownloadCloud, ArrowLeft, Repeat, CalendarDays, Settings2, Info } from 'lucide-react';
import Link from 'next/link';
import { can } from '@/lib/permissions';
import { useAuthStore } from '@/lib/store';
import { useGhanaTime } from '@/lib/useServerTimeOffset';
import { useMemo } from 'react';

const fetcher = () => holidaysApi.list().then((r) => r.data);
const fetcherCurrentYear = () => holidaysApi.listCurrentYear().then((r) => r.data);

const GHANA_FIXED_DATES = new Set([
  '01-01', // New Year's Day
  '01-07', // Constitution Day
  '03-06', // Independence Day
  '05-01', // May Day / Workers' Day
  '07-01', // Republic Day
  '09-21', // Founders' Day
  '12-25', // Christmas Day
  '12-26', // Boxing Day
]);

function isGhanaFixedHoliday(dateStr: string, name: string): boolean {
  const mmdd = dateStr.substring(5); // "MM-DD"
  if (GHANA_FIXED_DATES.has(mmdd)) return true;

  const lowerName = name.toLowerCase();
  return (
    lowerName.includes('christmas') ||
    lowerName.includes('boxing') ||
    lowerName.includes('independence') ||
    lowerName.includes('constitution') ||
    lowerName.includes('founders') ||
    (lowerName.includes('new year') && !lowerName.includes('eve')) ||
    lowerName.includes('republic day')
  );
}

export default function HolidaysPage() {
  const { data: holidays = [], isLoading, mutate } = useSWR('/holidays', fetcher);
  const { data: currentYearHolidays = [] } = useSWR('/holidays/current-year', fetcherCurrentYear);
  const { user } = useAuthStore();
  const getGhanaTime = useGhanaTime();
  
  const currentYearStr = getGhanaTime().getFullYear().toString();

  const [showModal, setShowModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResults, setSyncResults] = useState<any[]>([]);
  const [selectedSyncDates, setSelectedSyncDates] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', date: '', isRecurring: true, postponeIfWeekend: false, observedDate: '' });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({ isOpen: false, message: '', type: 'info' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });
  const [clearDateConfirm, setClearDateConfirm] = useState<{ isOpen: boolean }>({ isOpen: false });
  const [syncPrompt, setSyncPrompt] = useState<{ isOpen: boolean; defaultYear: string }>({ isOpen: false, defaultYear: '' });

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ isOpen: true, message, type });
  };

  // Parse YYYY-MM-DD directly to avoid UTC-to-local timezone shifts that can
  // make getUTCDay() report the wrong weekday (e.g. Sunday becoming Saturday).
  const isDateWeekend = (dateStr: string) => {
    if (!dateStr) return false;
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day); // local time – no UTC shift
    const dow = d.getDay();
    return dow === 0 || dow === 6;
  };

  useEffect(() => {
    setForm(prev => {
      let newPostpone = prev.postponeIfWeekend;
      if (prev.isRecurring) {
        newPostpone = true;
      } else {
        const weekend = isDateWeekend(prev.date);
        if (!weekend) newPostpone = false;
        else if (!prev.postponeIfWeekend && isDateWeekend(prev.date)) newPostpone = true;
      }
      if (newPostpone !== prev.postponeIfWeekend) {
        return { ...prev, postponeIfWeekend: newPostpone };
      }
      return prev;
    });
  }, [form.date, form.isRecurring]);

  const { recurring, groupedByYear, sortedYears } = useMemo(() => {
    const recurring: any[] = [];
    const byYear: Record<string, any[]> = {};

    holidays.forEach((h: any) => {
      if (h.isRecurring) {
        recurring.push(h);
      } else {
        const year = format(parseISO(h.date), 'yyyy');
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push(h);
      }
    });

    const sortedYears = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
    return { recurring, groupedByYear: byYear, sortedYears };
  }, [holidays]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: prev[groupName] === undefined ? false : !prev[groupName] }));
  };

  const isGroupExpanded = (groupName: string, isPastYear: boolean = false) => {
    if (expandedGroups[groupName] !== undefined) return expandedGroups[groupName];
    return !isPastYear;
  };

  const currentYearMap = useMemo(() => {
    const map = new Map<string, any>();
    currentYearHolidays.forEach((h: any) => map.set(h.id, h));
    return map;
  }, [currentYearHolidays]);

  const renderHolidayRow = (h: any, index: number) => {
    const currentHoliday = currentYearMap.get(h.id);
    const hasShifted = currentHoliday && !h.observedDate && currentHoliday.effectiveDate !== currentHoliday.originalDateThisYear;

    return (
    <tr 
      key={h.id}
      className="emp-row-animate"
      style={{ 
        background: 'transparent', 
        animationDelay: `${index * 0.05}s`
      }}
    >
      <td style={{ fontWeight: 600 }}>{h.name}</td>
      <td>
        {format(parseISO(h.date), 'dd MMMM')} {h.isRecurring ? '' : format(parseISO(h.date), 'yyyy')}
        {h.observedDate && (
          <div style={{ fontSize: '0.85em', color: 'var(--primary)', marginTop: '4px', fontWeight: 500 }}>
            Observed: {format(parseISO(h.observedDate), 'dd MMMM yyyy')}
          </div>
        )}
        {hasShifted && (
          <div style={{ fontSize: '0.85em', color: 'var(--warning)', marginTop: '4px', fontWeight: 500 }}>
            Moved to: {format(parseISO(currentHoliday.effectiveDate), 'dd MMMM yyyy')}
          </div>
        )}
      </td>
      <td>
        <span className={`badge ${h.isRecurring ? 'badge-blue' : 'badge-amber'}`}>
          {h.isRecurring ? 'Every Year' : 'One-time'}
        </span>
      </td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => openEdit(h)} aria-label="Edit Holiday">
            <Edit size={16} />
          </button>
          <button className="btn btn-sm btn-ghost btn-danger" onClick={() => handleDeleteClick(h.id)} aria-label="Delete Holiday">
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  )};

  const userRole = useMemo(() => user?.role, [user]);

  if (!can(userRole, 'holidays.manage')) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ color: 'var(--danger)' }}><ShieldAlert size={48} /></div>
        <p className="empty-state-text">Access Denied. You do not have permission to manage holidays.</p>
      </div>
    );
  }



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Frontend guard: prevent admin from setting observedDate on a weekend or backward
    if (form.observedDate) {
      if (isDateWeekend(form.observedDate)) {
        showAlert('You cannot manually move a holiday to a weekend. Please select a valid working day (Monday–Friday).', 'error');
        return;
      }
      const [y] = form.observedDate.split('-');
      const origDateStr = form.isRecurring ? `${y}-${form.date.substring(5)}` : form.date;
      if (form.observedDate <= origDateStr) {
        showAlert('The custom observed date must be strictly after the original holiday date.', 'error');
        return;
      }
    }

    try {
      const { offlineApi } = await import('@/lib/offline-api');
      const payload = {
        ...form,
        observedDate: form.observedDate || undefined
      };
      if (editingId) {
        await offlineApi.updateHoliday(editingId, payload);
      } else {
        await offlineApi.createHoliday(payload);
      }
      mutate();
      setShowModal(false);
      setEditingId(null);
      setForm({ name: '', date: '', isRecurring: true, postponeIfWeekend: false, observedDate: '' });
    } catch (err: any) {
      // Extract the most specific message available from the error chain
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message;
      showAlert(serverMsg || (editingId ? 'Failed to update holiday' : 'Failed to add holiday'), 'error');
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const executeDelete = async (id: string) => {
    setDeleteConfirm({ isOpen: false, id: '' });
    try {
      const { offlineApi } = await import('@/lib/offline-api');
      await offlineApi.deleteHoliday(id);
      mutate();
    } catch (err) {
      showAlert('Failed to delete', 'error');
    }
  };

  const openEdit = (h: any) => {
    setForm({ 
      name: h.name, 
      date: h.date, 
      isRecurring: h.isRecurring,
      postponeIfWeekend: h.postponeIfWeekend || false,
      observedDate: h.observedDate || ''
    });
    setEditingId(h.id);
    setShowModal(true);
  };

  const openAdd = () => {
    setForm({ name: '', date: '', isRecurring: true, postponeIfWeekend: false, observedDate: '' });
    setEditingId(null);
    setShowModal(true);
  };

  const handleSyncPublicHolidaysClick = () => {
    const nextYear = getGhanaTime().getFullYear() + 1;
    setSyncPrompt({ isOpen: true, defaultYear: nextYear.toString() });
  };

  const executeSyncPublicHolidays = async (yearStr: string) => {
    setSyncPrompt({ ...syncPrompt, isOpen: false });
    if (!yearStr || isNaN(Number(yearStr))) return;
    
    setIsSyncing(true);
    try {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${yearStr}/GH`);
      if (!res.ok) throw new Error('Failed to fetch from public calendar API');
      const publicHolidays = await res.json();

      // Build a set of existing dates/recurring rules to avoid duplicates
      const existingDates = new Set();
      holidays.forEach((h: any) => {
        existingDates.add(h.date);
        if (h.isRecurring) existingDates.add(h.date.substring(5)); // MM-DD
      });

      const missing = publicHolidays.filter((ph: any) => {
        const mmdd = ph.date.substring(5);
        return !existingDates.has(ph.date) && !existingDates.has(mmdd);
      }).map((ph: any) => ({
        ...ph,
        isFixed: isGhanaFixedHoliday(ph.date, ph.name)
      }));

      if (missing.length === 0) {
        showAlert(`All public holidays for ${yearStr} are already in your system.`, 'info');
        setIsSyncing(false);
        return;
      }

      // Show the review modal instead of a simple confirm
      setSyncResults(missing);
      const initialSelected: Record<string, boolean> = {};
      missing.forEach((m: any) => initialSelected[m.date] = true);
      setSelectedSyncDates(initialSelected);
      setShowSyncModal(true);
    } catch (err) {
      showAlert('Error syncing public holidays. Please try again.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApproveSync = async () => {
    const toAdd = syncResults.filter((h: any) => selectedSyncDates[h.date]);
    if (toAdd.length === 0) {
      showAlert('Please select at least one holiday to import.', 'error');
      return;
    }

    setIsSyncing(true);
    try {
      await Promise.all(toAdd.map((ph: any) => holidaysApi.create({
        name: ph.name,
        date: ph.date,
        isRecurring: ph.isFixed === true,
        postponeIfWeekend: ph.isFixed === true // Ghana public holidays usually postpone
      })));

      mutate();
      setShowSyncModal(false);
      setSyncResults([]);
      showAlert(`Successfully added ${toAdd.length} holidays!`, 'success');
    } catch (err) {
      showAlert('Failed to import holidays.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Link href="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '24px', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }} className="hover-primary">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }} >
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
            <Calendar size={28} style={{ color: 'var(--primary)' }} />
             Holidays</h1>
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '600px', lineHeight: '1.5' }}>
            Manage public and custom holidays for your school. 
          </p>
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '600px', lineHeight: '1.5' }}>
            <strong>Note:</strong> Holidays that fall on weekends will automatically be shifted to the next working day.
          </p>
        </div>
        {can(userRole, 'holidays.manage') && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" onClick={handleSyncPublicHolidaysClick} disabled={isSyncing}>
              <DownloadCloud size={18} style={{ marginRight: 6 }} />
              {isSyncing ? 'Syncing...' : 'Sync Year'}
            </button>
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={18} style={{ marginRight: 6 }} />
              Add Holiday
            </button>
          </div>
        )}
      </div>

      <div className="table-wrap">
        <div className="table-header">
          <Calendar size={20} style={{ marginRight: 8, color: 'var(--primary)' }} />
          <span className="table-title">Public Holidays</span>
        </div>

        {isLoading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : holidays.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏖️</div>
            <p className="empty-state-text">No holidays defined yet.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Holiday Name</th>
                <th>Date</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            {recurring.length > 0 && (
              <tbody key="recurring">
                <tr 
                  onClick={() => toggleGroup('recurring')}
                  style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.02)', borderTop: '2px solid var(--border)', borderBottom: isGroupExpanded('recurring') ? '1px solid var(--border)' : 'none' }}
                >
                  <td colSpan={4} style={{ padding: '12px 16px', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ 
                        fontSize: 10, 
                        opacity: 0.5,
                        display: 'inline-block',
                        transform: isGroupExpanded('recurring') ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                      }}>▶</span>
                      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>Permanent Holidays (Every Year)</span>
                      <span className="badge badge-gray" style={{ fontSize: 11 }}>{recurring.length}</span>
                    </div>
                  </td>
                </tr>
                {isGroupExpanded('recurring') && recurring.map((h, index) => renderHolidayRow(h, index))}
              </tbody>
            )}

            {sortedYears.map(year => {
              const isPastYear = year < currentYearStr;
              const expanded = isGroupExpanded(year, isPastYear);
              const yearHolidays = groupedByYear[year];

              return (
                <tbody key={year}>
                  <tr 
                    onClick={() => toggleGroup(year)}
                    style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.02)', borderTop: '2px solid var(--border)', borderBottom: expanded ? '1px solid var(--border)' : 'none' }}
                  >
                    <td colSpan={4} style={{ padding: '12px 16px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ 
                          fontSize: 10, 
                          opacity: 0.5,
                          display: 'inline-block',
                          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.3s ease'
                        }}>▶</span>
                        <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{year} One-Time Holidays {isPastYear && <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>(Archived)</span>}</span>
                        <span className="badge badge-gray" style={{ fontSize: 11 }}>{yearHolidays.length}</span>
                      </div>
                    </td>
                  </tr>
                  {expanded && yearHolidays.map((h, index) => renderHolidayRow(h, index))}
                </tbody>
              );
            })}
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
            
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)' }}>
              {notification.type === 'error' ? 'Error' : notification.type === 'success' ? 'Success' : 'Notice'}
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {notification.message}
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setNotification({ ...notification, isOpen: false })}
                style={{ minWidth: 120 }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Date Confirm Modal */}
      {clearDateConfirm.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ marginBottom: 20 }}><ShieldAlert size={48} style={{ color: 'var(--warning)', margin: '0 auto' }} /></div>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)' }}>Clear Custom Date?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>Are you sure you want to clear the custom observed date?</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setClearDateConfirm({ isOpen: false })}>Cancel</button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }} onClick={() => { setForm({ ...form, observedDate: '' }); setClearDateConfirm({ isOpen: false }); }}>Yes, Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ marginBottom: 20 }}>
              <ShieldAlert size={48} style={{ color: 'var(--danger)', margin: '0 auto' }} />
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)' }}>Are you sure?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to delete this holiday? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteConfirm({ isOpen: false, id: '' })}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => executeDelete(deleteConfirm.id)}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Prompt Modal */}
      {syncPrompt.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 400, padding: '30px 20px' }}>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: 'var(--text-primary)', textAlign: 'center' }}>Sync Official Holidays</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>
              Enter year to sync official holidays from Ghana (e.g. 2026, 2027):
            </p>
            <div className="form-group">
              <input 
                type="number" 
                className="form-control" 
                value={syncPrompt.defaultYear} 
                onChange={e => setSyncPrompt({ ...syncPrompt, defaultYear: e.target.value })} 
                placeholder="YYYY" 
                autoFocus 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setSyncPrompt({ ...syncPrompt, isOpen: false })}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => executeSyncPublicHolidays(syncPrompt.defaultYear)}>
                Sync Now
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" style={{ maxWidth: 500, padding: '32px', borderRadius: '24px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{editingId ? 'Edit Holiday' : 'Add New Holiday'}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>Configure the date and observation rules.</p>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close Modal" style={{ background: 'var(--bg-card)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="holidayName" style={{ fontWeight: 600 }}>Holiday Name</label>
                  <input id="holidayName" className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Independence Day" style={{ padding: '12px 16px', fontSize: 15 }} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="holidayDate" style={{ fontWeight: 600 }}>Calendar Date</label>
                  <input id="holidayDate" type="date" className="form-input" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} style={{ padding: '12px 16px', fontSize: 15 }} />
                </div>
              </div>

              <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Settings2 size={14} /> Observation Rules
              </div>
              
              <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '32px' }}>
                
                {/* Rule: Recurring */}
                <div style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '16px', borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-bg-card-hover">
                  <div style={{ color: 'var(--primary)', background: 'var(--primary-dim)', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Repeat size={18} />
                  </div>
                  <div style={{ flex: 1, marginTop: 2 }}>
                    <label htmlFor="holidayRecurring" style={{ display: 'block', fontWeight: 600, cursor: 'pointer', marginBottom: '4px', fontSize: 15 }}>Repeats Every Year</label>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>Occurs on the same calendar date every year.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0' }}>
                    <input id="holidayRecurring" type="checkbox" checked={form.isRecurring} onChange={e => setForm({...form, isRecurring: e.target.checked})} style={{ width: 20, height: 20, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                  </div>
                </div>

                {/* Rule: Postpone */}
                <div style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '16px', borderBottom: '1px solid var(--border)', transition: 'background 0.2s', opacity: (form.isRecurring || !isDateWeekend(form.date)) ? 0.6 : 1 }} className="hover-bg-card-hover">
                  <div style={{ color: 'var(--success)', background: 'var(--success-dim)', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarDays size={18} />
                  </div>
                  <div style={{ flex: 1, marginTop: 2 }}>
                    <label htmlFor="holidayPostpone" style={{ display: 'block', fontWeight: 600, cursor: (form.isRecurring || !isDateWeekend(form.date)) ? 'not-allowed' : 'pointer', marginBottom: '4px', fontSize: 15 }}>Shift to Weekday</label>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                      {form.isRecurring 
                        ? 'Recurring holidays automatically shift to a weekday if they fall on a weekend.' 
                        : 'Automatically observe on Monday or Tuesday if the calendar date falls on a weekend.'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0' }}>
                    <input id="holidayPostpone" type="checkbox" checked={form.postponeIfWeekend} disabled={form.isRecurring || !isDateWeekend(form.date)} onChange={e => setForm({...form, postponeIfWeekend: e.target.checked})} style={{ width: 20, height: 20, accentColor: 'var(--primary)', cursor: (form.isRecurring || !isDateWeekend(form.date)) ? 'not-allowed' : 'pointer' }} />
                  </div>
                </div>

                {/* Rule: Custom Date */}
                <div style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '16px', transition: 'background 0.2s', background: form.observedDate ? 'var(--bg-card-hover)' : 'transparent' }}>
                  <div style={{ color: 'var(--warning)', background: 'var(--warning-dim)', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Info size={18} />
                  </div>
                  <div style={{ flex: 1, marginTop: 2 }}>
                    <label htmlFor="holidayObservedDate" style={{ display: 'block', fontWeight: 600, cursor: 'pointer', marginBottom: '4px', fontSize: 15 }}>Custom Observed Date (Optional)</label>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.4 }}>Manually move this holiday to a specific date for the current year (e.g., from Wednesday to Friday).</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input id="holidayObservedDate" type="date" className="form-input" value={form.observedDate} onChange={e => setForm({...form, observedDate: e.target.value})} style={{ padding: '10px 14px', maxWidth: 200, fontSize: 14 }} />
                      {form.observedDate && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost btn-danger"
                          onClick={() => setClearDateConfirm({ isOpen: true })}
                          aria-label="Clear observed date"
                          title="Clear custom observed date"
                          style={{ padding: '8px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    {form.observedDate && isDateWeekend(form.observedDate) && (
                      <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6, fontWeight: 500 }}>
                        ⚠ Weekend selected — holidays cannot be observed on weekends. Please choose a weekday.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="modal-footer" style={{ borderTop: 'none', padding: 0, gap: 12 }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', fontSize: 15, fontWeight: 600 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '12px', fontSize: 15, fontWeight: 600 }}>{editingId ? 'Update Holiday' : 'Save Holiday'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Sync Review Modal */}
      {showSyncModal && (
        <div className="modal-overlay" onClick={() => !isSyncing && setShowSyncModal(false)}>
          <div className="modal-content" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Review Holidays Found</h3>
              <button className="modal-close" onClick={() => setShowSyncModal(false)} disabled={isSyncing}>✕</button>
            </div>
            <div style={{ padding: '0 20px', maxHeight: 400, overflowY: 'auto' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 15 }}>
                The following holidays were found for Ghana. Select the ones you want to add to your system.
              </p>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ width: 40, padding: '8px 0' }}>
                      <input 
                        type="checkbox" 
                        aria-label="Select all holidays"
                        checked={Object.values(selectedSyncDates).every(v => v)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const next: Record<string, boolean> = {};
                          syncResults.forEach(r => next[r.date] = val);
                          setSelectedSyncDates(next);
                        }}
                      />
                    </th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Holiday Name</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {syncResults.map(h => (
                    <tr key={h.date} style={{ borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <td style={{ padding: '8px 0' }}>
                        <input 
                          type="checkbox" 
                          aria-label={`Select ${h.name}`}
                          checked={!!selectedSyncDates[h.date]} 
                          onChange={e => setSelectedSyncDates(prev => ({ ...prev, [h.date]: e.target.checked }))}
                        />
                      </td>
                      <td style={{ padding: '8px', fontWeight: 500 }}>{h.name}</td>
                      <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{format(parseISO(h.date), 'dd MMM yyyy')}</td>
                      <td style={{ padding: '8px' }}>
                        <span className={`badge ${h.isFixed ? 'badge-blue' : 'badge-amber'}`}>
                          {h.isFixed ? 'Every Year' : 'One-time'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setShowSyncModal(false)} disabled={isSyncing}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={isSyncing || !Object.values(selectedSyncDates).some(v => v)}
                onClick={handleApproveSync}
              >
                {isSyncing ? 'Importing...' : `Import ${Object.values(selectedSyncDates).filter(v => v).length} Holidays`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
