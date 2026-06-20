'use client';
import { useState, useEffect } from 'react';
import { Trophy, Search, ChevronLeft, ChevronRight, Award, Clock, Medal, Zap, Star } from 'lucide-react';
import { attendanceApi, calendarApi } from '@/lib/api';

export default function RankingsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [terms, setTerms] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Initial load: fetch terms to get current academic year/term
  useEffect(() => {
    const init = async () => {
      try {
        const res = await calendarApi.listTerms();
        const allTerms = res.data;
        setTerms(allTerms);
        
        const years = Array.from(new Set(allTerms.map((t: any) => t.academicYear))) as string[];
        setAcademicYears(years);

        // Find active or most recent
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
           // fallback to newest term
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
    // Only fetch rankings if we have either determined there are no terms, or we have selected a year
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
        termName: selectedTerm === 'Full Year' ? undefined : (selectedTerm || undefined),
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
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
            <Trophy className="w-8 h-8 text-violet-600" />
            Performance Rankings
          </h1>
          <p className="text-muted-foreground mt-1">View staff rankings and your school's global position.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <select 
            value={selectedYear} 
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setSelectedTerm('Full Year');
            }}
            aria-label="Filter by Academic Year"
            className="px-4 py-2 bg-card border rounded-xl shadow-sm focus:ring-2 focus:ring-violet-500 outline-none w-full sm:w-auto"
          >
            <option value="">All Time</option>
            {academicYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select 
            value={selectedTerm} 
            onChange={(e) => setSelectedTerm(e.target.value)}
            disabled={!selectedYear}
            aria-label="Filter by Term"
            className="px-4 py-2 bg-card border rounded-xl shadow-sm focus:ring-2 focus:ring-violet-500 outline-none disabled:opacity-50 w-full sm:w-auto"
          >
            <option value="Full Year">Full Academic Year</option>
            {availableTermsForYear.map(t => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Position Card */}
      {data?.globalSchoolRank && (
        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Trophy className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-violet-200 font-medium tracking-wider uppercase text-sm mb-2">Global School Position</p>
              <h2 className="text-5xl font-black mb-2 flex items-baseline gap-2">
                #{data.globalSchoolRank.rank} 
                <span className="text-2xl text-violet-200 font-medium whitespace-nowrap">of {data.globalSchoolRank.totalSchools} Schools</span>
              </h2>
              <p className="text-violet-100 flex items-center gap-2 mt-4 text-lg">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                {data.globalSchoolRank.presenceRate}% Average Presence Rate
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 self-stretch flex items-center">
              <div className="text-center">
                <div className="text-sm text-violet-200 font-medium uppercase tracking-wider mb-1">Top Tier</div>
                <div className="text-3xl font-bold text-white">
                  {Math.round((data.globalSchoolRank.rank / data.globalSchoolRank.totalSchools) * 100)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff Leaderboard */}
      <div className="bg-card rounded-3xl shadow-sm border overflow-hidden">
        <div className="p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-violet-600" />
            Staff Leaderboard
          </h3>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search staff"
              className="w-full pl-9 pr-4 py-2 bg-muted/50 border-transparent rounded-full focus:ring-2 focus:ring-violet-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 text-muted-foreground uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Rank</th>
                <th className="px-6 py-4 font-semibold">Staff Member</th>
                <th className="px-6 py-4 font-semibold hidden md:table-cell">Badges</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Composite Score</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    Loading rankings...
                  </td>
                </tr>
              ) : data?.staff?.data?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    No staff rankings found for this period.
                  </td>
                </tr>
              ) : (
                data?.staff?.data?.map((row: any) => (
                  <tr key={row.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                          ${row.localRank === 1 ? 'bg-gradient-to-br from-yellow-200 to-yellow-400 text-yellow-900 shadow-sm border border-yellow-300' : 
                            row.localRank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 shadow-sm border border-slate-300' :
                            row.localRank === 3 ? 'bg-gradient-to-br from-orange-200 to-orange-400 text-orange-900 shadow-sm border border-orange-300' :
                            'bg-muted text-muted-foreground border'}`}>
                          #{row.localRank}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full whitespace-nowrap">Global: #{row.globalRank}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {row.photoUrl ? (
                          <img src={row.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold shrink-0">
                            {row.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-foreground group-hover:text-violet-600 transition-colors whitespace-nowrap">{row.name}</div>
                          <div className="text-xs text-muted-foreground">{row.position || 'Staff'} • {row.employeeCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="flex gap-2 flex-wrap">
                        {row.metrics?.presenceRate >= 95 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200 shadow-sm" title="Presence >= 95%">
                            <Medal className="w-3 h-3" /> Pillar
                          </span>
                        )}
                        {row.metrics?.punctualityRate >= 95 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium border border-emerald-200 shadow-sm" title="Punctuality >= 95%">
                            <Zap className="w-3 h-3" /> Early Bird
                          </span>
                        )}
                        {row.metrics?.hoursCompletionRate >= 95 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium border border-purple-200 shadow-sm" title="Hours Completion >= 95%">
                            <Clock className="w-3 h-3" /> Diligent
                          </span>
                        )}
                        {(!row.metrics || (row.metrics.presenceRate < 95 && row.metrics.punctualityRate < 95 && row.metrics.hoursCompletionRate < 95)) && (
                          <span className="text-xs text-muted-foreground italic px-2 py-1">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-2xl font-black text-foreground">
                        {row.metrics?.score?.toFixed(1) || '0.0'}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-col items-end gap-1 mt-1">
                        <span title="Presence Rate">Pr: {row.metrics?.presenceRate}%</span>
                        <span title="Punctuality Rate">Pu: {row.metrics?.punctualityRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.staff?.totalPages > 1 && (
          <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/10">
            <div className="text-sm text-muted-foreground">
              Showing page <span className="font-medium text-foreground">{data.staff.page}</span> of <span className="font-medium text-foreground">{data.staff.totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg border bg-card hover:bg-muted disabled:opacity-50 transition-colors flex items-center gap-1 text-sm font-medium"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button 
                onClick={() => setPage(p => Math.min(data.staff.totalPages, p + 1))}
                disabled={page === data.staff.totalPages}
                className="px-3 py-2 rounded-lg border bg-card hover:bg-muted disabled:opacity-50 transition-colors flex items-center gap-1 text-sm font-medium"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
