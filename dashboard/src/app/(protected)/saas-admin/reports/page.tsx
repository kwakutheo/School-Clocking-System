'use client';
import { useEffect, useState, useCallback } from 'react';
import { saasAdminApi, calendarApi } from '@/lib/api';
import {
  BarChart2,
  Building2,
  Users,
  Download,
  Loader2,
  ChevronUp,
  ChevronDown,
  Activity,
  Trophy,
  AlertTriangle,
  AlertOctagon,
  Search,
  RefreshCw,
  FileText,
  X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type ReportType = 'schools' | 'employees' | 'summary';
type Timeframe = 'today' | '7d' | '30d' | 'term';
type SortOrder = 'best' | 'worst';

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
  };
  rank?: number;
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

// ── Constants ─────────────────────────────────────────────────────────────────
const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  today: 'Today',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  term: 'By Term',
};

const REPORT_TYPES: {
  type: ReportType;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}[] = [
  {
    type: 'schools',
    label: 'Schools Performance',
    desc: 'Attendance rates, employee counts and performance cohort for every institution.',
    icon: Building2,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.12)',
  },
  {
    type: 'employees',
    label: 'Employee Rankings',
    desc: 'Cross-tenant staff scores: presence, punctuality, hours and sign-out compliance.',
    icon: Users,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
  },
  {
    type: 'summary',
    label: 'Platform Summary',
    desc: 'Global KPIs, cohort distribution, top & bottom schools in a single-page executive report.',
    icon: BarChart2,
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.12)',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: number) => parseFloat((v || 0).toFixed(1));

function rateColorRgb(r: number): [number, number, number] {
  if (r >= 90) return [34, 197, 94];
  if (r >= 75) return [245, 158, 11];
  return [239, 68, 68];
}
function rateColorHex(r: number) {
  if (r >= 90) return '#22c55e';
  if (r >= 75) return '#f59e0b';
  return '#ef4444';
}
function rateBg(r: number) {
  if (r >= 90) return 'rgba(34,197,94,0.1)';
  if (r >= 75) return 'rgba(245,158,11,0.1)';
  return 'rgba(239,68,68,0.1)';
}
function rateLabel(r: number) {
  if (r >= 90) return 'Excellent';
  if (r >= 75) return 'Warning';
  return 'Critical';
}

// ── PDF helpers ───────────────────────────────────────────────────────────────
function pdfDrawHeader(doc: any, reportTitle: string, timestamp: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pw, 38, 'F');

  // Brand – left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('TK CLOCKING', 14, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Central Management Dashboard', 14, 25);

  // Report title – right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(reportTitle, pw - 14, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${timestamp}`, pw - 14, 25, { align: 'right' });

  // Pink accent line
  doc.setDrawColor(236, 72, 153);
  doc.setLineWidth(1.5);
  doc.line(0, 38, pw, 38);
}

function pdfDrawSummaryBar(doc: any, stats: { label: string; value: string }[], y: number) {
  const pw = doc.internal.pageSize.getWidth();
  const barH = 24;
  doc.setFillColor(30, 41, 59);
  doc.rect(0, y, pw, barH, 'F');

  const colW = (pw - 28) / stats.length;
  stats.forEach((stat, i) => {
    const x = 14 + colW * i + colW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(stat.label.toUpperCase(), x, y + 8, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(stat.value, x, y + 18, { align: 'center' });
  });
}

function pdfDrawFooter(
  doc: any,
  subtitle: string,
  pageNum: number,
  totalPages: number,
) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, ph - 15, pw - 14, ph - 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Confidential · TK Clocking Platform Report', 14, ph - 8);
  doc.text(subtitle, pw / 2, ph - 8, { align: 'center' });
  doc.text(`Page ${pageNum} of ${totalPages}`, pw - 14, ph - 8, { align: 'right' });
}

// ── Schools PDF ───────────────────────────────────────────────────────────────
async function generateSchoolsPdf(
  schools: SchoolMetric[],
  timeframe: Timeframe,
  timeframeLabel: string,
  sortOrder: SortOrder,
  timestamp: string,
) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'pt' });
  const reportTitle = 'Schools Performance Report';
  const subtitle = `${timeframeLabel} · ${sortOrder === 'best' ? 'Best → Worst' : 'Worst → Best'}`;

  const avgRate =
    schools.length > 0
      ? fmt(schools.reduce((s, x) => s + (x.metrics.presenceRate ?? 0), 0) / schools.length)
      : 0;

  const summaryStats = [
    { label: 'Total Schools', value: String(schools.length) },
    { label: 'Timeframe', value: timeframeLabel },
    { label: 'Sort Order', value: sortOrder === 'best' ? 'Best → Worst' : 'Worst → Best' },
    { label: 'Avg. Presence Rate', value: `${avgRate}%` },
  ];

  const tableBody = schools.map((school, i) => {
    const rate = school.metrics.presenceRate ?? 0;
    const sustained = school.metrics.sustained30DayRate ?? 0;
    const rateRgb = rateColorRgb(rate);
    const susRgb = rateColorRgb(sustained);
    return [
      {
        content: String(i + 1),
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: [71, 85, 105] as any },
      },
      { content: school.name, styles: { fontStyle: 'bold' as const } },
      { content: String(school.metrics.employees), styles: { halign: 'center' as const } },
      { content: String(school.metrics.branches), styles: { halign: 'center' as const } },
      {
        content: `${fmt(rate)}%`,
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: rateRgb as any },
      },
      {
        content: `${fmt(sustained)}%`,
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: susRgb as any },
      },
      {
        content: rateLabel(rate),
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: rateRgb as any },
      },
      {
        content: school.isActive !== false ? 'Active' : 'Suspended',
        styles: {
          halign: 'center' as const,
          fontStyle: 'bold' as const,
          textColor: school.isActive !== false ? ([34, 197, 94] as any) : ([239, 68, 68] as any),
        },
      },
    ];
  });

  // Table — margin.top reserves space for header on all pages
  autoTable(doc, {
    startY: 68,
    head: [['#', 'School Name', 'Employees', 'Branches', 'Presence Rate', '30D Sustained', 'Performance', 'Portal']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 5, right: 8, bottom: 5, left: 8 },
      overflow: 'linebreak',
      font: 'helvetica',
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [148, 163, 184],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      1: { cellWidth: 'auto' as any, minCellWidth: 110 },
      2: { cellWidth: 60, halign: 'center' },
      3: { cellWidth: 55, halign: 'center' },
      4: { cellWidth: 72, halign: 'center' },
      5: { cellWidth: 72, halign: 'center' },
      6: { cellWidth: 70, halign: 'center' },
      7: { cellWidth: 60, halign: 'center' },
    },
    margin: { top: 52, left: 14, right: 14, bottom: 30 },
  });

  // Post-process: draw header + footer on every page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    (doc as any).setPage(p);
    pdfDrawHeader(doc, reportTitle, timestamp);
    if (p === 1) pdfDrawSummaryBar(doc, summaryStats, 39);
    pdfDrawFooter(doc, subtitle, p, totalPages);
  }

  doc.save(`schools-performance-${timeframe}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Employee Rankings PDF ─────────────────────────────────────────────────────
async function generateEmployeesPdf(
  employees: EmployeeRanking[],
  timeframe: Timeframe,
  timeframeLabel: string,
  sortOrder: SortOrder,
  timestamp: string,
) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'pt' });
  const reportTitle = 'Employee Rankings Report';
  const subtitle = `${timeframeLabel} · ${sortOrder === 'best' ? 'Best Performers' : 'Needs Attention'}`;

  const avgScore =
    employees.length > 0
      ? fmt(employees.reduce((s, e) => s + (e.metrics.score ?? 0), 0) / employees.length)
      : 0;

  const summaryStats = [
    { label: 'Total Employees', value: String(employees.length) },
    { label: 'Timeframe', value: timeframeLabel },
    { label: 'Ranking', value: sortOrder === 'best' ? 'Best → Worst' : 'Worst → Best' },
    { label: 'Avg. Score', value: `${avgScore}%` },
  ];

  const tableBody = employees.map((emp, i) => {
    const score = emp.metrics.score ?? 0;
    const presence = emp.metrics.presenceRate ?? 0;
    const punct = emp.metrics.punctualityRate ?? 0;
    const hours = emp.metrics.hoursCompletionRate ?? 0;
    return [
      {
        content: String(emp.rank ?? i + 1),
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: [71, 85, 105] as any },
      },
      { content: emp.name, styles: { fontStyle: 'bold' as const } },
      { content: emp.employeeCode || '—', styles: { halign: 'center' as const, textColor: [71, 85, 105] as any } },
      { content: emp.position || '—', styles: { textColor: [71, 85, 105] as any } },
      emp.school.name,
      {
        content: `${fmt(presence)}%`,
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: rateColorRgb(presence) as any },
      },
      {
        content: `${fmt(punct)}%`,
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: rateColorRgb(punct) as any },
      },
      {
        content: `${fmt(hours)}%`,
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: rateColorRgb(hours) as any },
      },
      {
        content: `${fmt(score)}%`,
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: rateColorRgb(score) as any },
      },
    ];
  });

  autoTable(doc, {
    startY: 68,
    head: [['#', 'Employee Name', 'Code', 'Position', 'School', 'Presence', 'Punctuality', 'Hours', 'Score']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      overflow: 'linebreak',
      font: 'helvetica',
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [148, 163, 184],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 'auto' as any, minCellWidth: 80 },
      2: { cellWidth: 42, halign: 'center' },
      3: { cellWidth: 58 },
      4: { cellWidth: 88 },
      5: { cellWidth: 52, halign: 'center' },
      6: { cellWidth: 56, halign: 'center' },
      7: { cellWidth: 44, halign: 'center' },
      8: { cellWidth: 44, halign: 'center' },
    },
    margin: { top: 52, left: 14, right: 14, bottom: 30 },
  });

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    (doc as any).setPage(p);
    pdfDrawHeader(doc, reportTitle, timestamp);
    if (p === 1) pdfDrawSummaryBar(doc, summaryStats, 39);
    pdfDrawFooter(doc, subtitle, p, totalPages);
  }

  doc.save(`employee-rankings-${timeframe}-${sortOrder}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Platform Summary PDF ──────────────────────────────────────────────────────
async function generateSummaryPdf(
  stats: PlatformStats,
  timeframe: Timeframe,
  timeframeLabel: string,
  timestamp: string,
) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4', unit: 'pt' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const reportTitle = 'Platform Summary Report';
  const subtitle = timeframeLabel;

  const summaryStats = [
    { label: 'Total Schools', value: String(stats.overview.totalSchools) },
    { label: 'Active', value: String(stats.overview.activeSchools) },
    { label: 'Employees', value: stats.overview.trackedEmployees.toLocaleString() },
    { label: 'Global Rate', value: `${fmt(stats.overview.presenceRate)}%` },
  ];

  // ── Key metrics table ──
  const metricsBody: any[][] = [
    ['Total Schools', { content: String(stats.overview.totalSchools), styles: { fontStyle: 'bold', textColor: [139, 92, 246] } }],
    ['Active Schools', { content: String(stats.overview.activeSchools), styles: { fontStyle: 'bold', textColor: [34, 197, 94] } }],
    ['Suspended Schools', { content: String(stats.overview.suspendedSchools), styles: { fontStyle: 'bold', textColor: stats.overview.suspendedSchools > 0 ? [239, 68, 68] : [71, 85, 105] } }],
    ['Total Tracked Employees', { content: stats.overview.trackedEmployees.toLocaleString(), styles: { fontStyle: 'bold', textColor: [59, 130, 246] } }],
    ['Present in Timeframe', { content: stats.overview.presentInTimeframe.toLocaleString(), styles: { fontStyle: 'bold', textColor: [34, 197, 94] } }],
    ['Global Attendance Rate', {
      content: `${fmt(stats.overview.presenceRate)}%`,
      styles: { fontStyle: 'bold', textColor: rateColorRgb(stats.overview.presenceRate) },
    }],
    ['Month-over-Month Growth', {
      content: `${stats.overview.momGrowth >= 0 ? '+' : ''}${fmt(stats.overview.momGrowth)}%`,
      styles: { fontStyle: 'bold', textColor: stats.overview.momGrowth >= 0 ? [34, 197, 94] : [239, 68, 68] },
    }],
    ['Excellent Schools (≥ 90%)', { content: String(stats.overview.cohorts.excellent), styles: { fontStyle: 'bold', textColor: [34, 197, 94] } }],
    ['Warning Schools (75 – 89%)', { content: String(stats.overview.cohorts.warning), styles: { fontStyle: 'bold', textColor: [245, 158, 11] } }],
    ['Critical Schools (< 75%)', { content: String(stats.overview.cohorts.critical), styles: { fontStyle: 'bold', textColor: [239, 68, 68] } }],
    ['API Status', { content: stats.health?.apiStatus || 'N/A', styles: { fontStyle: 'bold', textColor: [34, 197, 94] } }],
    ['Database Uptime', { content: stats.health?.databaseUptime || 'N/A', styles: { fontStyle: 'bold', textColor: [34, 197, 94] } }],
    ['API Latency', { content: stats.health?.latencyMs != null ? `${stats.health.latencyMs} ms` : 'N/A', styles: { fontStyle: 'bold' } }],
  ];

  autoTable(doc, {
    startY: 68,
    head: [['Metric', 'Value']],
    body: metricsBody,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: { top: 6, right: 12, bottom: 6, left: 12 },
      font: 'helvetica',
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [148, 163, 184],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [51, 65, 85], cellWidth: 200 },
      1: { cellWidth: 'auto' as any },
    },
    margin: { top: 52, left: 14, right: 14, bottom: 30 },
  });

  let nextY = (doc as any).lastAutoTable.finalY + 18;

  // ── Top 5 Schools table ──
  if (stats.topFive && stats.topFive.length > 0) {
    // Section label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('TOP 5 PERFORMING SCHOOLS', 14, nextY);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, nextY + 4, pw - 14, nextY + 4);
    nextY += 12;

    autoTable(doc, {
      startY: nextY,
      head: [['Rank', 'School Name', 'Employees', 'Presence Rate', 'Performance']],
      body: stats.topFive.map((s, i) => {
        const rate = s.metrics.presenceRate ?? 0;
        return [
          { content: `#${i + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: s.name, styles: { fontStyle: 'bold' as const } },
          { content: String(s.metrics.employees), styles: { halign: 'center' as const } },
          { content: `${fmt(rate)}%`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: rateColorRgb(rate) as any } },
          { content: rateLabel(rate), styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: rateColorRgb(rate) as any } },
        ];
      }),
      theme: 'grid',
      styles: { fontSize: 8.5, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.4, cellPadding: 5 },
      headStyles: { fillColor: [30, 41, 59], textColor: [148, 163, 184], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 38, halign: 'center' },
        1: { cellWidth: 'auto' as any },
        2: { cellWidth: 65, halign: 'center' },
        3: { cellWidth: 75, halign: 'center' },
        4: { cellWidth: 75, halign: 'center' },
      },
      margin: { left: 14, right: 14, bottom: 30 },
    });

    nextY = (doc as any).lastAutoTable.finalY + 16;
  }

  // ── Bottom 5 Schools table ──
  if (stats.bottomFive && stats.bottomFive.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('LOWEST 5 PERFORMING SCHOOLS', 14, nextY);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, nextY + 4, pw - 14, nextY + 4);
    nextY += 12;

    autoTable(doc, {
      startY: nextY,
      head: [['Rank', 'School Name', 'Employees', 'Presence Rate', 'Performance']],
      body: stats.bottomFive.map((s, i) => {
        const rate = s.metrics.presenceRate ?? 0;
        return [
          { content: `#${i + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: s.name, styles: { fontStyle: 'bold' as const } },
          { content: String(s.metrics.employees), styles: { halign: 'center' as const } },
          { content: `${fmt(rate)}%`, styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: rateColorRgb(rate) as any } },
          { content: rateLabel(rate), styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: rateColorRgb(rate) as any } },
        ];
      }),
      theme: 'grid',
      styles: { fontSize: 8.5, font: 'helvetica', lineColor: [226, 232, 240], lineWidth: 0.4, cellPadding: 5 },
      headStyles: {
        fillColor: [80, 20, 20],
        textColor: [252, 165, 165],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 38, halign: 'center' },
        1: { cellWidth: 'auto' as any },
        2: { cellWidth: 65, halign: 'center' },
        3: { cellWidth: 75, halign: 'center' },
        4: { cellWidth: 75, halign: 'center' },
      },
      margin: { left: 14, right: 14, bottom: 30 },
    });
  }

  // Post-process all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    (doc as any).setPage(p);
    pdfDrawHeader(doc, reportTitle, timestamp);
    if (p === 1) pdfDrawSummaryBar(doc, summaryStats, 39);
    pdfDrawFooter(doc, subtitle, p, totalPages);
  }

  doc.save(`platform-summary-${timeframe}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Preview table components ───────────────────────────────────────────────────
function SchoolsPreview({ schools }: { schools: SchoolMetric[] }) {
  if (schools.length === 0)
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
        No schools data available for this timeframe.
      </div>
    );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['#', 'School Name', 'Employees', 'Branches', 'Presence Rate', '30D Sustained', 'Performance', 'Portal'].map((h) => (
              <th
                key={h}
                style={{
                  padding: '10px 14px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  textAlign: ['Employees', 'Branches', 'Presence Rate', '30D Sustained', 'Performance', 'Portal', '#'].includes(h) ? 'center' : 'left',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schools.map((school, i) => {
            const rate = school.metrics.presenceRate ?? 0;
            const sustained = school.metrics.sustained30DayRate ?? 0;
            return (
              <tr
                key={school.id}
                style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '12px' }}>{i + 1}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{school.name}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>{school.metrics.employees}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>{school.metrics.branches}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: rateColorHex(rate) }}>{fmt(rate)}%</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: rateColorHex(sustained) }}>{fmt(sustained)}%</td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: rateBg(rate), color: rateColorHex(rate) }}>
                    {rateLabel(rate)}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: school.isActive !== false ? '#22c55e' : '#ef4444' }}>
                    {school.isActive !== false ? 'Active' : 'Suspended'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmployeesPreview({ employees }: { employees: EmployeeRanking[] }) {
  if (employees.length === 0)
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
        No employee data available for this timeframe.
      </div>
    );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['#', 'Employee', 'Code', 'Position', 'School', 'Presence', 'Punctuality', 'Hours', 'Score'].map((h) => (
              <th
                key={h}
                style={{
                  padding: '10px 14px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  textAlign: ['#', 'Code', 'Presence', 'Punctuality', 'Hours', 'Score'].includes(h) ? 'center' : 'left',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => {
            const score = emp.metrics.score ?? 0;
            const presence = emp.metrics.presenceRate ?? 0;
            const punct = emp.metrics.punctualityRate ?? 0;
            const hours = emp.metrics.hoursCompletionRate ?? 0;
            // generate initials
            const initials = emp.name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
            return (
              <tr
                key={emp.id}
                style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '12px' }}>{emp.rank ?? i + 1}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: emp.school.primaryColor + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: emp.school.primaryColor, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{emp.name}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>{emp.employeeCode || '—'}</td>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>{emp.position || '—'}</td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: emp.school.primaryColor }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{emp.school.name}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: rateColorHex(presence) }}>{fmt(presence)}%</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: rateColorHex(punct) }}>{fmt(punct)}%</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: rateColorHex(hours) }}>{fmt(hours)}%</td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: rateBg(score), color: rateColorHex(score) }}>
                    {fmt(score)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SummaryPreview({ stats, timeframe }: { stats: PlatformStats | null; timeframe: Timeframe }) {
  if (!stats) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>No data available.</div>;
  const { overview } = stats;
  const cohorts = overview.cohorts ?? { excellent: 0, warning: 0, critical: 0 };
  const totalCohort = (cohorts.excellent + cohorts.warning + cohorts.critical) || 1;

  const metricCards = [
    { label: 'Total Schools', value: String(overview.totalSchools), color: '#8b5cf6' },
    { label: 'Active Schools', value: String(overview.activeSchools), color: '#22c55e' },
    { label: 'Suspended', value: String(overview.suspendedSchools), color: '#ef4444' },
    { label: 'Tracked Employees', value: overview.trackedEmployees.toLocaleString(), color: '#3b82f6' },
    { label: 'Present in Period', value: String(overview.presentInTimeframe), color: '#22c55e' },
    { label: 'Global Attendance', value: `${fmt(overview.presenceRate)}%`, color: rateColorHex(overview.presenceRate) },
    { label: 'MoM Growth', value: `${overview.momGrowth >= 0 ? '+' : ''}${fmt(overview.momGrowth)}%`, color: overview.momGrowth >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'Excellent Schools', value: String(cohorts.excellent), color: '#22c55e' },
    { label: 'Warning Schools', value: String(cohorts.warning), color: '#f59e0b' },
    { label: 'Critical Schools', value: String(cohorts.critical), color: '#ef4444' },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {metricCards.map((m) => (
          <div
            key={m.label}
            style={{ padding: '16px', borderRadius: '10px', background: 'var(--bg-card-hover)', border: `1px solid ${m.color}22`, position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: m.color, borderRadius: '10px 0 0 10px' }} />
            <div style={{ paddingLeft: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Cohort bars */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Cohort Distribution</div>
        {[
          { label: 'Excellent (≥ 90%)', val: cohorts.excellent, color: '#22c55e' },
          { label: 'Warning (75–89%)', val: cohorts.warning, color: '#f59e0b' },
          { label: 'Critical (< 75%)', val: cohorts.critical, color: '#ef4444' },
        ].map((c) => (
          <div key={c.label} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: c.color }}>{c.label}</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: c.color }}>{c.val} schools ({Math.round((c.val / totalCohort) * 100)}%)</span>
            </div>
            <div style={{ height: '7px', borderRadius: '4px', background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '4px', width: `${(c.val / totalCohort) * 100}%`, background: c.color, transition: 'width 0.8s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Top & Bottom 5 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {[
          { label: 'Top 5 Schools', schools: stats.topFive ?? [], accent: '#22c55e' },
          { label: 'Lowest 5 Schools', schools: stats.bottomFive ?? [], accent: '#ef4444' },
        ].map(({ label, schools, accent }) => (
          <div key={label}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{label}</div>
            {schools.slice(0, 5).map((s, i) => {
              const rate = s.metrics.presenceRate ?? 0;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'center', flexShrink: 0 }}>#{i + 1}</div>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.primaryColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: rateColorHex(rate), flexShrink: 0 }}>{fmt(rate)}%</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('schools');
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [sortOrder, setSortOrder] = useState<SortOrder>('best');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [schools, setSchools] = useState<SchoolMetric[]>([]);
  const [employees, setEmployees] = useState<EmployeeRanking[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  // Academic Calendar Filter State
  const [academicYear, setAcademicYear] = useState<string>('');
  const [termName, setTermName] = useState<string>('all');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableTerms, setAvailableTerms] = useState<string[]>([]);
  const [allTermsData, setAllTermsData] = useState<any[]>([]);

  // Fetch available academic years and terms globally on mount
  useEffect(() => {
    async function loadTerms() {
      try {
        const res = await calendarApi.listTerms();
        const terms = Array.isArray(res.data) ? res.data : [];
        setAllTermsData(terms);
        
        const years = Array.from(new Set(terms.map((t: any) => t.academicYear).filter(Boolean))) as string[];
        years.sort((a, b) => b.localeCompare(a));
        setAvailableYears(years);
      } catch (e) {
        console.error('Failed to load terms for filter:', e);
      }
    }
    loadTerms();
  }, []);

  // Update available terms when the selected academic year changes
  useEffect(() => {
    if (academicYear) {
      const termsForYear = allTermsData.filter(t => t.academicYear === academicYear);
      const termNames = Array.from(new Set(termsForYear.map(t => t.name))) as string[];
      setAvailableTerms(termNames);
      if (!termNames.includes(termName) && termName !== 'all') {
        setTermName('all');
      }
    } else {
      setAvailableTerms([]);
      setTermName('all');
    }
  }, [academicYear, allTermsData, termName]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSearch('');
    
    // Only pass academicYear/termName to the backend if the timeframe is 'term'
    const aYear = timeframe === 'term' && academicYear ? academicYear : undefined;
    const tName = timeframe === 'term' && termName && termName !== 'all' ? termName : undefined;

    try {
      if (reportType === 'schools') {
        const res = await saasAdminApi.listTenants(timeframe, aYear, tName, {
          limit: 10000,
          sort: sortOrder === 'best' ? 'presenceRate:DESC' : 'presenceRate:ASC',
        });
        const list: SchoolMetric[] = Array.isArray(res.data)
          ? res.data
          : (res.data as any)?.results || [];
        setSchools(list);
      } else if (reportType === 'employees') {
        const res = await saasAdminApi.getEmployeeRankings({ 
          timeframe, 
          sort: sortOrder, 
          limit: 1000, 
          page: 1,
          academicYear: aYear,
          termName: tName
        });
        const pageData = res.data as any;
        const list: EmployeeRanking[] = Array.isArray(pageData?.data)
          ? pageData.data
          : Array.isArray(res.data)
          ? (res.data as any)
          : [];
        setEmployees(list);
      } else {
        const res = await saasAdminApi.getStats(timeframe, aYear, tName);
        setStats(res.data);
      }
    } catch (err) {
      console.error('Reports fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [reportType, timeframe, sortOrder, academicYear, termName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered for preview
  const filteredSchools = search.trim()
    ? schools.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : schools;
  const filteredEmployees = search.trim()
    ? employees.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.school.name.toLowerCase().includes(search.toLowerCase()),
      )
    : employees;

  const previewCount =
    reportType === 'schools'
      ? filteredSchools.length
      : reportType === 'employees'
      ? filteredEmployees.length
      : stats
      ? 10
      : 0;

  const handleGeneratePdf = async () => {
    setGenerating(true);
    try {
      const now = new Date();
      const timestamp = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) +
        ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const timeLabel = timeframe === 'term' && academicYear ? `${academicYear} (${termName === 'all' ? 'Entire Year' : termName})` : TIMEFRAME_LABELS[timeframe];

      if (reportType === 'schools') {
        await generateSchoolsPdf(filteredSchools, timeframe, timeLabel, sortOrder, timestamp);
      } else if (reportType === 'employees') {
        await generateEmployeesPdf(filteredEmployees, timeframe, timeLabel, sortOrder, timestamp);
      } else if (stats) {
        await generateSummaryPdf(stats, timeframe, timeLabel, timestamp);
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = !loading && !generating && previewCount > 0;

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out', paddingBottom: '48px' }}>
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: 0 }}>
              Reports &amp; Export
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '14px', margin: '6px 0 0' }}>
              Generate pixel-perfect PDF reports across all supervised institutions
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            title="Refresh data"
            style={{ width: '38px', height: '38px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s', flexShrink: 0 }}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* ── Report Type Cards ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {REPORT_TYPES.map((rt) => {
          const Icon = rt.icon;
          const isActive = reportType === rt.type;
          return (
            <div
              key={rt.type}
              onClick={() => setReportType(rt.type)}
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: `1px solid ${isActive ? rt.color : 'var(--border)'}`,
                background: isActive ? rt.bg : 'var(--bg-card)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = rt.color + '66';
                  e.currentTarget.style.background = rt.bg;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--bg-card)';
                }
              }}
            >
              {isActive && (
                <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '100%', background: rt.color, borderRadius: '0 12px 12px 0' }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: isActive ? rt.color + '22' : 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={isActive ? rt.color : 'var(--text-secondary)'} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: isActive ? rt.color : 'var(--text-primary)' }}>{rt.label}</div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rt.desc}</div>
            </div>
          );
        })}
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div
        className="card"
        style={{ padding: '14px 18px', marginBottom: '18px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}
      >
        {/* Timeframe tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: '9px', padding: '3px', gap: '2px' }}>
          {(Object.keys(TIMEFRAME_LABELS) as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: '5px 13px',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: timeframe === tf ? 'var(--primary)' : 'transparent',
                color: timeframe === tf ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {TIMEFRAME_LABELS[tf]}
            </button>
          ))}
        </div>

        {/* Academic Year / Term Selectors */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            aria-label="Select Academic Year"
            value={academicYear}
            onChange={(e) => {
              setAcademicYear(e.target.value);
              setTimeframe('term');
            }}
            style={{
              padding: '5px 12px',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: 600,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>Current Year (Auto)</option>
            {availableYears.map((y) => (
              <option key={y} value={y} style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>{y}</option>
            ))}
          </select>

          {academicYear && availableTerms.length > 0 && (
            <select
              aria-label="Select Term"
              value={termName}
              onChange={(e) => {
                setTermName(e.target.value);
                setTimeframe('term');
              }}
              style={{
                padding: '5px 12px',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>Entire Academic Year</option>
              {availableTerms.map((t) => (
                <option key={t} value={t} style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>{t}</option>
              ))}
            </select>
          )}
        </div>

        {/* Sort toggle (schools + employees only) */}
        {reportType !== 'summary' && (
          <div style={{ display: 'flex', background: 'var(--bg-card-hover)', border: '1px solid var(--border)', borderRadius: '9px', padding: '3px', gap: '2px' }}>
            <button
              onClick={() => setSortOrder('best')}
              style={{ padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px', background: sortOrder === 'best' ? '#22c55e' : 'transparent', color: sortOrder === 'best' ? '#fff' : 'var(--text-secondary)' }}
            >
              <ChevronUp size={12} /> Best
            </button>
            <button
              onClick={() => setSortOrder('worst')}
              style={{ padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px', background: sortOrder === 'worst' ? '#ef4444' : 'transparent', color: sortOrder === 'worst' ? '#fff' : 'var(--text-secondary)' }}
            >
              <ChevronDown size={12} /> Worst
            </button>
          </div>
        )}

        {/* Search (schools + employees only) */}
        {reportType !== 'summary' && (
          <div style={{ position: 'relative', flex: 1, maxWidth: '300px', minWidth: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={reportType === 'schools' ? 'Filter schools…' : 'Filter employees or school…'}
              style={{ width: '100%', paddingLeft: '34px', paddingRight: search ? '32px' : '12px', paddingTop: '7px', paddingBottom: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                title="Clear search"
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '2px' }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Row count badge */}
        {!loading && previewCount > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {previewCount} row{previewCount !== 1 ? 's' : ''} in report
          </span>
        )}

        {/* Generate PDF button */}
        <button
          onClick={handleGeneratePdf}
          disabled={!canGenerate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 20px',
            borderRadius: '9px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            cursor: canGenerate ? 'pointer' : 'not-allowed',
            background: canGenerate ? 'var(--primary)' : 'var(--border)',
            color: canGenerate ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            flexShrink: 0,
            opacity: canGenerate ? 1 : 0.6,
          }}
          onMouseEnter={(e) => { if (canGenerate) e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={(e) => { if (canGenerate) e.currentTarget.style.opacity = '1'; }}
        >
          {generating ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={15} />}
          {generating ? 'Generating PDF…' : 'Export PDF'}
        </button>
      </div>

      {/* ── Preview Card ──────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Preview header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <FileText size={15} color="var(--text-secondary)" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Live Preview
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>—</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {REPORT_TYPES.find((r) => r.type === reportType)?.label} · {timeframe === 'term' && academicYear ? `${academicYear} (${termName === 'all' ? 'Entire Year' : termName})` : TIMEFRAME_LABELS[timeframe]}
          </span>
          {loading && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              Loading data…
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div className="spinner" />
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '16px' }}>Fetching report data…</p>
          </div>
        ) : reportType === 'schools' ? (
          <SchoolsPreview schools={filteredSchools} />
        ) : reportType === 'employees' ? (
          <EmployeesPreview employees={filteredEmployees} />
        ) : (
          <SummaryPreview stats={stats} timeframe={timeframe} />
        )}
      </div>

      {/* ── Export info callout ────────────────────────────────────────────── */}
      {!loading && previewCount > 0 && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px 18px',
            borderRadius: '10px',
            background: 'rgba(236,72,153,0.06)',
            border: '1px solid rgba(236,72,153,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}
        >
          <Download size={14} color="#ec4899" style={{ flexShrink: 0 }} />
          <span>
            The exported PDF will contain <strong style={{ color: 'var(--text-primary)' }}>{previewCount} rows</strong> with your
            school&apos;s branding, page numbers, and a generated timestamp on every page.
            {reportType !== 'summary' && (
              <> Use the filter above to narrow down the data before exporting.</>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
