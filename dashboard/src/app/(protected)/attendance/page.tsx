'use client';
import useSWR from 'swr';
import { useState, useEffect, useMemo } from 'react';
import { attendanceApi, employeesApi, calendarApi, branchesApi } from '@/lib/api';
import { format, parseISO, eachMonthOfInterval, isSameMonth, isAfter, startOfDay } from 'date-fns';
import { Clock, User, Calendar, AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react';
import { can } from '@/lib/permissions';
import { useAuthStore } from '@/lib/store';
import { EmployeeCombobox } from '@/components/employee-combobox';

const employeesFetcher = () => employeesApi.listAll().then(r => r.data);
const termsFetcher = () => calendarApi.listTerms().then((r) => r.data);
const branchesFetcher = () => branchesApi.list().then((r) => r.data);

const formatMinutes = (mins: number) => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};



export default function AttendanceReportPage() {
  const { data: employees } = useSWR('employees-list', employeesFetcher);
  const { data: terms } = useSWR('academic-calendar-terms', termsFetcher);
  const { data: branches } = useSWR('branches-list', branchesFetcher);

  const [selectedEmp, setSelectedEmp] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'term'>('month');
  const [showExceptionsOnly, setShowExceptionsOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<string | 'summary'>('summary');
  const [exporting, setExporting] = useState(false);

  const { user } = useAuthStore();

  const termList: any[] = terms ?? [];
  const selectedTerm = termList.find((term: any) => term.id === selectedTermId);

  const academicYears = useMemo(() => {
    const years = new Set(termList.map((t: any) => t.academicYear));
    return Array.from(years).sort().reverse();
  }, [termList]);

  const filteredTerms = useMemo(() => {
    if (!selectedAcademicYear) return termList;
    return termList.filter((t: any) => t.academicYear === selectedAcademicYear);
  }, [termList, selectedAcademicYear]);

  const availableMonths = useMemo(() => {
    if (!selectedTerm?.startDate || !selectedTerm?.endDate) return [];

    return eachMonthOfInterval({
      start: parseISO(selectedTerm.startDate),
      end: parseISO(selectedTerm.endDate),
    }).map((date) => ({
      key: format(date, 'yyyy-MM'),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      label: format(date, 'MMMM yyyy'),
    }));
  }, [selectedTerm]);

  useEffect(() => {
    if (!termList.length || selectedTermId) return;

    const now = new Date();
    const currentTerm = termList.find((term: any) => {
      if (!term.startDate || !term.endDate) return false;
      const start = parseISO(term.startDate);
      const end = parseISO(term.endDate);
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    });

    const activeTerm = termList.find((term: any) => term.isActive);
    const fallbackTerm = currentTerm ?? activeTerm ?? termList[0];
    
    setSelectedAcademicYear(fallbackTerm.academicYear);
    setSelectedTermId(fallbackTerm.id);
  }, [termList, selectedTermId]);

  useEffect(() => {
    if (!availableMonths.length) {
      setMonth(null);
      setYear(null);
      return;
    }

    const currentMonth = availableMonths.find((item) =>
      isSameMonth(new Date(item.year, item.month - 1), new Date()),
    );
    const nextMonth = currentMonth ?? availableMonths[0];
    setMonth(nextMonth.month);
    setYear(nextMonth.year);
  }, [availableMonths, selectedTermId]);

  const fetchReport = async () => {
    if (!selectedEmp) return;
    if (viewMode === 'month' && (month === null || year === null)) return;
    if (viewMode === 'term' && !selectedTermId) return;

    setLoading(true);
    try {
      let res;
      if (viewMode === 'month') {
        res = await attendanceApi.getReport(selectedEmp, month!, year!);
      } else {
        res = await attendanceApi.getTermReport(selectedEmp, selectedTermId);
      }
      setReport(res.data);
      if (viewMode === 'term') setActiveTab('summary');
    } catch (err) {
      alert('Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    if (!selectedEmp) return;
    setExporting(true);
    try {
      const emp = employees?.find((e: any) => e.id === selectedEmp);
      const rawName = emp?.user?.fullName || emp?.fullName || 'Employee';
      const empName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      let res;
      let filename = `${empName}-attendance.pdf`;
      
      if (viewMode === 'month') {
        res = await attendanceApi.exportMonthlyPdf(selectedEmp, month!, year!);
        filename = `${empName}-attendance-${month}-${year}.pdf`;
      } else {
        res = await attendanceApi.exportTermPdf(selectedEmp, selectedTermId);
        filename = `${empName}-attendance-term.pdf`;
      }

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExportBulkPdf = async () => {
    setExporting(true);
    try {
      let res;
      let filename = 'bulk-attendance.pdf';
      const branchName = selectedBranch ? branches?.find((b: any) => b.id === selectedBranch)?.name : undefined;
      const termName = viewMode === 'term' ? selectedTerm?.name : undefined;

      if (viewMode === 'month') {
        res = await attendanceApi.exportBulkMonthlyPdf(month!, year!, selectedBranch || undefined, branchName);
        filename = `bulk-attendance-${month}-${year}.pdf`;
      } else {
        res = await attendanceApi.exportBulkTermPdf(selectedTermId, selectedBranch || undefined, branchName, termName);
        filename = `bulk-attendance-term.pdf`;
      }

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export Bulk PDF');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (selectedEmp) fetchReport();
  }, [selectedEmp, month, year, selectedTermId, viewMode]);

  const filteredDays = useMemo(() => {
     if (!report) return [];
     
     let days = [];
     if (viewMode === 'month') {
       days = report.days || [];
     } else {
       if (activeTab === 'summary') {
         return []; // Summary view doesn't show daily breakdown
       } else {
         const activeMonth = report.months?.find((m: any) => `${m.year}-${String(m.month).padStart(2, '0')}` === activeTab);
         days = activeMonth?.days || [];
       }
     }

    if (showExceptionsOnly) {
      return days.filter((day: any) => 
        day.isLate || 
        day.isEarlyOut || 
        day.status === 'ABSENT' || 
        day.status === 'INCOMPLETE' || 
        day.missingClockIn || 
        day.missingClockOut
      );
    }
    return days;
  }, [report, viewMode, activeTab, showExceptionsOnly]);

  const currentSummary = useMemo(() => {
     if (!report) return null;
     if (viewMode === 'month') return report.summary;
     if (activeTab === 'summary') return report.summary;
     
     const activeMonth = report.months?.find((m: any) => `${m.year}-${String(m.month).padStart(2, '0')}` === activeTab);
     return activeMonth?.summary || report.summary;
   }, [report, viewMode, activeTab]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Attendance Reports</h1>
        <p className="page-subtitle">Detailed tracking of days worked, absences, lateness, and early departures</p>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24, position: 'relative', zIndex: 100 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 24, gap: 12 }}>
          {can(user?.role, 'attendance.export') && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginRight: 'auto', background: 'var(--bg-card-alt)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 8 }}>
                <label htmlFor="bulkBranchFilter" style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Bulk Export Filter:</label>
                <select 
                  id="bulkBranchFilter"
                  className="form-input" 
                  aria-label="Bulk Export Filter"
                  style={{ width: 220, padding: '4px 10px', minHeight: 0, height: 32, border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', borderRadius: 6 }}
                  value={selectedBranch} 
                  onChange={e => setSelectedBranch(e.target.value)}
                >
                  <option value="">— All Branches —</option>
                  {(branches ?? []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={handleExportBulkPdf} 
                disabled={exporting || loading || (viewMode === 'month' && (month === null || year === null))}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}
                title="Export summary for all employees"
              >
                <FileText size={16} />
                {exporting ? 'Exporting...' : 'Bulk Export All'}
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleExportPdf} 
                disabled={exporting || loading || !selectedEmp || (viewMode === 'month' && (month === null || year === null))}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}
                title="Export report for selected employee"
              >
                <FileText size={16} />
                {exporting ? 'Exporting...' : 'Export Individual Report'}
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={fetchReport} disabled={loading || !selectedEmp || (viewMode === 'month' && (month === null || year === null))} style={{ fontWeight: 500 }}>
            {loading ? '...' : 'Refresh Report'}
          </button>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: 20, 
          alignItems: 'flex-start',
          background: 'var(--bg-card-alt)',
          padding: 20,
          borderRadius: 12,
          border: '1px solid var(--border)',
          overflow: 'visible',
          position: 'relative',
          zIndex: 50,
        }}>
          <div className="form-group" style={{ position: 'relative', zIndex: 20 }}>
            <label htmlFor="selectEmployee">Select Employee</label>
            <EmployeeCombobox
              employees={employees ?? []}
              value={selectedEmp}
              onChange={setSelectedEmp}
            />
          </div>
          <div className="form-group">
            <label htmlFor="viewMode">View Mode</label>
            <select 
              id="viewMode"
              className="form-input" 
              value={viewMode} 
              onChange={e => {
                setViewMode(e.target.value as any);
                setReport(null);
              }}
            >
              <option value="month">Monthly Report</option>
              <option value="term">Term Report</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="academicYear">Academic Year</label>
            <select 
              id="academicYear"
              className="form-input" 
              value={selectedAcademicYear} 
              onChange={e => {
                setSelectedAcademicYear(e.target.value);
                const firstTerm = termList.find((t: any) => t.academicYear === e.target.value);
                setSelectedTermId(firstTerm ? firstTerm.id : '');
              }}
            >
              <option value="">— Select Year —</option>
              {academicYears.map(year => (
                <option key={year as string} value={year as string}>{year as string}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="termSelect">Term</label>
            <select id="termSelect" className="form-input" value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)}>
              <option value="">— Select Term —</option>
              {filteredTerms.map((term: any) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </div>
          {viewMode === 'month' && (
            <div className="form-group">
              <label htmlFor="monthSelect">Month Within Term</label>
              <select
                id="monthSelect"
                className="form-input"
                value={month !== null && year !== null ? `${year}-${String(month).padStart(2, '0')}` : ''}
                onChange={e => {
                  const [selectedYear, selectedMonth] = e.target.value.split('-').map(Number);
                  setYear(selectedYear);
                  setMonth(selectedMonth);
                }}
                disabled={!availableMonths.length}
              >
                <option value="">— Select Month —</option>
                {availableMonths.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {report && (
        <>
          <div className="report-controls">
            <div className="tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {viewMode === 'term' && (
                <>
                  <button 
                     className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
                     onClick={() => setActiveTab('summary')}
                   >
                     Term Summary
                   </button>
                   {report.months?.map((m: any) => {
                     const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
                    return (
                      <button 
                        key={key}
                        className={`tab ${activeTab === key ? 'active' : ''}`}
                        onClick={() => setActiveTab(key)}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
              <input 
                type="checkbox" 
                checked={showExceptionsOnly} 
                onChange={e => setShowExceptionsOnly(e.target.checked)} 
              />
              Show Exceptions Only
            </label>
          </div>

          <div className="stats-grid">
            <div className="stat-card" style={{ '--stat-color': 'var(--success)', '--stat-color-dim': 'var(--success-dim)' } as any}>
              <div className="stat-card-glow" />
              <div className="stat-card-content">
                <div className="stat-icon-wrapper">
                  <div className="stat-icon"><CheckCircle size={20} /></div>
                </div>
                <div className="stat-main">
                  <div className="stat-value" style={{ color: 'var(--success)' }}>{currentSummary.daysWorked}</div>
                  <div className="stat-label" style={{ fontSize: 13, textTransform: 'none', letterSpacing: 'normal' }}>Days Worked</div>
                </div>
              </div>
            </div>
            
            <div className="stat-card" style={{ '--stat-color': 'var(--primary)', '--stat-color-dim': 'var(--primary-dim)' } as any}>
              <div className="stat-card-glow" />
              <div className="stat-card-content">
                <div className="stat-icon-wrapper">
                  <div className="stat-icon"><Clock size={20} /></div>
                </div>
                <div className="stat-main">
                  <div className="stat-value">{currentSummary.totalHours}h</div>
                  <div className="stat-label" style={{ fontSize: 13, textTransform: 'none', letterSpacing: 'normal' }}>Total Hours</div>
                </div>
              </div>
            </div>

            <div className="stat-card" style={{ '--stat-color': 'var(--danger)', '--stat-color-dim': 'var(--danger-dim)' } as any}>
              <div className="stat-card-glow" />
              <div className="stat-card-content">
                <div className="stat-icon-wrapper">
                  <div className="stat-icon"><XCircle size={20} /></div>
                </div>
                <div className="stat-main">
                  <div className="stat-value" style={{ color: 'var(--danger)' }}>{currentSummary.daysAbsent}</div>
                  <div className="stat-label" style={{ fontSize: 13, textTransform: 'none', letterSpacing: 'normal' }}>Absences</div>
                </div>
              </div>
            </div>

            <div className="stat-card" style={{ '--stat-color': 'var(--accent)', '--stat-color-dim': 'var(--accent-dim)' } as any}>
              <div className="stat-card-glow" />
              <div className="stat-card-content">
                <div className="stat-icon-wrapper">
                  <div className="stat-icon"><AlertTriangle size={20} /></div>
                </div>
                <div className="stat-main">
                  <div className="stat-value" style={{ color: 'var(--accent)' }}>
                    {currentSummary.daysLate}d
                  </div>
                  <div className="stat-label" style={{ fontSize: 13, textTransform: 'none', letterSpacing: 'normal' }}>Lateness <span style={{ fontSize: 11, opacity: 0.8 }}>({formatMinutes(currentSummary.totalLateMinutes)})</span></div>
                </div>
              </div>
            </div>

            <div className="stat-card" style={{ '--stat-color': 'var(--warning)', '--stat-color-dim': 'var(--warning-dim)' } as any}>
              <div className="stat-card-glow" />
              <div className="stat-card-content">
                <div className="stat-icon-wrapper">
                  <div className="stat-icon"><Clock size={20} /></div>
                </div>
                <div className="stat-main">
                  <div className="stat-value" style={{ color: 'var(--warning)' }}>
                    {currentSummary.daysEarlyDeparture}d
                  </div>
                  <div className="stat-label" style={{ fontSize: 13, textTransform: 'none', letterSpacing: 'normal' }}>Early Outs <span style={{ fontSize: 11, opacity: 0.8 }}>({formatMinutes(currentSummary.totalEarlyOutMinutes)})</span></div>
                </div>
              </div>
            </div>

            <div className="stat-card" style={{ '--stat-color': 'var(--brown)', '--stat-color-dim': 'var(--brown-dim)' } as any}>
              <div className="stat-card-glow" />
              <div className="stat-card-content">
                <div className="stat-icon-wrapper">
                  <div className="stat-icon"><AlertTriangle size={20} /></div>
                </div>
                <div className="stat-main">
                  <div className="stat-value" style={{ color: 'var(--brown)' }}>
                    {currentSummary.daysForgotClockOut}d
                  </div>
                  <div className="stat-label" style={{ fontSize: 13, textTransform: 'none', letterSpacing: 'normal' }}>Forgot Out</div>
                </div>
              </div>
            </div>
          </div>

          {(viewMode === 'month' || activeTab !== 'summary') && (
            <div className="table-wrap">
              <div className="table-header">
                <Calendar size={18} style={{ marginRight: 8 }} />
                <span className="table-title">
                  {viewMode === 'term' && activeTab !== 'summary' 
                    ? `Breakdown — ${report.months.find((m: any) => `${m.year}-${String(m.month).padStart(2, '0')}` === activeTab)?.name}`
                    : `Daily Breakdown — ${report.employee.fullName}`}
                  {selectedTerm && viewMode === 'month' ? ` · ${selectedTerm.name}` : ''}
                  {month && year && viewMode === 'month' ? ` · ${format(new Date(year, month - 1), 'MMMM yyyy')}` : ''}
                </span>
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Hours</th>
                    <th>Exceptions / Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDays.map((day: any) => {
                    const isFuture = isAfter(parseISO(day.date), startOfDay(new Date()));
                    return (
                    <tr key={day.date} className={!isFuture && day.status === 'ABSENT' ? 'row-absent' : ''}>
                      <td style={{ fontWeight: 500 }}>{format(parseISO(day.date), 'EEE, dd MMM')}</td>
                      <td>
                        {!isFuture ? (
                          <span className={`badge badge-${
                            day.status.toLowerCase().includes('holiday') ? 'blue' : 
                            day.status.toLowerCase().includes('break') ? 'amber' :
                            (day.status === 'WEEKEND' || day.status.includes('OFF-TERM')) ? 'ghost' : 
                            day.status === 'INCOMPLETE' ? 'orange' :
                            day.status === 'PRESENT' ? 'green' : 
                            (day.status === 'SCHEDULED' || day.status === 'IN PROGRESS') ? 'blue' : 
                            'red'
                          }`}>
                            {day.status}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{!isFuture && day.clockIn ? format(new Date(day.clockIn), 'HH:mm') : '—'}</td>
                      <td>{!isFuture && day.clockOut ? format(new Date(day.clockOut), 'HH:mm') : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{!isFuture && day.hours > 0 ? `${day.hours}h` : '—'}</td>
                      <td>
                        {!isFuture ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {day.isLate && (
                            <span
                              title={`Late by ${formatMinutes(day.lateMinutes)}`}
                              className="badge badge-amber"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <AlertTriangle size={14} />
                              Late ({formatMinutes(day.lateMinutes)})
                            </span>
                          )}
                          {day.isEarlyOut && (
                            <span
                              title={`Early out by ${formatMinutes(day.earlyOutMinutes)}`}
                              className="badge badge-orange"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <Clock size={14} />
                              Early Out ({formatMinutes(day.earlyOutMinutes)})
                            </span>
                          )}
                          {day.missingClockIn && (
                            <span
                              title="Missing Clock In"
                              className="badge badge-red"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <XCircle size={14} />
                              Missing In
                            </span>
                          )}
                          {day.missingClockOut && (
                            <span
                              title="Missing Clock Out"
                              className="badge badge-red"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <XCircle size={14} />
                              Missing Out
                            </span>
                          )}
                          {day.status === 'PRESENT' && !day.isLate && !day.isEarlyOut && !day.missingClockIn && !day.missingClockOut && (
                            <span
                              title="Perfect Shift"
                              className="badge badge-green"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <CheckCircle size={14} />
                              Perfect Shift
                            </span>
                          )}
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  )})}
                  {filteredDays.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                        {showExceptionsOnly ? 'No exceptions found for this period.' : 'No data available.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'term' && activeTab === 'summary' && (
            <div className="table-wrap">
              <div className="table-header">
                <Calendar size={18} style={{ marginRight: 8 }} />
                <span className="table-title">Monthly Summaries — {report.term.name}</span>
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Days Worked</th>
                    <th>Hours</th>
                    <th>Absences</th>
                    <th>Lateness</th>
                    <th>Early Outs</th>
                    <th>Forgot Out</th>
                  </tr>
                </thead>
                <tbody>
                  {report.months.map((m: any) => (
                    <tr key={m.name} style={{ cursor: 'pointer' }} onClick={() => setActiveTab(`${m.year}-${String(m.month).padStart(2, '0')}`)}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{m.name}</td>
                      <td>{m.summary.daysWorked}</td>
                      <td>{m.summary.totalHours}h</td>
                      <td>{m.summary.daysAbsent}</td>
                      <td>{m.summary.daysLate} ({formatMinutes(m.summary.totalLateMinutes)})</td>
                      <td>{m.summary.daysEarlyDeparture} ({formatMinutes(m.summary.totalEarlyOutMinutes)})</td>
                      <td>{m.summary.daysForgotClockOut}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .row-absent { background: rgba(239, 68, 68, 0.05); }
        .report-table td { padding: 12px 16px; border-bottom: 1px solid var(--border); }
        .tab { 
          padding: 8px 16px; 
          border: 1px solid var(--border); 
          background: var(--bg-card); 
          border-radius: 8px; 
          font-size: 13px; 
          font-weight: 600; 
          cursor: pointer;
          transition: all 0.2s;
          color: var(--text-secondary);
        }
        .tab:hover { background: var(--bg-card-hover); color: var(--text-primary); }
        .tab.active { background: var(--primary); color: white; border-color: var(--primary); box-shadow: 0 4px 12px rgba(59,130,246,0.3); }
      `}</style>
    </>
  );
}
