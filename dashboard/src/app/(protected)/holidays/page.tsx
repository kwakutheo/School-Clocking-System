'use client';
import useSWR from 'swr';
import { useState } from 'react';
import { holidaysApi } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { Calendar, Plus, Trash2, Edit, ShieldAlert, DownloadCloud } from 'lucide-react';
import { can } from '@/lib/permissions';
import { useAuthStore } from '@/lib/store';
import { useMemo } from 'react';

const fetcher = () => holidaysApi.list().then((r) => r.data);

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
  const { data, isLoading, mutate } = useSWR('holidays-list', fetcher);
  const { user } = useAuthStore();
  const holidays: any[] = data ?? [];

  const [showModal, setShowModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResults, setSyncResults] = useState<any[]>([]);
  const [selectedSyncDates, setSelectedSyncDates] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', date: '', isRecurring: true });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const currentYearStr = new Date().getFullYear().toString();

  const { recurring, groupedByYear, sortedYears } = useMemo(() => {
    const recurring: any[] = [];
    const byYear: Record<string, any[]> = {};

    holidays.forEach(h => {
      if (h.isRecurring) {
        recurring.push(h);
      } else {
        const year = format(parseISO(h.date), 'yyyy');
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push(h);
      }
    });

    // Sort years descending so newest is on top
    const sortedYears = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
    return { recurring, groupedByYear: byYear, sortedYears };
  }, [holidays]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: prev[groupName] === undefined ? false : !prev[groupName] }));
  };

  const isGroupExpanded = (groupName: string, isPastYear: boolean = false) => {
    if (expandedGroups[groupName] !== undefined) return expandedGroups[groupName];
    return !isPastYear; // Past years collapsed by default, others expanded
  };

  const renderHolidayRow = (h: any, index: number) => (
    <tr 
      key={h.id}
      className="emp-row-animate"
      style={{ 
        background: 'transparent', 
        animationDelay: `${index * 0.05}s`
      }}
    >
      <td style={{ fontWeight: 600 }}>{h.name}</td>
      <td>{format(parseISO(h.date), 'dd MMMM')} {h.isRecurring ? '' : format(parseISO(h.date), 'yyyy')}</td>
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
          <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(h.id)} aria-label="Delete Holiday">
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );

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
    try {
      if (editingId) {
        await holidaysApi.update(editingId, form);
      } else {
        await holidaysApi.create(form);
      }
      mutate();
      setShowModal(false);
      setEditingId(null);
      setForm({ name: '', date: '', isRecurring: true });
    } catch (err) {
      alert(editingId ? 'Failed to update holiday' : 'Failed to add holiday');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await holidaysApi.delete(id);
      mutate();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const openEdit = (h: any) => {
    setForm({ name: h.name, date: h.date, isRecurring: h.isRecurring });
    setEditingId(h.id);
    setShowModal(true);
  };

  const openAdd = () => {
    setForm({ name: '', date: '', isRecurring: true });
    setEditingId(null);
    setShowModal(true);
  };

  const handleSyncPublicHolidays = async () => {
    const nextYear = new Date().getFullYear() + 1;
    const yearStr = prompt('Enter year to sync official holidays from Ghana (e.g. 2026, 2027):', nextYear.toString());
    if (!yearStr || isNaN(Number(yearStr))) return;
    
    setIsSyncing(true);
    try {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${yearStr}/GH`);
      if (!res.ok) throw new Error('Failed to fetch from public calendar API');
      const publicHolidays = await res.json();

      // Build a set of existing dates/recurring rules to avoid duplicates
      const existingDates = new Set();
      holidays.forEach(h => {
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
        alert(`All public holidays for ${yearStr} are already in your system.`);
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
      alert('Error syncing public holidays. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApproveSync = async () => {
    const toAdd = syncResults.filter(h => selectedSyncDates[h.date]);
    if (toAdd.length === 0) {
      alert('Please select at least one holiday to import.');
      return;
    }

    setIsSyncing(true);
    try {
      await Promise.all(toAdd.map((ph: any) => holidaysApi.create({
        name: ph.name,
        date: ph.date,
        isRecurring: ph.isFixed === true
      })));

      mutate();
      setShowSyncModal(false);
      setSyncResults([]);
      alert(`Successfully added ${toAdd.length} holidays!`);
    } catch (err) {
      alert('Failed to import holidays.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Holidays & Non-Working Days</h1>
          <p className="page-subtitle">Manage public holidays to ensure accurate absence tracking</p>
        </div>
        {can(userRole, 'holidays.manage') && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" onClick={handleSyncPublicHolidays} disabled={isSyncing}>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Holiday' : 'Add New Holiday'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close Modal">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="holidayName">Holiday Name</label>
                <input id="holidayName" className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Independence Day" />
              </div>
              <div className="form-group">
                <label htmlFor="holidayDate">Date</label>
                <input id="holidayDate" type="date" className="form-input" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input id="holidayRecurring" type="checkbox" checked={form.isRecurring} onChange={e => setForm({...form, isRecurring: e.target.checked})} />
                <label htmlFor="holidayRecurring" style={{ marginBottom: 0 }}>Repeats every year</label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Save Holiday'}</button>
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
