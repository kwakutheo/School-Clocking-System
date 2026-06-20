'use client';
import { useState, useEffect } from 'react';
import { Trophy, Search, ChevronLeft, ChevronRight, Award, Clock, Medal, Zap, Star, X } from 'lucide-react';
import { attendanceApi, calendarApi } from '@/lib/api';

function rateColor(rate: number) {
  if (rate >= 90) return "#22c55e";
  if (rate >= 75) return "#f59e0b";
  return "#ef4444";
}

const formatPct = (val: number) => parseFloat((val || 0).toFixed(2));

export default function RankingsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [explainEmpModal, setExplainEmpModal] = useState<any>(null);

  const [terms, setTerms] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await calendarApi.listTerms();
        const allTerms = res.data;
        setTerms(allTerms);
        
        const years = Array.from(new Set(allTerms.map((t: any) => t.academicYear))) as string[];
        setAcademicYears(years);

        const now = new Date();
        const activeTerm = allTerms.find((t: any) => {
           const start = new Date(t.startDate);
           const end = new Date(t.endDate);
           return now >= start && now <= end;
        });

        if (activeTerm) {
           setSelectedYear(activeTerm.academicYear);
           setSelectedTerm(activeTerm.name);
        } else if (allTerms.length > 0) {
           const newest = allTerms.sort((a: any, b: any) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
           setSelectedYear(newest.academicYear);
           setSelectedTerm(newest.name);
        }
      } catch (err) {
        console.error('Failed to load terms', err);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedYear || terms.length === 0) {
      fetchRankings();
    }
  }, [page, debouncedSearch, selectedYear, selectedTerm, terms.length]);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getRankings({
        page,
        limit,
        search: debouncedSearch,
        academicYear: selectedYear || undefined,
        termName: selectedTerm === 'Entire Academic Year' ? undefined : (selectedTerm || undefined),
      });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load rankings', err);
    } finally {
      setLoading(false);
    }
  };

  const availableTermsForYear = terms.filter(t => t.academicYear === selectedYear);

  return (
    <div className="dashboard-container">
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={28} style={{ color: 'var(--primary)' }} />
            Performance Rankings
          </h1>
          <p className="page-subtitle">View staff rankings and your school's position.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            value={selectedYear} 
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setSelectedTerm('Entire Academic Year');
            }}
            aria-label="Filter by Academic Year"
            className="form-input"
            style={{ minWidth: '160px', width: 'auto', padding: '8px 12px' }}
          >
            {academicYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select 
            value={selectedTerm} 
            onChange={(e) => setSelectedTerm(e.target.value)}
            disabled={!selectedYear}
            aria-label="Filter by Term"
            className="form-input"
            style={{ minWidth: '200px', width: 'auto', padding: '8px 12px' }}
          >
            <option value="Entire Academic Year">Entire Academic Year</option>
            {availableTermsForYear.map(t => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {data?.globalSchoolRank && (
        <div className="card" style={{ marginBottom: '24px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.05, pointerEvents: 'none' }}>
            <Trophy size={200} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px', position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                School Position
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '42px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                  #{data.globalSchoolRank.rank}
                </span>
                <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  out of {data.globalSchoolRank.totalSchools} Schools
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontWeight: 600 }}>
                <Star size={18} fill="currentColor" />
                {data.globalSchoolRank.presenceRate}% Average Attendance
              </div>
            </div>

            <div style={{ background: 'var(--bg-card-hover)', borderRadius: '12px', padding: '16px 24px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Top Tier
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)' }}>
                {Math.round((data.globalSchoolRank.rank / data.globalSchoolRank.totalSchools) * 100)}%
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={20} style={{ color: 'var(--primary)' }} />
            Staff Leaderboard
          </h2>
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search staff"
              className="form-input"
              style={{ width: '100%', paddingLeft: '36px', borderRadius: '20px' }}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 20px' }}>Staff Member</th>
                <th style={{ padding: '12px 20px', width: '120px' }}>Overall Rank</th>
                <th style={{ padding: '12px 20px', width: '100px' }}>Local Rank</th>
                <th style={{ padding: '12px 20px' }}>Badges</th>
                <th style={{ padding: '12px 20px', textAlign: 'right' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Loading rankings...
                  </td>
                </tr>
              ) : data?.staff?.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No staff rankings found for this period.
                  </td>
                </tr>
              ) : (
                data?.staff?.data?.map((row: any) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {row.photoUrl ? (
                          <img src={row.photoUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary-dim)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                            {row.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{row.position || 'Staff'} • {row.employeeCode}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '14px',
                        background: 'var(--primary-dim)', color: 'var(--primary)', border: `1px solid var(--primary)`                      }}>
                        {row.globalRank}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '14px',
                        background: 'var(--primary-dim)', color: 'var(--primary)', border: `1px solid var(--primary)`
                      }}>
                        {row.localRank}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {row.metrics?.presenceRate >= 95 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '100px', background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success)', fontSize: '11px', fontWeight: 700 }} title="Presence >= 95%">
                            <Medal size={12} /> Pillar
                          </span>
                        )}
                        {row.metrics?.punctualityRate >= 95 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '100px', background: 'var(--warning-dim)', color: 'var(--warning)', border: '1px solid var(--warning)', fontSize: '11px', fontWeight: 700 }} title="Punctuality >= 95%">
                            <Zap size={12} /> Early Bird
                          </span>
                        )}
                        {row.metrics?.hoursCompletionRate >= 95 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '100px', background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary)', fontSize: '11px', fontWeight: 700 }} title="Hours Completion >= 95%">
                            <Clock size={12} /> Diligent
                          </span>
                        )}
                        {(!row.metrics || (row.metrics.presenceRate < 95 && row.metrics.punctualityRate < 95 && row.metrics.hoursCompletionRate < 95)) && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: rateColor(row.metrics?.score || 0) }}>
                        {formatPct(row.metrics?.score || 0)}%
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setExplainEmpModal(row)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'var(--primary-dim)',
                            color: 'var(--primary)',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data?.staff?.totalPages > 1 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Showing page <strong style={{ color: 'var(--text-primary)' }}>{data.staff.page}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{data.staff.totalPages}</strong>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', opacity: page === 1 ? 0.5 : 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button 
                onClick={() => setPage(p => Math.min(data.staff.totalPages, p + 1))}
                disabled={page === data.staff.totalPages}
                style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', opacity: page === data.staff.totalPages ? 0.5 : 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', cursor: page === data.staff.totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {explainEmpModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "20px",
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={() => setExplainEmpModal(null)}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "500px",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 50px rgba(0,0,0,0.5)",
              overflowY: "auto",
              maxHeight: "85vh",
              animation: "slideUp 0.3s ease-out",
              padding: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: 800,
                    margin: 0,
                    color: "var(--text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  Performance Report Details
                </h2>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    margin: "4px 0 0",
                  }}
                >
                  Detailed breakdown for <strong>{explainEmpModal.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setExplainEmpModal(null)}
                title="Close"
                aria-label="Close modal"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "var(--bg-card-hover)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.background = "var(--border)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.background = "var(--bg-card-hover)";
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                marginBottom: "24px",
              }}
            >
              Overall score is a composite grade combining four different
              habits. Some habits are worth more points than others.
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {[
                {
                  label: "Showing Up (Presence)",
                  weight: 40,
                  weightMult: 0.4,
                  val: explainEmpModal.metrics.presenceRate,
                  desc: `Showed up for expected workdays.`,
                },
                {
                  label: "Being on Time (Punctuality)",
                  weight: 30,
                  weightMult: 0.3,
                  val: explainEmpModal.metrics.punctualityRate,
                  desc: `Clocked in and out on time.`,
                },
                {
                  label: "Putting in the Hours (Hours)",
                  weight: 20,
                  weightMult: 0.2,
                  val: explainEmpModal.metrics.hoursCompletionRate,
                  desc: `Completed required shift hours.`,
                },
                {
                  label: "Remembering to Sign Out",
                  weight: 10,
                  weightMult: 0.1,
                  val: explainEmpModal.metrics.forgotOutRate,
                  desc: `Successfully signed out when leaving.`,
                },
              ].map((metric) => {
                const points = (metric.val * metric.weightMult).toFixed(2);
                return (
                  <div
                    key={metric.label}
                    style={{
                      background: "var(--bg-card-hover)",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "14px",
                          color: "var(--text-primary)",
                        }}
                      >
                        {metric.label}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 800,
                          color: "var(--text-secondary)",
                          background: "var(--bg-dashboard)",
                          padding: "4px 8px",
                          borderRadius: "6px",
                        }}
                      >
                        Worth {metric.weight}%
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        marginBottom: "12px",
                      }}
                    >
                      {metric.desc} Rate:{" "}
                      <strong style={{ color: rateColor(metric.val) }}>
                        {formatPct(metric.val)}%
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          borderRadius: "6px",
                          background: "var(--border)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${metric.val}%`,
                            background: rateColor(metric.val),
                            borderRadius: "6px",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 800,
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        +{points} pts
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                borderRadius: "12px",
                background: "rgba(139,92,246,0.08)",
                border: "1px solid rgba(139,92,246,0.2)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}
              >
                Final Score
              </div>
              <div
                style={{ fontSize: "24px", fontWeight: 900, color: rateColor(explainEmpModal.metrics.score) }}
              >
                {formatPct(explainEmpModal.metrics.score)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
