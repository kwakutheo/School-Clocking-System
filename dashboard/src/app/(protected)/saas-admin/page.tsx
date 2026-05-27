"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saasAdminApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Cell,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import {
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  Megaphone,
  Plus,
  ArrowRight,
  Activity,
  Award,
  Clock,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Minus,
  Star,
  Zap,
  Eye,
  BarChart2,
  X,
  Search,
  UserCircle2,
  Timer,
  LogOut,
  CalendarCheck,
  Trophy,
  AlertOctagon,
} from "lucide-react";

const formatPct = (val: number) => parseFloat((val || 0).toFixed(2));

// ── Types ────────────────────────────────────────────────────────────────────
interface SchoolMetric {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  primaryColor: string;
  logoUrl: string | null;
  createdAt: string;
  metrics: {
    employees: number;
    branches: number;
    presenceRate: number;
    sustained30DayRate: number;
    presentInTimeframe: number;
    expectedEmployeeDays: number;
  };
}

interface PlatformStats {
  overview: {
    totalSchools: number;
    activeSchools: number;
    suspendedSchools: number;
    trackedEmployees: number;
    presentInTimeframe: number;
    presenceRate: number;
    history: number[];
    momGrowth: number;
    cohorts: { excellent: number; warning: number; critical: number };
  };
  topFive: SchoolMetric[];
  bottomFive: SchoolMetric[];
  topTenSustained: SchoolMetric[];
  health: { apiStatus: string; databaseUptime: string; latencyMs: number };
}

interface EmployeeRanking {
  id: string;
  name: string;
  employeeCode: string;
  position: string | null;
  photoUrl: string | null;
  school: { id: string; name: string; primaryColor: string; slug: string };
  metrics: {
    presenceRate: number;
    punctualityRate: number;
    hoursCompletionRate: number;
    forgotOutRate: number;
    score: number;
    daysPresent: number;
    expectedDays: number;
    earlyOutCount: number;
    forgotOutCount: number;
  };
  rank?: number;
  totalEmployees?: number;
}

interface EmployeeRankingPage {
  data: EmployeeRanking[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type Timeframe = "today" | "7d" | "30d" | "term";

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  today: "Today",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  term: "Current Term",
};

const WEEK_LABELS = [
  "6W Ago",
  "5W Ago",
  "4W Ago",
  "3W Ago",
  "2W Ago",
  "Last Wk",
  "This Wk",
];
const EMP_MODAL_LIMIT = 50;

// ── Rate Colour Helper ────────────────────────────────────────────────────────
function rateColor(rate: number) {
  if (rate >= 90) return "#22c55e";
  if (rate >= 75) return "#f59e0b";
  return "#ef4444";
}
function rateBg(rate: number) {
  if (rate >= 90) return "rgba(34,197,94,0.12)";
  if (rate >= 75) return "rgba(245,158,11,0.12)";
  return "rgba(239,68,68,0.12)";
}
function rateLabel(rate: number) {
  if (rate >= 90) return "Excellent";
  if (rate >= 75) return "Warning";
  return "Critical";
}

// ── MoM Delta Badge ──────────────────────────────────────────────────────────
function DeltaBadge({ value }: { value: number }) {
  if (value > 0)
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          color: "#22c55e",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        <ChevronUp size={14} />
        {formatPct(value)}%
      </span>
    );
  if (value < 0)
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          color: "#ef4444",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        <ChevronDown size={14} />
        {formatPct(Math.abs(value))}%
      </span>
    );
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        color: "var(--text-secondary)",
        fontSize: "13px",
        fontWeight: 700,
      }}
    >
      <Minus size={14} />
      0%
    </span>
  );
}

// ── Attendance Rate Ring ─────────────────────────────────────────────────────
function RateRing({ rate }: { rate: number }) {
  const color = rateColor(rate);
  const r = 60;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  return (
    <svg
      width="140"
      height="140"
      viewBox="0 0 140 140"
      style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.05))" }}
    >
      <defs>
        <filter
          id={`glow-${rate}`}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth="12"
      />
      {rate > 0 && (
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          filter={`url(#glow-${rate})`}
          style={{ transition: "stroke-dasharray 1.2s ease, stroke 0.3s ease" }}
        />
      )}
      <text
        x="70"
        y="65"
        textAnchor="middle"
        fill={color}
        fontSize="26"
        fontWeight="900"
        fontFamily="inherit"
      >
        {formatPct(rate)}%
      </text>
      <text
        x="70"
        y="85"
        textAnchor="middle"
        fill="var(--text-secondary)"
        fontSize="12"
        fontWeight="600"
        fontFamily="inherit"
        letterSpacing="0.05em"
      >
        GLOBAL
      </text>
    </svg>
  );
}

// ── Mini Sparkline (SVG) ─────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const w = 80,
    h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data) || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── School Rank Row ──────────────────────────────────────────────────────────
function SchoolRankRow({
  rank,
  school,
  timeframe,
  onViewPortal,
}: {
  rank: number;
  school: SchoolMetric;
  timeframe: Timeframe;
  onViewPortal: (school: SchoolMetric) => void;
}) {
  const rate = school.metrics.presenceRate ?? 0;
  const color = rateColor(rate);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "14px 20px",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--bg-card-hover)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Rank badge */}
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: "12px",
          background: "var(--bg-card-hover)",
          color: "var(--text-secondary)",
        }}
      >
        {rank}
      </div>

      {/* Color dot */}
      <div
        style={{
          width: "9px",
          height: "9px",
          borderRadius: "50%",
          flexShrink: 0,
          backgroundColor: school.primaryColor,
          boxShadow: `0 0 6px ${school.primaryColor}88`,
        }}
      />

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: "14px",
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {school.name}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            marginTop: "1px",
          }}
        >
          {school.metrics.employees} employees · {school.metrics.branches}{" "}
          {school.metrics.branches === 1 ? "branch" : "branches"}
        </div>
      </div>

      {/* Rate bar */}
      <div style={{ width: "90px", flexShrink: 0 }}>
        <div
          style={{
            height: "4px",
            borderRadius: "4px",
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: "4px",
              width: `${Math.min(100, rate)}%`,
              background: color,
              transition: "width 0.8s ease",
            }}
          />
        </div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color,
            marginTop: "4px",
            textAlign: "right",
          }}
        >
          {formatPct(rate)}%
        </div>
      </div>

      {/* Status pill */}
      <div
        style={{
          padding: "3px 9px",
          borderRadius: "20px",
          fontSize: "11px",
          fontWeight: 700,
          background: rateBg(rate),
          color,
          flexShrink: 0,
          minWidth: "68px",
          textAlign: "center",
        }}
      >
        {rateLabel(rate)}
      </div>

      {/* View Portal button */}
      <button
        onClick={() => onViewPortal(school)}
        title="View school portal"
        style={{
          padding: "5px 10px",
          borderRadius: "7px",
          fontSize: "12px",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: "5px",
          background: "rgba(236,72,153,0.08)",
          color: "#ec4899",
          border: "1px solid rgba(236,72,153,0.25)",
          cursor: "pointer",
          transition: "all 0.2s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(236,72,153,0.16)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(236,72,153,0.08)";
        }}
      >
        <Eye size={11} /> View
      </button>
    </div>
  );
}

// ── Employee Rank Row ─────────────────────────────────────────────────────────
function EmployeeRankRow({
  rank,
  emp,
  onExplain,
}: {
  rank: number;
  emp: EmployeeRanking;
  onExplain?: (emp: EmployeeRanking) => void;
}) {
  const score = emp.metrics.score;
  const scoreColor = rateColor(score);
  const [hovered, setHovered] = useState(false);

  // Generate initials avatar from name
  const initials = emp.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 20px",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.15s",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-card-hover)";
        setHovered(true);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        setHovered(false);
      }}
    >
      {/* Rank badge */}
      <div
        style={{
          width: "26px",
          height: "26px",
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: "11px",
          background: "var(--bg-card-hover)",
          color: "var(--text-secondary)",
          border: "none",
        }}
      >
        {emp.rank ?? rank}
      </div>

      {/* Avatar */}
      <div
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          flexShrink: 0,
          background: emp.photoUrl
            ? "transparent"
            : emp.school.primaryColor + "33",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
          fontWeight: 800,
          color: emp.school.primaryColor,
          border: `2px solid ${emp.school.primaryColor}44`,
          overflow: "hidden",
        }}
      >
        {emp.photoUrl ? (
          <img
            src={emp.photoUrl}
            alt={emp.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initials
        )}
      </div>

      {/* Name + school */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: "13px",
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {emp.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "2px",
          }}
        >
          <div
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: emp.school.primaryColor,
              flexShrink: 0,
              boxShadow: `0 0 5px ${emp.school.primaryColor}88`,
            }}
          />
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {emp.school.name}
            {emp.position ? ` · ${emp.position}` : ""}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ width: "80px", flexShrink: 0 }}>
        <div
          style={{
            height: "4px",
            borderRadius: "4px",
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: "4px",
              width: `${Math.min(100, score)}%`,
              background: scoreColor,
              transition: "width 0.8s ease",
            }}
          />
        </div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 800,
            color: scoreColor,
            marginTop: "3px",
            textAlign: "right",
          }}
        >
          {formatPct(score)}%
        </div>
      </div>

      {/* Hover: metric breakdown tooltip */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            right: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "10px 14px",
            zIndex: 100,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            display: "flex",
            gap: "16px",
            pointerEvents: "auto",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {[
            {
              icon: <CalendarCheck size={11} />,
              label: "Presence",
              value: emp.metrics.presenceRate,
              color: rateColor(emp.metrics.presenceRate),
            },
            {
              icon: <Timer size={11} />,
              label: "Punctuality",
              value: emp.metrics.punctualityRate,
              color: rateColor(emp.metrics.punctualityRate),
            },
            {
              icon: <Clock size={11} />,
              label: "Hours",
              value: emp.metrics.hoursCompletionRate,
              color: rateColor(emp.metrics.hoursCompletionRate),
            },
            {
              icon: <LogOut size={11} />,
              label: "Sign-outs",
              value: emp.metrics.forgotOutRate,
              color: rateColor(emp.metrics.forgotOutRate),
            },
          ].map(({ icon, label, value, color }) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
              }}
            >
              <span
                style={{
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "10px",
                }}
              >
                {icon} {label}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 800, color }}>
                {formatPct(value)}%
              </span>
            </div>
          ))}
          {emp.metrics.earlyOutCount > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
              }}
            >
              <span
                style={{ color: "var(--text-secondary)", fontSize: "10px" }}
              >
                Early Outs
              </span>
              <span
                style={{ fontSize: "12px", fontWeight: 800, color: "#f59e0b" }}
              >
                {emp.metrics.earlyOutCount}×
              </span>
            </div>
          )}
          {emp.metrics.forgotOutCount > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
              }}
            >
              <span
                style={{ color: "var(--text-secondary)", fontSize: "10px" }}
              >
                Forgot Out
              </span>
              <span
                style={{ fontSize: "12px", fontWeight: 800, color: "#ef4444" }}
              >
                {emp.metrics.forgotOutCount}×
              </span>
            </div>
          )}
          {onExplain && (
            <div
              style={{
                borderLeft: "1px solid var(--border)",
                paddingLeft: "16px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExplain(emp);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "rgba(139,92,246,0.1)",
                  color: "#8b5cf6",
                  border: "1px solid rgba(139,92,246,0.2)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(139,92,246,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(139,92,246,0.1)";
                }}
              >
                View Details
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SaasOverviewPage() {
  const router = useRouter();
  const { setImpersonatedTenant } = useAuthStore();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("today");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankSort, setRankSort] = useState<"best" | "worst">("best");
  const [rankTab, setRankTab] = useState<"schools" | "employees">("schools");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // School modal state
  const [showAllSchoolsModal, setShowAllSchoolsModal] = useState(false);
  const [allSchoolsLoading, setAllSchoolsLoading] = useState(false);
  const [fullSchoolsList, setFullSchoolsList] = useState<SchoolMetric[]>([]);
  const [modalSearch, setModalSearch] = useState("");
  const [modalTotal, setModalTotal] = useState(0);

  // Employee rankings state
  const [empRankings, setEmpRankings] = useState<EmployeeRanking[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSort, setEmpSort] = useState<"best" | "worst">("best");
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [fullEmpList, setFullEmpList] = useState<EmployeeRanking[]>([]);
  const [empModalLoading, setEmpModalLoading] = useState(false);
  const [empModalSearch, setEmpModalSearch] = useState("");
  const [empModalSchool, setEmpModalSchool] = useState("");
  const [debouncedEmpModalSearch, setDebouncedEmpModalSearch] = useState("");
  const [debouncedEmpModalSchool, setDebouncedEmpModalSchool] = useState("");
  const [empModalPage, setEmpModalPage] = useState(1);
  const [empModalTotal, setEmpModalTotal] = useState(0);
  const [empModalTotalPages, setEmpModalTotalPages] = useState(1);
  const loadedEmpKey = useRef<string | null>(null);

  const [explainEmpModal, setExplainEmpModal] =
    useState<EmployeeRanking | null>(null);

  const loadedTimeframe = useRef<Timeframe | null>(null);

  const fetchAllSchools = useCallback(() => {
    if (fullSchoolsList.length > 0 && loadedTimeframe.current === timeframe)
      return;
    setAllSchoolsLoading(true);
    saasAdminApi
      .listTenants(timeframe, { limit: 10000, sort: "presenceRate:DESC" })
      .then((res) => {
        const list: SchoolMetric[] = Array.isArray(res.data)
          ? res.data
          : res.data?.results || [];
        const rawTotal =
          res.headers?.["x-total-count"] ?? res.headers?.["X-Total-Count"];
        const total = rawTotal ? parseInt(rawTotal, 10) : list.length;
        setModalTotal(total);
        setFullSchoolsList(list);
        loadedTimeframe.current = timeframe;
      })
      .catch((err) => console.error(err))
      .finally(() => {
        setAllSchoolsLoading(false);
      });
  }, [fullSchoolsList.length, timeframe]);

  const handleOpenAllSchoolsModal = () => {
    setShowAllSchoolsModal(true);
    setModalSearch("");
    fetchAllSchools();
  };

  // Fetch employee rankings only when the staff tab is opened.
  useEffect(() => {
    if (rankTab !== "employees") return;
    const key = `${timeframe}-${empSort}`;
    if (loadedEmpKey.current === key && empRankings.length > 0) return;
    setEmpLoading(true);
    saasAdminApi
      .getEmployeeRankings({ timeframe, sort: empSort, page: 1, limit: 5 })
      .then((res) => {
        const pageData = res.data as EmployeeRankingPage;
        const list: EmployeeRanking[] = Array.isArray(pageData?.data)
          ? pageData.data
          : Array.isArray(res.data)
            ? res.data
            : [];
        setEmpRankings(list);
        loadedEmpKey.current = key;
      })
      .catch((err) => console.error("Employee rankings error:", err))
      .finally(() => setEmpLoading(false));
  }, [timeframe, empSort, rankTab, empRankings.length]);

  const handleOpenEmpModal = () => {
    setShowEmpModal(true);
    setEmpModalSearch("");
    setEmpModalSchool("");
    setDebouncedEmpModalSearch("");
    setDebouncedEmpModalSchool("");
    setEmpModalPage(1);
    setEmpModalTotal(0);
    setEmpModalTotalPages(1);
    setFullEmpList([]);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedEmpModalSearch(empModalSearch.trim());
      setDebouncedEmpModalSchool(empModalSchool.trim());
      setEmpModalPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [empModalSearch, empModalSchool]);

  useEffect(() => {
    if (!showEmpModal) return;

    let cancelled = false;
    setEmpModalLoading(true);
    saasAdminApi
      .getEmployeeRankings({
        timeframe,
        sort: empSort,
        page: empModalPage,
        limit: EMP_MODAL_LIMIT,
        search: debouncedEmpModalSearch || undefined,
        school: debouncedEmpModalSchool || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        const pageData = res.data as EmployeeRankingPage;
        setFullEmpList(Array.isArray(pageData?.data) ? pageData.data : []);
        setEmpModalTotal(Number(pageData?.total) || 0);
        setEmpModalPage(Number(pageData?.page) || 1);
        setEmpModalTotalPages(Number(pageData?.totalPages) || 1);
      })
      .catch((err) => {
        if (!cancelled) console.error(err);
      })
      .finally(() => {
        if (!cancelled) setEmpModalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    showEmpModal,
    timeframe,
    empSort,
    empModalPage,
    debouncedEmpModalSearch,
    debouncedEmpModalSchool,
  ]);

  const fetchStats = useCallback((tf: Timeframe, showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);

    saasAdminApi
      .getStats(tf)
      .then((res) => {
        setStats(res.data);
        setLastRefreshed(new Date());
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load platform statistics. Please try again.");
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    fetchStats(timeframe);
  }, [timeframe, fetchStats]);

  const handleViewPortal = (school: SchoolMetric) => {
    setImpersonatedTenant({
      id: school.id,
      name: school.name,
      slug: school.slug,
      primaryColor: school.primaryColor,
      logoUrl: school.logoUrl,
      customDomain: null,
    });
    router.push("/dashboard");
  };

  // Build chart data from 6-week history
  const trendData = (stats?.overview.history ?? []).map((rate, i) => ({
    week: WEEK_LABELS[i],
    rate: Number(rate.toFixed(1)),
  }));

  // Critical schools (presenceRate < 75) from bottomFive merged with topFive
  const allRanked: SchoolMetric[] =
    rankSort === "best" ? (stats?.topFive ?? []) : (stats?.bottomFive ?? []);

  const criticalSchools = (stats?.bottomFive ?? []).filter(
    (s) => (s.metrics.presenceRate ?? 0) < 75,
  );

  const cohorts = stats?.overview.cohorts ?? {
    excellent: 0,
    warning: 0,
    critical: 0,
  };
  const totalCohort =
    cohorts.excellent + cohorts.warning + cohorts.critical || 1;

  // Sorted full list for the modal (re-sort handles Best/Worst toggle changes while modal is open)
  const sortedFullList = [...fullSchoolsList].sort((a, b) => {
    const rateA = a.metrics.presenceRate ?? 0;
    const rateB = b.metrics.presenceRate ?? 0;
    return rankSort === "best" ? rateB - rateA : rateA - rateB;
  });

  // Client-side search for the modal (allows keeping original ranks)
  const modalFiltered = modalSearch.trim()
    ? sortedFullList.filter((s) =>
        s.name.toLowerCase().includes(modalSearch.trim().toLowerCase()),
      )
    : sortedFullList;

  const empModalStart =
    empModalTotal === 0 ? 0 : (empModalPage - 1) * EMP_MODAL_LIMIT + 1;
  const empModalEnd = Math.min(empModalPage * EMP_MODAL_LIMIT, empModalTotal);

  if (loading) {
    return (
      <div
        className="loading-center"
        style={{ minHeight: "70vh", flexDirection: "column", gap: "16px" }}
      >
        <div className="spinner" />
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Loading platform intelligence…
        </p>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.4s ease-out", paddingBottom: "48px" }}>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "32px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "-0.5px",
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Platform Overview
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                marginTop: "6px",
                fontSize: "14px",
              }}
            >
              Live intelligence across all supervised institutions · Last
              refreshed: {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {/* Timeframe Tabs */}
            <div
              style={{
                display: "flex",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "4px",
                gap: "2px",
              }}
            >
              {(Object.keys(TIMEFRAME_LABELS) as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "7px",
                    fontSize: "13px",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    background:
                      timeframe === tf ? "var(--primary)" : "transparent",
                    color: timeframe === tf ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  {TIMEFRAME_LABELS[tf]}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchStats(timeframe, false)}
              disabled={refreshing}
              title="Refresh stats"
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "9px",
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-secondary)",
                transition: "all 0.2s",
              }}
            >
              <RefreshCw
                size={16}
                style={{
                  animation: refreshing ? "spin 1s linear infinite" : "none",
                }}
              />
            </button>

            {/* Quick Action: Onboard School */}
            <Link href="/saas-admin/schools" style={{ textDecoration: "none" }}>
              <button
                className="btn btn-primary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "9px 18px",
                  borderRadius: "9px",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <Plus size={16} /> Onboard School
              </button>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: "10px",
            padding: "14px 20px",
            marginBottom: "28px",
            color: "#ef4444",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        {/* Total Schools */}
        <div
          className="card"
          style={{ padding: "24px", position: "relative", overflow: "hidden" }}
        >
          <div
            style={{
              position: "absolute",
              top: "-20px",
              right: "-20px",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(139,92,246,0.1)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                Total Schools
              </div>
              <div
                style={{
                  fontSize: "38px",
                  fontWeight: 900,
                  color: "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                {stats?.overview.totalSchools ?? 0}
              </div>
              <div style={{ marginTop: "10px", display: "flex", gap: "12px" }}>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#22c55e",
                    fontWeight: 600,
                  }}
                >
                  ● {stats?.overview.activeSchools ?? 0} Active
                </span>
                {(stats?.overview.suspendedSchools ?? 0) > 0 && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#ef4444",
                      fontWeight: 600,
                    }}
                  >
                    ● {stats?.overview.suspendedSchools} Suspended
                  </span>
                )}
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "rgba(139,92,246,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={22} color="#8b5cf6" />
            </div>
          </div>
        </div>

        {/* Total Employees */}
        <div
          className="card"
          style={{ padding: "24px", position: "relative", overflow: "hidden" }}
        >
          <div
            style={{
              position: "absolute",
              top: "-20px",
              right: "-20px",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(59,130,246,0.1)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                Tracked Employees
              </div>
              <div
                style={{
                  fontSize: "38px",
                  fontWeight: 900,
                  color: "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                {(stats?.overview.trackedEmployees ?? 0).toLocaleString()}
              </div>
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                Across all institutions
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "rgba(59,130,246,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={22} color="#3b82f6" />
            </div>
          </div>
        </div>

        {/* Global Attendance Rate */}
        <div
          className="card"
          style={{ padding: "24px", position: "relative", overflow: "hidden" }}
        >
          <div
            style={{
              position: "absolute",
              top: "-20px",
              right: "-20px",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: `${rateColor(stats?.overview.presenceRate ?? 0)}18`,
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                Global Attendance Rate
              </div>
              <div
                style={{
                  fontSize: "38px",
                  fontWeight: 900,
                  color: rateColor(stats?.overview.presenceRate ?? 0),
                  lineHeight: 1,
                }}
              >
                {formatPct(stats?.overview.presenceRate ?? 0)}%
              </div>
              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                >
                  {TIMEFRAME_LABELS[timeframe]}
                </span>
                <DeltaBadge value={stats?.overview.momGrowth ?? 0} />
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: `${rateColor(stats?.overview.presenceRate ?? 0)}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Activity
                size={22}
                color={rateColor(stats?.overview.presenceRate ?? 0)}
              />
            </div>
          </div>
        </div>

        {/* Critical Schools */}
        <div
          className="card"
          style={{
            padding: "24px",
            position: "relative",
            overflow: "hidden",
            border:
              criticalSchools.length > 0
                ? "1px solid rgba(239,68,68,0.3)"
                : "1px solid var(--border)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-20px",
              right: "-20px",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(239,68,68,0.08)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                Needs Attention
              </div>
              <div
                style={{
                  fontSize: "38px",
                  fontWeight: 900,
                  color: criticalSchools.length > 0 ? "#ef4444" : "#22c55e",
                  lineHeight: 1,
                }}
              >
                {cohorts.critical}
              </div>
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                {cohorts.warning} on warning · {cohorts.excellent} excellent
              </div>
            </div>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "rgba(239,68,68,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={22} color="#ef4444" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Global Rate Ring + Cohort Bar + 6-Week Trend ──────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {/* Left: Global Rate + Cohort Distribution */}
        <div
          className="card"
          style={{
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "32px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 800,
                color: "var(--text)",
                letterSpacing: "0.02em",
              }}
            >
              Platform Health
            </div>
            <div
              style={{
                padding: "4px 10px",
                borderRadius: "20px",
                background: "rgba(34,197,94,0.1)",
                color: "#22c55e",
                fontSize: "11px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  animation: "pulse-dot 2s infinite",
                }}
              />
              Live
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "32px",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Rate Ring Component */}
            <div style={{ flexShrink: 0 }}>
              <RateRing rate={stats?.overview.presenceRate ?? 0} />
            </div>

            {/* Cohort distribution bars */}
            <div
              style={{
                flex: "1 1 200px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {[
                {
                  label: "Excellent",
                  value: cohorts.excellent,
                  color: "#22c55e",
                  bg: "rgba(34,197,94,0.15)",
                  Icon: Trophy,
                },
                {
                  label: "Warning",
                  value: cohorts.warning,
                  color: "#f59e0b",
                  bg: "rgba(245,158,11,0.15)",
                  Icon: AlertTriangle,
                },
                {
                  label: "Critical",
                  value: cohorts.critical,
                  color: "#ef4444",
                  bg: "rgba(239,68,68,0.15)",
                  Icon: AlertOctagon,
                },
              ].map(({ label, value, color, bg, Icon }) => (
                <div key={label}>
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
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "6px",
                          background: bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon size={12} color={color} strokeWidth={3} />
                      </div>
                      <span
                        style={{
                          fontSize: "13px",
                          color: "var(--text-secondary)",
                          fontWeight: 600,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 800, color }}>
                      {value}
                    </span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      borderRadius: "6px",
                      background: "var(--border)",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${(value / totalCohort) * 100}%`,
                        background: `linear-gradient(90deg, ${color}dd, ${color})`,
                        borderRadius: "6px",
                        transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: `0 0 8px ${color}80`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Health Widgets */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              borderTop: "1px solid var(--border)",
              paddingTop: "24px",
            }}
          >
            {[
              {
                label: "API Status",
                value: stats?.health.apiStatus ?? "HEALTHY",
                good: true,
              },
              {
                label: "DB Uptime",
                value: stats?.health.databaseUptime ?? "99.99%",
                good: true,
              },
              {
                label: "Latency",
                value: `${stats?.health.latencyMs ?? 0}ms`,
                good: (stats?.health.latencyMs ?? 0) < 200,
              },
            ].map(({ label, value, good }) => (
              <div
                key={label}
                style={{
                  flex: "1 1 80px",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                  }}
                >
                  {label}
                </span>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: good ? "#22c55e" : "#f59e0b",
                      boxShadow: good ? "0 0 6px rgba(34,197,94,0.6)" : "none",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 800,
                      color: good ? "#22c55e" : "#f59e0b",
                    }}
                  >
                    {value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: 6-Week Trend Chart */}
        <div className="card" style={{ padding: "28px 24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                6-Week Global Attendance Trend
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  marginTop: "4px",
                }}
              >
                Weekly attendance rate across all institutions
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <TrendingUp
                size={16}
                color={
                  (stats?.overview.momGrowth ?? 0 >= 0) ? "#22c55e" : "#ef4444"
                }
              />
              <DeltaBadge value={stats?.overview.momGrowth ?? 0} />
              <span
                style={{ fontSize: "12px", color: "var(--text-secondary)" }}
              >
                vs 6w ago
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={trendData}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}
                formatter={(v: any) => [
                  `${formatPct(Number(v) || 0)}%`,
                  "Attendance Rate",
                ]}
                labelStyle={{ fontWeight: 700 }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={{
                  r: 4,
                  fill: "var(--primary)",
                  strokeWidth: 2,
                  stroke: "var(--bg-card)",
                }}
                activeDot={{
                  r: 6,
                  stroke: "var(--primary)",
                  strokeWidth: 2,
                  fill: "var(--bg-card)",
                }}
              />
              {/* 90% threshold line */}
              <ReferenceLine
                y={90}
                stroke="rgba(34,197,94,0.3)"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            </LineChart>
          </ResponsiveContainer>

          <div style={{ display: "flex", gap: "20px", marginTop: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                color: "var(--text-secondary)",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "3px",
                  background: "var(--primary)",
                  borderRadius: "2px",
                }}
              />
              Global Rate
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                color: "var(--text-secondary)",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "2px",
                  background: "rgba(34,197,94,0.5)",
                  borderRadius: "2px",
                  borderTop: "1px dashed rgba(34,197,94,0.5)",
                }}
              />
              Excellent Threshold (90%)
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Performance Rankings + Sustained ─────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {/* Rankings Card with Institutions / Staff Performance tabs */}
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          {/* Card header */}
          <div
            style={{
              padding: "16px 20px 0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            {/* Sub-tab toggle: Institutions / Staff */}
            <div
              style={{
                display: "flex",
                background: "var(--bg-card-hover)",
                borderRadius: "9px",
                padding: "3px",
                gap: "2px",
                border: "1px solid var(--border)",
              }}
            >
              <button
                onClick={() => setRankTab("schools")}
                style={{
                  padding: "5px 13px",
                  borderRadius: "7px",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background:
                    rankTab === "schools" ? "var(--primary)" : "transparent",
                  color:
                    rankTab === "schools" ? "#fff" : "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Building2 size={11} /> Institutions
              </button>
              <button
                onClick={() => setRankTab("employees")}
                style={{
                  padding: "5px 13px",
                  borderRadius: "7px",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background:
                    rankTab === "employees" ? "#8b5cf6" : "transparent",
                  color:
                    rankTab === "employees" ? "#fff" : "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <UserCircle2 size={11} /> Staff Performance
              </button>
            </div>

            {/* Best / Worst toggle — common to both tabs */}
            <div
              style={{
                display: "flex",
                background: "var(--bg-card-hover)",
                borderRadius: "8px",
                padding: "3px",
                gap: "2px",
                border: "1px solid var(--border)",
              }}
            >
              <button
                onClick={() => {
                  setRankSort("best");
                  setEmpSort("best");
                  loadedEmpKey.current = null;
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background:
                    (rankTab === "schools" ? rankSort : empSort) === "best"
                      ? "#22c55e"
                      : "transparent",
                  color:
                    (rankTab === "schools" ? rankSort : empSort) === "best"
                      ? "#fff"
                      : "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <ChevronUp size={12} /> Best
              </button>
              <button
                onClick={() => {
                  setRankSort("worst");
                  setEmpSort("worst");
                  loadedEmpKey.current = null;
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background:
                    (rankTab === "schools" ? rankSort : empSort) === "worst"
                      ? "#ef4444"
                      : "transparent",
                  color:
                    (rankTab === "schools" ? rankSort : empSort) === "worst"
                      ? "#fff"
                      : "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <ChevronDown size={12} /> Worst
              </button>
            </div>
          </div>

          {/* Subtitle */}
          <div
            style={{
              padding: "6px 20px 0",
              fontSize: "12px",
              color: "var(--text-secondary)",
            }}
          >
            {TIMEFRAME_LABELS[timeframe]} ·{" "}
            {rankTab === "schools"
              ? rankSort === "best"
                ? "Top-performing institutions"
                : "Lowest-performing institutions"
              : empSort === "best"
                ? "Highest composite staff scores"
                : "Lowest composite staff scores"}
          </div>

          {/* ── SCHOOLS TAB ─────────────────────────────────────────────── */}
          {rankTab === "schools" && (
            <>
              <div style={{ marginTop: "12px" }}>
                {allRanked.length === 0 ? (
                  <div
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      fontSize: "14px",
                    }}
                  >
                    No schools data available yet.
                  </div>
                ) : (
                  allRanked.map((school, i) => (
                    <SchoolRankRow
                      key={school.id}
                      rank={
                        rankSort === "worst"
                          ? (stats?.overview.totalSchools ?? allRanked.length) -
                            i
                          : i + 1
                      }
                      school={school}
                      timeframe={timeframe}
                      onViewPortal={handleViewPortal}
                    />
                  ))
                )}
              </div>
              <div
                style={{
                  padding: "14px 20px",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  onClick={handleOpenAllSchoolsModal}
                  style={{
                    width: "100%",
                    padding: "9px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-card-hover)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  View All Schools
                </button>
              </div>
            </>
          )}

          {/* ── EMPLOYEES TAB ───────────────────────────────────────────── */}
          {rankTab === "employees" && (
            <>
              {/* Score legend */}
              <div
                style={{
                  padding: "10px 20px 0",
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                {[
                  { label: "Presence", pct: "40%", color: "#8b5cf6" },
                  { label: "Punctuality", pct: "30%", color: "#3b82f6" },
                  { label: "Hours", pct: "20%", color: "#f59e0b" },
                  { label: "Sign-outs", pct: "10%", color: "#22c55e" },
                ].map(({ label, pct, color }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: color,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--text-secondary)",
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </span>
                    <span style={{ fontSize: "10px", color, fontWeight: 700 }}>
                      {pct}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "8px" }}>
                {empLoading ? (
                  <div
                    style={{
                      padding: "40px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div className="spinner" />
                    <span
                      style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Calculating performance scores…
                    </span>
                  </div>
                ) : empRankings.length === 0 ? (
                  <div
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      fontSize: "14px",
                    }}
                  >
                    No attendance data available for this timeframe.
                  </div>
                ) : (
                  empRankings.map((emp, i) => (
                    <EmployeeRankRow
                      key={emp.id}
                      rank={i + 1}
                      emp={emp}
                      onExplain={setExplainEmpModal}
                    />
                  ))
                )}
              </div>

              <div
                style={{
                  padding: "14px 20px",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  onClick={handleOpenEmpModal}
                  style={{
                    width: "100%",
                    padding: "9px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    border: "1px solid rgba(139,92,246,0.3)",
                    background: "rgba(139,92,246,0.06)",
                    color: "#8b5cf6",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(139,92,246,0.14)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(139,92,246,0.06)";
                  }}
                >
                  <Trophy size={13} /> View All Staff Rankings
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Column: Sustained Performers */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Sustained Performers */}
          <div
            className="card"
            style={{ padding: "0", overflow: "hidden", flex: "1 1 auto" }}
          >
            <div
              style={{
                padding: "20px 20px 0",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(245,158,11,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Award size={16} color="#f59e0b" />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Consistently Best
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginTop: "1px",
                  }}
                >
                  Top sustained attendance over 30 days
                </div>
              </div>
            </div>
            <div style={{ marginTop: "12px" }}>
              {(stats?.topTenSustained ?? []).length === 0 ? (
                <div
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    fontSize: "13px",
                  }}
                >
                  No data available yet.
                </div>
              ) : (
                (stats?.topTenSustained ?? []).map((school, i) => (
                  <div
                    key={school.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "11px 20px",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 800,
                        color: "#f59e0b",
                        minWidth: "18px",
                      }}
                    >
                      #{i + 1}
                    </span>
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: school.primaryColor,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: "13px",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {school.name}
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#f59e0b",
                      }}
                    >
                      {(school.metrics.sustained30DayRate ?? 0).toFixed(1)}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── View All Employees Modal ──────────────────────────────────────── */}
      {showEmpModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={() => setShowEmpModal(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "860px",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
              overflow: "hidden",
              animation: "slideUp 0.3s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-card)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "14px",
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
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "rgba(139,92,246,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Trophy size={16} color="#8b5cf6" />
                    </div>
                    Staff Performance Rankings
                  </h2>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      margin: "5px 0 0",
                    }}
                  >
                    {empSort === "best" ? "Highest" : "Lowest"} composite scores
                    · {TIMEFRAME_LABELS[timeframe]} · {empModalTotal} employees
                    ranked
                  </p>
                </div>
                <button
                  onClick={() => setShowEmpModal(false)}
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
              {/* Search + school filter row */}
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search
                    size={14}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-secondary)",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search by employee name…"
                    value={empModalSearch}
                    onChange={(e) => {
                      setEmpModalSearch(e.target.value);
                      setEmpModalPage(1);
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 12px 9px 34px",
                      borderRadius: "9px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-card-hover)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#8b5cf6";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                    }}
                  />
                </div>
                <div style={{ position: "relative", minWidth: "200px" }}>
                  <Building2
                    size={14}
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-secondary)",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Filter by school…"
                    value={empModalSchool}
                    onChange={(e) => {
                      setEmpModalSchool(e.target.value);
                      setEmpModalPage(1);
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 12px 9px 34px",
                      borderRadius: "9px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-card-hover)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#8b5cf6";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "40px 46px 1fr 100px 100px 100px 100px 88px",
                padding: "8px 20px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-card-hover)",
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              <span>#</span>
              <span></span>
              <span>Employee / School</span>
              <span style={{ textAlign: "right" }}>Presence</span>
              <span style={{ textAlign: "right" }}>Punctuality</span>
              <span style={{ textAlign: "right" }}>Hours</span>
              <span style={{ textAlign: "right" }}>Sign-outs</span>
              <span style={{ textAlign: "right" }}>Score</span>
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                background: "var(--bg-dashboard)",
              }}
            >
              {(() => {
                if (empModalLoading)
                  return (
                    <div
                      style={{
                        padding: "60px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "16px",
                      }}
                    >
                      <div className="spinner" />
                      <div
                        style={{
                          fontSize: "14px",
                          color: "var(--text-secondary)",
                          fontWeight: 600,
                        }}
                      >
                        Calculating staff rankings...
                      </div>
                    </div>
                  );
                const filtered = fullEmpList;
                if (filtered.length === 0)
                  return (
                    <div
                      style={{
                        padding: "60px",
                        textAlign: "center",
                        color: "var(--text-secondary)",
                        fontSize: "14px",
                      }}
                    >
                      {empModalSearch || empModalSchool
                        ? "No employees match your filters."
                        : "No attendance data available."}
                    </div>
                  );
                return filtered.map((emp, i) => {
                  const scoreColor = rateColor(emp.metrics.score);
                  const initials = emp.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? "")
                    .join("");
                  return (
                    <div
                      key={emp.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "40px 46px 1fr 100px 100px 100px 100px 88px",
                        padding: "10px 20px",
                        borderBottom: "1px solid var(--border)",
                        alignItems: "center",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "var(--bg-card-hover)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      {/* Rank */}
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          color: "var(--text-secondary)",
                        }}
                      >
                        #{emp.rank ?? i + 1}
                      </span>
                      {/* Avatar */}
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: emp.school.primaryColor + "33",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          fontWeight: 800,
                          color: emp.school.primaryColor,
                          border: `2px solid ${emp.school.primaryColor}55`,
                        }}
                      >
                        {emp.photoUrl ? (
                          <img
                            src={emp.photoUrl}
                            alt={emp.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              borderRadius: "50%",
                            }}
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      {/* Name + school */}
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "13px",
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {emp.name}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            marginTop: "1px",
                          }}
                        >
                          <div
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: emp.school.primaryColor,
                            }}
                          />
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--text-secondary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {emp.school.name}
                          </span>
                        </div>
                      </div>
                      {/* Metrics */}
                      {[
                        emp.metrics.presenceRate,
                        emp.metrics.punctualityRate,
                        emp.metrics.hoursCompletionRate,
                        emp.metrics.forgotOutRate,
                      ].map((v, mi) => (
                        <span
                          key={mi}
                          style={{
                            textAlign: "right",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: rateColor(v),
                          }}
                        >
                          {formatPct(v)}%
                        </span>
                      ))}
                      {/* Score */}
                      <span
                        style={{
                          textAlign: "right",
                          fontSize: "13px",
                          fontWeight: 900,
                          color: scoreColor,
                        }}
                      >
                        {formatPct(emp.metrics.score)}%
                      </span>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid var(--border)",
                background: "var(--bg-card)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                Showing{" "}
                <strong>
                  {empModalStart}-{empModalEnd}
                </strong>{" "}
                of <strong>{empModalTotal}</strong> employees · Page{" "}
                {empModalPage} of {empModalTotalPages}
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <button
                  onClick={() => setEmpModalPage((p) => Math.max(1, p - 1))}
                  disabled={empModalLoading || empModalPage <= 1}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor:
                      empModalLoading || empModalPage <= 1
                        ? "not-allowed"
                        : "pointer",
                    opacity: empModalLoading || empModalPage <= 1 ? 0.5 : 1,
                  }}
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setEmpModalPage((p) => Math.min(empModalTotalPages, p + 1))
                  }
                  disabled={
                    empModalLoading || empModalPage >= empModalTotalPages
                  }
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor:
                      empModalLoading || empModalPage >= empModalTotalPages
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      empModalLoading || empModalPage >= empModalTotalPages
                        ? 0.5
                        : 1,
                  }}
                >
                  Next
                </button>
                <button
                  onClick={() => setShowEmpModal(false)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-card-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── View All Schools Modal ────────────────────────────────────────── */}
      {showAllSchoolsModal && (
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
            zIndex: 9999,
            padding: "20px",
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={() => setShowAllSchoolsModal(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "800px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 50px rgba(0,0,0,0.3)",
              overflow: "hidden",
              animation: "slideUp 0.3s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-card)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "18px",
                      fontWeight: 800,
                      margin: 0,
                      color: "var(--text-primary)",
                    }}
                  >
                    All Registered Schools
                  </h2>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      margin: "4px 0 0",
                    }}
                  >
                    Sorted by {rankSort === "best" ? "highest" : "lowest"}{" "}
                    presence rate · {modalTotal} total schools
                  </p>
                </div>
                <button
                  onClick={() => setShowAllSchoolsModal(false)}
                  aria-label="Close modal"
                  title="Close"
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
              {/* Search bar */}
              <div style={{ position: "relative" }}>
                <Search
                  size={15}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-secondary)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search schools by name…"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    borderRadius: "9px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-card-hover)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                />
              </div>
            </div>

            {/* Modal Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "0",
                background: "var(--bg-dashboard)",
              }}
            >
              {allSchoolsLoading ? (
                <div
                  style={{
                    padding: "60px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <div className="spinner" />
                  <div
                    style={{
                      fontSize: "14px",
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                    }}
                  >
                    Loading school data...
                  </div>
                </div>
              ) : modalFiltered.length === 0 ? (
                <div
                  style={{
                    padding: "60px",
                    textAlign: "center",
                    color: "var(--text-secondary)",
                  }}
                >
                  {modalSearch
                    ? `No schools match "${modalSearch}".`
                    : "No schools found."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {modalFiltered.map((school) => {
                    const originalIndex = sortedFullList.indexOf(school);
                    return (
                      <SchoolRankRow
                        key={school.id}
                        rank={
                          rankSort === "worst"
                            ? (modalTotal || sortedFullList.length) -
                              originalIndex
                            : originalIndex + 1
                        }
                        school={school}
                        timeframe={timeframe}
                        onViewPortal={() => {
                          setShowAllSchoolsModal(false);
                          handleViewPortal(school);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border)",
                background: "var(--bg-card)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                {modalSearch
                  ? `${modalFiltered.length} matches found`
                  : `${modalTotal} schools total`}
              </div>
              <button
                onClick={() => setShowAllSchoolsModal(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-card-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Explain Score Modal ───────────────────────────────────────────── */}
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
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "500px",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 50px rgba(0,0,0,0.3)",
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
                  Performance Report Card
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
                style={{ fontWeight: 700, fontSize: "14px", color: "#8b5cf6" }}
              >
                Final Composite Score
              </div>
              <div
                style={{ fontSize: "24px", fontWeight: 900, color: "#8b5cf6" }}
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
