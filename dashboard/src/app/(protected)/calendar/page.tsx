'use client';
import useSWR from 'swr';
import { useState, useMemo, useEffect } from 'react';
import { calendarApi } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { Calendar, Plus, Trash2, Edit2, Coffee, ChevronRight, ChevronDown, GraduationCap, ShieldAlert } from 'lucide-react';
import { can } from '@/lib/permissions';

const fetcher = () => calendarApi.listTerms().then((r) => r.data);

export default function AcademicCalendarPage() {
  const { data, isLoading, mutate } = useSWR('academic-calendar', fetcher);

  const userRole = useMemo(() =>
    typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('user') ?? '{}')?.role as string
      : ''
  , []);
  const [showTermModal, setShowTermModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTerm, setEditingTerm] = useState<any>(null);
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
  const [hasInitialized, setHasInitialized] = useState(false);

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [globalTemplates, setGlobalTemplates] = useState<any[]>([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);

  useEffect(() => {
    if (showCloneModal) {
      setIsLoadingGlobal(true);
      calendarApi.listGlobalTemplates()
        .then((r) => {
          setGlobalTemplates(r.data);
        })
        .catch(() => {
          alert('Failed to load global templates');
        })
        .finally(() => {
          setIsLoadingGlobal(false);
        });
    }
  }, [showCloneModal]);

  const handleCloneYear = async (academicYear: string, forceOverwrite = false) => {
    if (!forceOverwrite) {
      if (!confirm(`Are you sure you want to import the standard national calendar template for the ${academicYear} academic year?`)) return;
    }
    setIsSubmitting(true);
    try {
      await calendarApi.cloneTemplate(academicYear, forceOverwrite);
      alert(`Successfully imported the standard ${academicYear} academic calendar!`);
      mutate();
      setShowCloneModal(false);
    } catch (err: any) {
      const errMsg = err.response?.data?.message;
      if (errMsg === 'EXISTING_CALENDAR') {
        const confirmOverwrite = confirm(
          `Your school already has academic terms defined for the ${academicYear} academic year.\n\n` +
          `Would you like to OVERWRITE your current calendar with the central master template?\n` +
          `⚠️ WARNING: This will permanently delete all your existing terms and mid-term breaks for ${academicYear}.`
        );
        if (confirmOverwrite) {
          await handleCloneYear(academicYear, true);
        }
      } else {
        alert(errMsg || 'Failed to import calendar template.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupedGlobals = globalTemplates.reduce((acc: Record<string, any[]>, term) => {
    const year = term.academicYear || 'Unassigned Year';
    if (!acc[year]) acc[year] = [];
    acc[year].push(term);
    return acc;
  }, {});

  const sortedGlobalYears = Object.keys(groupedGlobals).sort((a, b) => b.localeCompare(a));

  const [termForm, setTermForm] = useState({
    name: '',
    academicYear: '',
    startDate: '',
    endDate: '',
  });

  const [yearForm, setYearForm] = useState({
    academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    terms: [
      { name: 'First Term', startDate: '', endDate: '' },
      { name: 'Second Term', startDate: '', endDate: '' },
      { name: 'Third Term', startDate: '', endDate: '' }
    ]
  });

  const [breakForm, setBreakForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
  });

  const terms: any[] = data ?? [];

  // Group terms by academic year
  const groupedTerms = terms.reduce((acc: Record<string, any[]>, term) => {
    const year = term.academicYear || 'Unassigned Year';
    if (!acc[year]) acc[year] = [];
    acc[year].push(term);
    return acc;
  }, {});

  // Sort years descending (e.g., "2025/2026" before "2024/2025")
  const sortedYears = Object.keys(groupedTerms).sort((a, b) => b.localeCompare(a));

  const currentAcademicYear = useMemo(() => {
    if (!terms.length) return null;
    const now = new Date();
    let currentYear = null;

    // 1. Try to find the year that contains the current date
    for (const term of terms) {
      if (!term.startDate || !term.endDate) continue;
      const start = parseISO(term.startDate);
      const end = parseISO(term.endDate);
      end.setHours(23, 59, 59, 999);
      if (now >= start && now <= end) {
        currentYear = term.academicYear;
        break;
      }
    }

    // 2. Fallback to the active term
    if (!currentYear) {
      const activeTerm = terms.find((t: any) => t.isActive);
      currentYear = activeTerm?.academicYear;
    }

    // 3. Fallback to the newest year
    if (!currentYear && sortedYears.length > 0) {
      currentYear = sortedYears[0];
    }
    
    return currentYear;
  }, [terms, sortedYears]);

  useEffect(() => {
    if (hasInitialized || !currentAcademicYear) return;
    setExpandedYears({ [currentAcademicYear]: true });
    setHasInitialized(true);
  }, [currentAcademicYear, hasInitialized]);

  const handleYearSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const validTerms = yearForm.terms.filter(t => t.name && t.startDate && t.endDate);
    
    // Validate terms internally
    for (let i = 0; i < validTerms.length; i++) {
      const currentStart = new Date(validTerms[i].startDate).getTime();
      const currentEnd = new Date(validTerms[i].endDate).getTime();
      
      if (currentStart > currentEnd) {
        alert(`${validTerms[i].name} cannot end before its start date.`);
        setIsSubmitting(false);
        return;
      }
      
      for (let j = i + 1; j < validTerms.length; j++) {
        const nextStart = new Date(validTerms[j].startDate).getTime();
        const nextEnd = new Date(validTerms[j].endDate).getTime();
        if (Math.max(currentStart, nextStart) <= Math.min(currentEnd, nextEnd)) {
           alert(`Dates for ${validTerms[i].name} and ${validTerms[j].name} overlap.`);
           setIsSubmitting(false);
           return;
        }
      }

      // Check against existing terms
      for (const existingTerm of terms) {
        const extStart = new Date(existingTerm.startDate).getTime();
        const extEnd = new Date(existingTerm.endDate).getTime();
        if (Math.max(currentStart, extStart) <= Math.min(currentEnd, extEnd)) {
          alert(`${validTerms[i].name} overlaps with an another term (${existingTerm.name}).`);
          setIsSubmitting(false);
          return;
        }
      }
    }

    try {
      await Promise.all(
        yearForm.terms.map(t => {
          if (t.name && t.startDate && t.endDate) {
            return calendarApi.createTerm({
              name: t.name,
              startDate: t.startDate,
              endDate: t.endDate,
              academicYear: yearForm.academicYear
            });
          }
          return Promise.resolve();
        })
      );
      mutate();
      setShowYearModal(false);
      setYearForm({
        academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        terms: [
          { name: 'First Term', startDate: '', endDate: '' },
          { name: 'Second Term', startDate: '', endDate: '' },
          { name: 'Third Term', startDate: '', endDate: '' }
        ]
      });
    } catch (err) {
      alert('Failed to save academic year');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTermSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (termForm.startDate && termForm.endDate) {
      const newStart = new Date(termForm.startDate).getTime();
      const newEnd = new Date(termForm.endDate).getTime();
      
      if (newStart > newEnd) {
        alert(`The term cannot end before its start date.`);
        setIsSubmitting(false);
        return;
      }

      for (const existingTerm of terms) {
        if (editingTerm && existingTerm.id === editingTerm.id) continue;
        const extStart = new Date(existingTerm.startDate).getTime();
        const extEnd = new Date(existingTerm.endDate).getTime();
        if (Math.max(newStart, extStart) <= Math.min(newEnd, extEnd)) {
          alert(`This term overlaps with an existing term (${existingTerm.name}).`);
          setIsSubmitting(false);
          return;
        }
      }
    }

    try {
      if (editingTerm) {
        await calendarApi.updateTerm(editingTerm.id, {
          ...termForm,
          isActive: editingTerm.isActive
        });
      } else {
        await calendarApi.createTerm(termForm);
      }
      mutate();
      setShowTermModal(false);
      setEditingTerm(null);
      setTermForm({ name: '', academicYear: '', startDate: '', endDate: '' });
    } catch (err) {
      alert('Failed to save term');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBreakSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTermId) return;
    setIsSubmitting(true);

    const bStart = new Date(breakForm.startDate).getTime();
    const bEnd = new Date(breakForm.endDate).getTime();

    if (bStart > bEnd) {
      alert("The break cannot end before its start date.");
      setIsSubmitting(false);
      return;
    }

    const parentTerm = terms.find(t => t.id === selectedTermId);
    if (parentTerm) {
      const tStart = new Date(parentTerm.startDate).getTime();
      const tEnd = new Date(parentTerm.endDate).getTime();
      
      if (bStart < tStart || bEnd > tEnd) {
        alert("The mid-term break must fall completely within the start and end dates of the term.");
        setIsSubmitting(false);
        return;
      }

      for (const existingBreak of parentTerm.breaks || []) {
        const eBStart = new Date(existingBreak.startDate).getTime();
        const eBEnd = new Date(existingBreak.endDate).getTime();
        if (Math.max(bStart, eBStart) <= Math.min(bEnd, eBEnd)) {
          alert(`This break overlaps with an existing break (${existingBreak.name}).`);
          setIsSubmitting(false);
          return;
        }
      }
    }

    try {
      await calendarApi.createBreak(selectedTermId, breakForm);
      mutate();
      setShowBreakModal(false);
      setBreakForm({ name: '', startDate: '', endDate: '' });
    } catch (err) {
      alert('Failed to save break');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteTerm = async (id: string) => {
    if (!confirm('Are you sure you want to delete this term? All associated breaks will be removed.')) return;
    try {
      await calendarApi.deleteTerm(id);
      mutate();
    } catch (err) {
      alert('Failed to delete term');
    }
  };

  const deleteBreak = async (id: string) => {
    if (!confirm('Delete this break?')) return;
    try {
      await calendarApi.deleteBreak(id);
      mutate();
    } catch (err) {
      alert('Failed to delete break');
    }
  };

  const openEditTerm = (term: any) => {
    setEditingTerm(term);
    setTermForm({
      name: term.name,
      academicYear: term.academicYear,
      startDate: term.startDate,
      endDate: term.endDate,
    });
    setShowTermModal(true);
  };

  const openAddTerm = (year: string) => {
    setEditingTerm(null);
    setTermForm({
      name: '',
      academicYear: year,
      startDate: '',
      endDate: '',
    });
    setShowTermModal(true);
  };

  if (!can(userRole, 'calendar.view')) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ color: 'var(--danger)' }}><ShieldAlert size={48} /></div>
        <p className="empty-state-text">Access Denied. You do not have permission to view the Academic Calendar.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Academic Calendar</h1>
          <p className="page-subtitle">Manage school terms, mid-term breaks, and vacations</p>
        </div>
        {can(userRole, 'calendar.create') && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowCloneModal(true)}>
              <GraduationCap size={18} /> Import from Central Templates
            </button>
            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowYearModal(true)}>
              <Plus size={18} /> Create Academic Year
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : terms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar size={48} /></div>
          <p className="empty-state-text" style={{ marginBottom: 16 }}>No academic terms defined yet.</p>
          {can(userRole, 'calendar.create') && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowCloneModal(true)}>
                <GraduationCap size={18} /> Import from Central Templates
              </button>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowYearModal(true)}>
                <Plus size={18} /> Create Custom Year
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {sortedYears.map((year, index) => {
            // Sort terms within the year by start date ascending (e.g. Term 1 -> Term 2 -> Term 3)
            const yearTerms = groupedTerms[year].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
            
            const isExpanded = expandedYears[year] || false;
            
            return (
              <div key={year} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div 
                  onClick={() => setExpandedYears({ [year]: !isExpanded })}
                  style={{ 
                    padding: '16px 20px', 
                    background: 'rgba(255,255,255,0.02)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'background 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Calendar size={20} style={{ color: 'var(--primary)' }} />
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                      Academic Year: <span style={{ color: 'var(--primary)' }}>{year}</span>
                    </h2>
                    {year === currentAcademicYear && (
                      <span className="badge badge-green" style={{ marginLeft: 8, fontSize: 11, padding: '3px 8px' }}>Current Academic Year</span>
                    )}
                    <span className="badge badge-gray" style={{ marginLeft: 8 }}>{yearTerms.length} terms</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {yearTerms.length < 3 && can(userRole, 'calendar.create') && (
                      <button 
                        className="btn btn-sm btn-ghost" 
                        onClick={(e) => { e.stopPropagation(); openAddTerm(year); }}
                        style={{ padding: '4px 10px', fontSize: 12, border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        <Plus size={14} /> Add Missing Term
                      </button>
                    )}
                    <div style={{ color: 'var(--text-secondary)' }}>
                      <ChevronRight 
                        size={20} 
                        style={{ 
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', 
                          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
                        }} 
                      />
                    </div>
                  </div>
                </div>
                
                <div 
                  style={{
                    display: 'grid',
                    gridTemplateRows: isExpanded ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ padding: 20, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, alignItems: 'start' }}>
                      {yearTerms.map((term) => {
                        const today = new Date();
                        const start = parseISO(term.startDate);
                        const end = parseISO(term.endDate);
                        end.setHours(23, 59, 59, 999);
                        const isCurrentTerm = today >= start && today <= end;

                        return (
                          <div key={term.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <GraduationCap size={18} style={{ color: 'var(--primary)' }} />
                                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{term.name}</h3>
                                </div>
                                {isCurrentTerm && <span className="badge badge-green" style={{ marginTop: 2, fontSize: 10, padding: '2px 6px' }}>Current Term</span>}
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                              {can(userRole, 'calendar.edit') && (
                              <button 
                                onClick={() => openEditTerm(term)} 
                                style={{ color: 'var(--text-secondary)' }}
                                aria-label="Edit Term"
                                title="Edit Term"
                              >
                                <Edit2 size={14} />
                              </button>
                              )}
                              {can(userRole, 'calendar.delete') && (
                              <button 
                                onClick={() => deleteTerm(term.id)} 
                                style={{ color: 'var(--danger)' }}
                                aria-label="Delete Term"
                                title="Delete Term"
                              >
                                <Trash2 size={14} />
                              </button>
                              )}
                            </div>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Starts:</span>
                              <span style={{ fontWeight: 600 }}>{format(parseISO(term.startDate), 'MMM do, yyyy')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Ends:</span>
                              <span style={{ fontWeight: 600 }}>{format(parseISO(term.endDate), 'MMM do, yyyy')}</span>
                            </div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: 0.5 }}>
                                Mid-term Breaks
                              </h4>
                              {can(userRole, 'calendar.edit') && (
                              <button 
                                className="btn btn-sm btn-ghost" 
                                onClick={() => { setSelectedTermId(term.id); setShowBreakModal(true); }}
                                style={{ padding: '2px 6px', fontSize: 10, height: 24 }}
                              >
                                <Plus size={12} /> Add Break
                              </button>
                              )}
                            </div>

                            {term.breaks?.length === 0 ? (
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0', margin: 0 }}>
                                No breaks scheduled for this term.
                              </p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {term.breaks.map((b: any) => (
                                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                    <Coffee size={14} style={{ color: 'var(--accent)' }} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</div>
                                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                        {format(parseISO(b.startDate), 'dd MMM')} — {format(parseISO(b.endDate), 'dd MMM')}
                                      </div>
                                    </div>
                                    {can(userRole, 'calendar.delete') && (
                                    <button 
                                      onClick={() => deleteBreak(b.id)} 
                                      style={{ color: 'var(--danger)', opacity: 0.6 }}
                                      aria-label="Delete Break"
                                      title="Delete Break"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Year Modal */}
      {showYearModal && (
        <div className="modal-overlay" onClick={() => setShowYearModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Create Academic Year</h3>
              <button className="modal-close" onClick={() => setShowYearModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleYearSubmit}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label htmlFor="yearName">Academic Year</label>
                <input 
                  id="yearName"
                  className="form-input" 
                  placeholder="e.g. 2025/2026" 
                  value={yearForm.academicYear}
                  onChange={e => setYearForm({...yearForm, academicYear: e.target.value})}
                  required 
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '50vh', overflowY: 'auto', paddingRight: 4 }}>
                {yearForm.terms.map((term, index) => (
                  <div key={index} style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label htmlFor={`termName-${index}`}>Term Name</label>
                      <input 
                        id={`termName-${index}`}
                        className="form-input" 
                        value={term.name}
                        onChange={e => {
                          const newTerms = [...yearForm.terms];
                          newTerms[index].name = e.target.value;
                          setYearForm({...yearForm, terms: newTerms});
                        }}
                        required={index === 0}
                      />
                    </div>
                    <div className="form-grid">
                      <div className="form-group">
                        <label htmlFor={`startDate-${index}`}>Start Date</label>
                        <input 
                          id={`startDate-${index}`}
                          type="date" 
                          className="form-input" 
                          value={term.startDate}
                          onChange={e => {
                            const newTerms = [...yearForm.terms];
                            newTerms[index].startDate = e.target.value;
                            setYearForm({...yearForm, terms: newTerms});
                          }}
                          required={index === 0 || term.endDate !== ''}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`endDate-${index}`}>End Date</label>
                        <input 
                          id={`endDate-${index}`}
                          type="date" 
                          className="form-input" 
                          value={term.endDate}
                          onChange={e => {
                            const newTerms = [...yearForm.terms];
                            newTerms[index].endDate = e.target.value;
                            setYearForm({...yearForm, terms: newTerms});
                          }}
                          required={index === 0 || term.startDate !== ''}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-footer" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowYearModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Academic Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Term Modal */}
      {showTermModal && (
        <div className="modal-overlay" onClick={() => setShowTermModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTerm ? 'Edit Term' : 'Add Term'}</h3>
              <button className="modal-close" onClick={() => setShowTermModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleTermSubmit}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="termName">Term Name</label>
                  <input 
                    id="termName"
                    className="form-input" 
                    placeholder="e.g. Term 1" 
                    value={termForm.name}
                    onChange={e => setTermForm({...termForm, name: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="academicYear">Academic Year</label>
                  <input 
                    id="academicYear"
                    className="form-input" 
                    placeholder="e.g. 2023/2024" 
                    value={termForm.academicYear}
                    onChange={e => setTermForm({...termForm, academicYear: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="startDate">Start Date</label>
                  <input 
                    id="startDate"
                    type="date" 
                    className="form-input" 
                    value={termForm.startDate}
                    onChange={e => setTermForm({...termForm, startDate: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="endDate">End Date</label>
                  <input 
                    id="endDate"
                    type="date" 
                    className="form-input" 
                    value={termForm.endDate}
                    onChange={e => setTermForm({...termForm, endDate: e.target.value})}
                    required 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowTermModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Term'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Break Modal */}
      {showBreakModal && (
        <div className="modal-overlay" onClick={() => setShowBreakModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>Add Mid-term Break</h3>
              <button className="modal-close" onClick={() => setShowBreakModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleBreakSubmit}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group">
                  <label htmlFor="breakName">Break Name</label>
                  <input 
                    id="breakName"
                    className="form-input" 
                    placeholder="e.g. Mid-term break" 
                    value={breakForm.name}
                    onChange={e => setBreakForm({...breakForm, name: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="breakStartDate">Start Date</label>
                  <input 
                    id="breakStartDate"
                    type="date" 
                    className="form-input" 
                    value={breakForm.startDate}
                    onChange={e => setBreakForm({...breakForm, startDate: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="breakEndDate">End Date</label>
                  <input 
                    id="breakEndDate"
                    type="date" 
                    className="form-input" 
                    value={breakForm.endDate}
                    onChange={e => setBreakForm({...breakForm, endDate: e.target.value})}
                    required 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowBreakModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Add Break'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import/Clone Global Templates Modal */}
      {showCloneModal && (
        <div className="modal-overlay" onClick={() => setShowCloneModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <GraduationCap size={24} style={{ color: 'var(--primary)' }} />
                <h3>Import Central Calendar Templates</h3>
              </div>
              <button className="modal-close" onClick={() => setShowCloneModal(false)}>&times;</button>
            </div>
            
            <div style={{ padding: '0 20px 20px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
                Select a standard national academic calendar template prepared by the platform Super Admin to clone all of its terms and mid-term break templates instantly into your school.
              </p>
              
              {isLoadingGlobal ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <div className="spinner" />
                </div>
              ) : sortedGlobalYears.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  <Calendar size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                  <p>No standard templates are available at the moment.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {sortedGlobalYears.map(year => {
                    const yearTerms = groupedGlobals[year].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
                    
                    return (
                      <div 
                        key={year} 
                        style={{ 
                          border: '1px solid var(--border)', 
                          borderRadius: 8, 
                          padding: 16, 
                          background: 'rgba(255,255,255,0.01)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 16
                        }}
                      >
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                            Academic Year: {year}
                          </h4>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                            {yearTerms.map(term => (
                              <span 
                                key={term.id} 
                                className="badge badge-gray" 
                                style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                {term.name}
                                {term.breaks && term.breaks.length > 0 && (
                                  <Coffee size={10} style={{ color: 'var(--primary)' }} />
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <button 
                          className="btn btn-sm btn-primary" 
                          disabled={isSubmitting}
                          onClick={() => handleCloneYear(year)}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          Clone Template
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCloneModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
