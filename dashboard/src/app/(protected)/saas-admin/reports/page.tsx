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
type Timeframe = 'term';
type SortOrder = 'best' | 'worst';

interface AcademicTerm {
  id: string;
  name: string;
  academicYear: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

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
    expectedEmployeeDays: number;
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
    label: 'Schools Performance Ranking',
    desc: 'Attendance rates, employee counts and performance cohort for every institution.',
    icon: Building2,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.12)',
  },
  {
    type: 'employees',
    label: 'Employee Rankings',
    desc: 'Cross-school staff scores: presence, punctuality, hours and sign-out compliance.',
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

function hasMetricData(expectedCount?: number) {
  return Number(expectedCount ?? 0) > 0;
}

function formatRateValue(rate: number, expectedCount?: number) {
  return hasMetricData(expectedCount) ? `${fmt(rate)}%` : '—';
}

function getPeriodLabel(academicYear: string, termName: string) {
  if (!academicYear) return 'Select an academic year to view the report';
  if (termName === 'all') return `${academicYear} · Entire Academic Year`;
  return `${academicYear} · ${termName}`;
}

function rateColorRgb(r: number, hasData: boolean = true): [number, number, number] {
  if (!hasData) return [100, 116, 139];
  if (r >= 90) return [34, 197, 94];
  if (r >= 75) return [245, 158, 11];
  return [239, 68, 68];
}
function rateColorHex(r: number, hasData: boolean = true) {
  if (!hasData) return '#64748b';
  if (r >= 90) return '#22c55e';
  if (r >= 75) return '#f59e0b';
  return '#ef4444';
}
function rateBg(r: number, hasData: boolean = true) {
  if (!hasData) return 'rgba(100,116,139,0.12)';
  if (r >= 90) return 'rgba(34,197,94,0.1)';
  if (r >= 75) return 'rgba(245,158,11,0.1)';
  return 'rgba(239,68,68,0.1)';
}
function rateLabel(r: number, hasData: boolean = true) {
  if (!hasData) return '—';
  if (r >= 90) return 'Excellent';
  if (r >= 75) return 'Warning';
  return 'Critical';
}

// ── PDF helpers ───────────────────────────────────────────────────────────────
const PDF_MARGIN = 36; // 0.5in
const PDF_HEADER_TITLE_Y = 30;
const PDF_HEADER_META_Y = 43;
const PDF_HEADER_DIVIDER_Y = 66;
const PDF_SUMMARY_BAR_Y = 80;
const PDF_SUMMARY_CARD_H = 52;
const PDF_SUMMARY_CARD_GAP = 10;
const PDF_TABLE_MARGIN_TOP = 80;
const PDF_TABLE_MARGIN_BOTTOM = 58;
const PDF_FOOTER_LINE_Y_OFFSET = 42;
const PDF_FOOTER_TEXT_Y_OFFSET = 28;

type PdfStatCard = {
  label: string;
  value: string;
  accent: [number, number, number];
  icon: 'users' | 'calendar' | 'ranking' | 'score' | 'schools' | 'employees' | 'rate';
};

function getPdfSummaryLayout(doc: any, count: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardsPerRow = pageWidth >= 780 ? 4 : 2;
  const usableWidth = pageWidth - PDF_MARGIN * 2;
  const cardWidth =
    (usableWidth - PDF_SUMMARY_CARD_GAP * (cardsPerRow - 1)) / cardsPerRow;
  const rows = Math.max(1, Math.ceil(count / cardsPerRow));
  const height =
    rows * PDF_SUMMARY_CARD_H + (rows - 1) * PDF_SUMMARY_CARD_GAP;

  return { cardsPerRow, cardWidth, height };
}

function getPdfFirstPageTableY(doc: any, count: number) {
  return PDF_SUMMARY_BAR_Y + getPdfSummaryLayout(doc, count).height + 18;
}

function pdfFitCardText(
  doc: any,
  text: string,
  maxWidth: number,
  preferredSize: number,
  minSize: number,
  maxLines: number,
) {
  let fontSize = preferredSize;
  let lines = [text];

  while (fontSize >= minSize) {
    doc.setFontSize(fontSize);
    lines = doc.splitTextToSize(text, maxWidth);
    if (lines.length <= maxLines) break;
    fontSize -= 0.5;
  }

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const last = lines[maxLines - 1] ?? '';
    let trimmed = last;
    while (trimmed.length > 1 && doc.getTextWidth(`${trimmed}...`) > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    lines[maxLines - 1] = `${trimmed}...`;
  }

  return { fontSize, lines };
}

function pdfDrawCardIcon(
  doc: any,
  x: number,
  y: number,
  icon: PdfStatCard['icon'],
) {
  doc.setDrawColor(255, 255, 255);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(1.2);

  switch (icon) {
    case 'users':
    case 'employees':
      doc.circle(x + 10, y + 8, 2, 'S');
      doc.circle(x + 6, y + 10, 1.5, 'S');
      doc.circle(x + 14, y + 10, 1.5, 'S');
      doc.line(x + 7, y + 14, x + 13, y + 14);
      doc.line(x + 4.5, y + 15.5, x + 7.5, y + 15.5);
      doc.line(x + 12.5, y + 15.5, x + 15.5, y + 15.5);
      break;
    case 'calendar':
      doc.roundedRect(x + 3, y + 4, 14, 13, 1.5, 1.5, 'S');
      doc.line(x + 6, y + 2.5, x + 6, y + 6);
      doc.line(x + 14, y + 2.5, x + 14, y + 6);
      doc.line(x + 3, y + 7, x + 17, y + 7);
      doc.line(x + 6, y + 10, x + 8, y + 10);
      doc.line(x + 10, y + 10, x + 12, y + 10);
      doc.line(x + 14, y + 10, x + 14.5, y + 10);
      break;
    case 'ranking':
      doc.line(x + 4, y + 16, x + 16, y + 16);
      doc.line(x + 6, y + 16, x + 6, y + 11);
      doc.line(x + 10, y + 16, x + 10, y + 8);
      doc.line(x + 14, y + 16, x + 14, y + 5);
      doc.line(x + 6, y + 11, x + 10, y + 8);
      doc.line(x + 10, y + 8, x + 14, y + 5);
      doc.line(x + 12.5, y + 5.5, x + 14, y + 5);
      doc.line(x + 14, y + 5, x + 13.5, y + 6.5);
      break;
    case 'schools':
      doc.line(x + 3, y + 8, x + 10, y + 4);
      doc.line(x + 10, y + 4, x + 17, y + 8);
      doc.rect(x + 5, y + 8, 10, 8, 'S');
      doc.rect(x + 9, y + 11, 2, 5, 'S');
      break;
    case 'rate':
    case 'score':
      doc.line(x + 4, y + 16, x + 16, y + 16);
      doc.line(x + 6, y + 16, x + 6, y + 11);
      doc.line(x + 10, y + 16, x + 10, y + 8);
      doc.line(x + 14, y + 16, x + 14, y + 5);
      break;
  }
}

function pdfDrawHeader(doc: any, reportTitle: string, timestamp: string) {
  const pw = doc.internal.pageSize.getWidth();

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(PDF_MARGIN, 18, pw - PDF_MARGIN * 2, 42, 10, 10, 'F');

  // Brand - left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(51, 65, 85);
  doc.text('TK CLOCKING', PDF_MARGIN + 12, PDF_HEADER_TITLE_Y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Executive Attendance Reporting Suite',
    PDF_MARGIN + 12,
    PDF_HEADER_META_Y,
  );

  // Report title - right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle, pw - PDF_MARGIN - 12, PDF_HEADER_TITLE_Y, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${timestamp}`, pw - PDF_MARGIN - 12, PDF_HEADER_META_Y, {
    align: 'right',
  });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(PDF_MARGIN, PDF_HEADER_DIVIDER_Y, pw - PDF_MARGIN, PDF_HEADER_DIVIDER_Y);
}

function pdfDrawSummaryBar(doc: any, stats: PdfStatCard[], y: number) {
  const { cardsPerRow, cardWidth } = getPdfSummaryLayout(doc, stats.length);

  stats.forEach((stat, i) => {
    const row = Math.floor(i / cardsPerRow);
    const col = i % cardsPerRow;
    const x = PDF_MARGIN + col * (cardWidth + PDF_SUMMARY_CARD_GAP);
    const cardY = y + row * (PDF_SUMMARY_CARD_H + PDF_SUMMARY_CARD_GAP);

    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(214, 220, 229);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, cardY, cardWidth, PDF_SUMMARY_CARD_H, 6, 6, 'FD');

    doc.setFillColor(...stat.accent);
    doc.roundedRect(x + 10, cardY + 12, 20, 20, 4, 4, 'F');
    pdfDrawCardIcon(doc, x + 10, cardY + 12, stat.icon);

    const textX = x + 38;
    const textMaxWidth = cardWidth - 48;
    const labelFit = pdfFitCardText(doc, stat.label.toUpperCase(), textMaxWidth, 7, 6.5, 1);
    const valueFit = pdfFitCardText(doc, stat.value, textMaxWidth, 12, 8, 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(labelFit.fontSize);
    doc.setTextColor(100, 116, 139);
    doc.text(labelFit.lines[0] ?? '', textX, cardY + 17);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(valueFit.fontSize);
    doc.setTextColor(15, 23, 42);
    const valueStartY = cardY + (valueFit.lines.length > 1 ? 28 : 33);
    valueFit.lines.forEach((line: string, lineIndex: number) => {
      doc.text(line, textX, valueStartY + lineIndex * (valueFit.fontSize + 1));
    });
  });
}

function pdfDrawSectionTitle(doc: any, label: string, y: number) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(label, PDF_MARGIN, y);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(PDF_MARGIN, y + 4, pw - PDF_MARGIN, y + 4);
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
  doc.line(
    PDF_MARGIN,
    ph - PDF_FOOTER_LINE_Y_OFFSET,
    pw - PDF_MARGIN,
    ph - PDF_FOOTER_LINE_Y_OFFSET,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Confidential Internal Report', PDF_MARGIN, ph - PDF_FOOTER_TEXT_Y_OFFSET);
  doc.text(subtitle, pw / 2, ph - PDF_FOOTER_TEXT_Y_OFFSET, { align: 'center' });
  doc.text(
    `Page ${pageNum} of ${totalPages}`,
    pw - PDF_MARGIN,
    ph - PDF_FOOTER_TEXT_Y_OFFSET,
    { align: 'right' },
  );
}

// ── Schools PDF ───────────────────────────────────────────────────────────────
async function generateSchoolsPdf(
  schools: SchoolMetric[],
  periodLabel: string,
  sortOrder: SortOrder,
  timestamp: string,
) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'pt' });
  const reportTitle = 'Schools Performance Report';
  const subtitle = `${periodLabel} · ${sortOrder === 'best' ? 'Best → Worst' : 'Worst → Best'}`;
  const schoolsWithAttendance = schools.filter((school) =>
    hasMetricData(school.metrics.expectedEmployeeDays),
  );

  const avgRate =
    schoolsWithAttendance.length > 0
      ? fmt(
          schoolsWithAttendance.reduce(
            (sum, school) => sum + (school.metrics.presenceRate ?? 0),
            0,
          ) / schoolsWithAttendance.length,
        )
      : 0;

  const summaryStats: PdfStatCard[] = [
    { label: 'Total Schools', value: String(schools.length), accent: [51, 65, 85], icon: 'schools' },
    { label: 'Period', value: periodLabel, accent: [71, 85, 105], icon: 'calendar' },
    {
      label: 'Sort Order',
      value: sortOrder === 'best' ? 'Best to Worst' : 'Worst to Best',
      accent: sortOrder === 'best' ? [34, 197, 94] : [239, 68, 68],
      icon: 'ranking',
    },
    {
      label: 'Avg. Attendance Rate',
      value: schoolsWithAttendance.length > 0 ? `${avgRate}%` : '—',
      accent: rateColorRgb(avgRate, schoolsWithAttendance.length > 0),
      icon: 'rate',
    },
  ];
  const firstPageTableY = getPdfFirstPageTableY(doc, summaryStats.length);

  const tableBody = schools.map((school, i) => {
    const rate = school.metrics.presenceRate ?? 0;
    const hasRateData = hasMetricData(school.metrics.expectedEmployeeDays);
    const rateRgb = rateColorRgb(rate, hasRateData);
    return [
      {
        content: String(i + 1),
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: [71, 85, 105] as any },
      },
      { content: school.name, styles: { fontStyle: 'bold' as const } },
      { content: String(school.metrics.employees), styles: { halign: 'center' as const } },
      {
        content: formatRateValue(rate, school.metrics.expectedEmployeeDays),
        styles: {
          halign: 'center' as const,
          fontStyle: 'bold' as const,
          textColor: rateRgb as any,
        },
      },
      {
        content: rateLabel(rate, hasRateData),
        styles: {
          halign: 'center' as const,
          fontStyle: 'bold' as const,
          textColor: rateRgb as any,
        },
      },
      {
        content: school.isActive !== false ? 'Active' : 'Suspended',
        styles: {
          halign: 'center' as const,
          fontStyle: 'bold' as const,
          textColor:
            school.isActive !== false
              ? ([22, 163, 74] as any)
              : ([185, 28, 28] as any),
        },
      },
    ];
  });

  // Table — margin.top reserves space for header on all pages
  autoTable(doc, {
    startY: firstPageTableY,
    head: [['#', 'School Name', 'Employees', 'Attendance Rate', 'Performance', 'Portal']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: { top: 7, right: 8, bottom: 7, left: 8 },
      overflow: 'linebreak',
      font: 'helvetica',
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      1: { cellWidth: 'auto' as any, minCellWidth: 150 },
      2: { cellWidth: 60, halign: 'center' },
      3: { cellWidth: 92, halign: 'center' },
      4: { cellWidth: 84, halign: 'center' },
      5: { cellWidth: 66, halign: 'center' },
    },
    margin: {
      top: PDF_TABLE_MARGIN_TOP,
      left: PDF_MARGIN,
      right: PDF_MARGIN,
      bottom: PDF_TABLE_MARGIN_BOTTOM,
    },
  });

  // Post-process: draw header + footer on every page
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    (doc as any).setPage(p);
    pdfDrawHeader(doc, reportTitle, timestamp);
    if (p === 1) pdfDrawSummaryBar(doc, summaryStats, PDF_SUMMARY_BAR_Y);
    pdfDrawFooter(doc, subtitle, p, totalPages);
  }

  doc.save(`schools-performance-term-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Employee Rankings PDF ─────────────────────────────────────────────────────
async function generateEmployeesPdf(
  employees: EmployeeRanking[],
  periodLabel: string,
  sortOrder: SortOrder,
  timestamp: string,
) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'pt' });
  const reportTitle = 'Employee Rankings Report';
  const subtitle = `${periodLabel} · ${sortOrder === 'best' ? 'Best Performers' : 'Needs Attention'}`;

  const avgScore =
    employees.length > 0
      ? fmt(employees.reduce((s, e) => s + (e.metrics.score ?? 0), 0) / employees.length)
      : 0;

  const summaryStats: PdfStatCard[] = [
    { label: 'Total Employees', value: String(employees.length), accent: [51, 65, 85], icon: 'users' },
    { label: 'Period', value: periodLabel, accent: [71, 85, 105], icon: 'calendar' },
    {
      label: 'Ranking Scope',
      value: sortOrder === 'best' ? 'Best to Worst' : 'Worst to Best',
      accent: sortOrder === 'best' ? [245, 158, 11] : [239, 68, 68],
      icon: 'ranking',
    },
    {
      label: 'Avg. Score',
      value: `${avgScore}%`,
      accent: rateColorRgb(avgScore, employees.length > 0),
      icon: 'score',
    },
  ];
  const firstPageTableY = getPdfFirstPageTableY(doc, summaryStats.length);

  const tableBody = employees.map((emp, i) => {
    const score = emp.metrics.score ?? 0;
    const presence = emp.metrics.presenceRate ?? 0;
    const punct = emp.metrics.punctualityRate ?? 0;
    const hours = emp.metrics.hoursCompletionRate ?? 0;
    const hasRateData = hasMetricData(emp.metrics.expectedDays);
    return [
      {
        content: String(emp.rank ?? i + 1),
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, textColor: [71, 85, 105] as any },
      },
      { content: emp.name, styles: { fontStyle: 'bold' as const } },
      { content: emp.employeeCode || '—', styles: { halign: 'center' as const, textColor: [71, 85, 105] as any } },
      emp.school.name,
      {
        content: formatRateValue(presence, emp.metrics.expectedDays),
        styles: {
          halign: 'center' as const,
          fontStyle: 'bold' as const,
          textColor: rateColorRgb(presence, hasRateData) as any,
        },
      },
      {
        content: formatRateValue(punct, emp.metrics.expectedDays),
        styles: {
          halign: 'center' as const,
          fontStyle: 'bold' as const,
          textColor: rateColorRgb(punct, hasRateData) as any,
        },
      },
      {
        content: formatRateValue(hours, emp.metrics.expectedDays),
        styles: {
          halign: 'center' as const,
          fontStyle: 'bold' as const,
          textColor: rateColorRgb(hours, hasRateData) as any,
        },
      },
      {
        content: formatRateValue(score, emp.metrics.expectedDays),
        styles: {
          halign: 'center' as const,
          fontStyle: 'bold' as const,
          textColor: rateColorRgb(score, hasRateData) as any,
        },
      },
    ];
  });

  autoTable(doc, {
    startY: firstPageTableY,
    head: [['#', 'Employee Name', 'Code', 'School', 'Presence', 'Punctuality', 'Hours', 'Score']],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: { top: 7, right: 6, bottom: 7, left: 6 },
      overflow: 'linebreak',
      font: 'helvetica',
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 'auto' as any, minCellWidth: 65 },
      2: { cellWidth: 70, halign: 'center' },
      3: { cellWidth: 145 },
      4: { cellWidth: 60, halign: 'center' },
      5: { cellWidth: 68, halign: 'center' },
      6: { cellWidth: 54, halign: 'center' },
      7: { cellWidth: 56, halign: 'center' },
    },
    margin: {
      top: PDF_TABLE_MARGIN_TOP,
      left: PDF_MARGIN,
      right: PDF_MARGIN,
      bottom: PDF_TABLE_MARGIN_BOTTOM,
    },
  });

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    (doc as any).setPage(p);
    pdfDrawHeader(doc, reportTitle, timestamp);
    if (p === 1) pdfDrawSummaryBar(doc, summaryStats, PDF_SUMMARY_BAR_Y);
    pdfDrawFooter(doc, subtitle, p, totalPages);
  }

  doc.save(`employee-rankings-term-${sortOrder}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Platform Summary PDF ──────────────────────────────────────────────────────
async function generateSummaryPdf(
  stats: PlatformStats,
  periodLabel: string,
  timestamp: string,
) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4', unit: 'pt' });
  const reportTitle = 'Platform Summary Report';
  const subtitle = periodLabel;
  const hasOverviewData = hasMetricData(stats.overview.expectedEmployeeDays);

  const summaryStats: PdfStatCard[] = [
    { label: 'Total Schools', value: String(stats.overview.totalSchools), accent: [51, 65, 85], icon: 'schools' },
    { label: 'Active', value: String(stats.overview.activeSchools), accent: [34, 197, 94], icon: 'ranking' },
    {
      label: 'Employees',
      value: stats.overview.trackedEmployees.toLocaleString(),
      accent: [59, 130, 246],
      icon: 'employees',
    },
    {
      label: 'Global Rate',
      value: formatRateValue(
        stats.overview.presenceRate,
        stats.overview.expectedEmployeeDays,
      ),
      accent: rateColorRgb(stats.overview.presenceRate, hasOverviewData),
      icon: 'rate',
    },
  ];
  const firstPageTableY = getPdfFirstPageTableY(doc, summaryStats.length);

  // ── Key metrics table ──
  const metricsBody: any[][] = [
    ['Total Schools', { content: String(stats.overview.totalSchools), styles: { fontStyle: 'bold', textColor: [139, 92, 246] } }],
    ['Active Schools', { content: String(stats.overview.activeSchools), styles: { fontStyle: 'bold', textColor: [34, 197, 94] } }],
    ['Suspended Schools', { content: String(stats.overview.suspendedSchools), styles: { fontStyle: 'bold', textColor: stats.overview.suspendedSchools > 0 ? [239, 68, 68] : [71, 85, 105] } }],
    ['Total Tracked Employees', { content: stats.overview.trackedEmployees.toLocaleString(), styles: { fontStyle: 'bold', textColor: [59, 130, 246] } }],
    ['Present in Timeframe', { content: stats.overview.presentInTimeframe.toLocaleString(), styles: { fontStyle: 'bold', textColor: [34, 197, 94] } }],
    ['Global Attendance Rate', {
      content: formatRateValue(stats.overview.presenceRate, stats.overview.expectedEmployeeDays),
      styles: {
        fontStyle: 'bold',
        textColor: rateColorRgb(stats.overview.presenceRate, hasOverviewData),
      },
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
    startY: firstPageTableY,
    head: [['Metric', 'Value']],
    body: metricsBody,
    theme: 'grid',
    styles: {
      fontSize: 9,
      textColor: [30, 41, 59],
      cellPadding: { top: 7, right: 12, bottom: 7, left: 12 },
      font: 'helvetica',
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [51, 65, 85], cellWidth: 200 },
      1: { cellWidth: 'auto' as any },
    },
    margin: {
      top: PDF_TABLE_MARGIN_TOP,
      left: PDF_MARGIN,
      right: PDF_MARGIN,
      bottom: PDF_TABLE_MARGIN_BOTTOM,
    },
  });

  let nextY = (doc as any).lastAutoTable.finalY + 18;

  // ── Top 5 Schools table ──
  if (stats.topFive && stats.topFive.length > 0) {
    pdfDrawSectionTitle(doc, 'TOP 5 PERFORMING SCHOOLS', nextY);
    nextY += 12;

    autoTable(doc, {
      startY: nextY,
      head: [['Rank', 'School Name', 'Employees', 'Presence Rate', 'Performance']],
      body: stats.topFive.map((s, i) => {
        const rate = s.metrics.presenceRate ?? 0;
        const hasRateData = hasMetricData(s.metrics.expectedEmployeeDays);
        return [
          { content: `#${i + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: s.name, styles: { fontStyle: 'bold' as const } },
          { content: String(s.metrics.employees), styles: { halign: 'center' as const } },
          {
            content: formatRateValue(rate, s.metrics.expectedEmployeeDays),
            styles: {
              halign: 'center' as const,
              fontStyle: 'bold' as const,
              textColor: rateColorRgb(rate, hasRateData) as any,
            },
          },
          {
            content: rateLabel(rate, hasRateData),
            styles: {
              halign: 'center' as const,
              fontStyle: 'bold' as const,
              textColor: rateColorRgb(rate, hasRateData) as any,
            },
          },
        ];
      }),
      theme: 'grid',
      styles: {
        fontSize: 8.5,
        font: 'helvetica',
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
        cellPadding: 5.5,
      },
      headStyles: {
        fillColor: [55, 65, 81],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 38, halign: 'center' },
        1: { cellWidth: 'auto' as any },
        2: { cellWidth: 65, halign: 'center' },
        3: { cellWidth: 75, halign: 'center' },
        4: { cellWidth: 75, halign: 'center' },
      },
      margin: { left: PDF_MARGIN, right: PDF_MARGIN, bottom: PDF_TABLE_MARGIN_BOTTOM },
    });

    nextY = (doc as any).lastAutoTable.finalY + 16;
  }

  // ── Bottom 5 Schools table ──
  if (stats.bottomFive && stats.bottomFive.length > 0) {
    pdfDrawSectionTitle(doc, 'LOWEST 5 PERFORMING SCHOOLS', nextY);
    nextY += 12;

    autoTable(doc, {
      startY: nextY,
      head: [['Rank', 'School Name', 'Employees', 'Presence Rate', 'Performance']],
      body: stats.bottomFive.map((s, i) => {
        const rate = s.metrics.presenceRate ?? 0;
        const hasRateData = hasMetricData(s.metrics.expectedEmployeeDays);
        return [
          { content: `#${i + 1}`, styles: { halign: 'center' as const, fontStyle: 'bold' as const } },
          { content: s.name, styles: { fontStyle: 'bold' as const } },
          { content: String(s.metrics.employees), styles: { halign: 'center' as const } },
          {
            content: formatRateValue(rate, s.metrics.expectedEmployeeDays),
            styles: {
              halign: 'center' as const,
              fontStyle: 'bold' as const,
              textColor: rateColorRgb(rate, hasRateData) as any,
            },
          },
          {
            content: rateLabel(rate, hasRateData),
            styles: {
              halign: 'center' as const,
              fontStyle: 'bold' as const,
              textColor: rateColorRgb(rate, hasRateData) as any,
            },
          },
        ];
      }),
      theme: 'grid',
      styles: {
        fontSize: 8.5,
        font: 'helvetica',
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
        cellPadding: 5.5,
      },
      headStyles: {
        fillColor: [55, 65, 81],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 38, halign: 'center' },
        1: { cellWidth: 'auto' as any },
        2: { cellWidth: 65, halign: 'center' },
        3: { cellWidth: 75, halign: 'center' },
        4: { cellWidth: 75, halign: 'center' },
      },
      margin: { left: PDF_MARGIN, right: PDF_MARGIN, bottom: PDF_TABLE_MARGIN_BOTTOM },
    });
  }

  // Post-process all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    (doc as any).setPage(p);
    pdfDrawHeader(doc, reportTitle, timestamp);
    if (p === 1) pdfDrawSummaryBar(doc, summaryStats, PDF_SUMMARY_BAR_Y);
    pdfDrawFooter(doc, subtitle, p, totalPages);
  }

  doc.save(`platform-summary-term-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Preview table components ───────────────────────────────────────────────────
function SchoolsPreview({
  schools,
  academicYear,
}: {
  schools: SchoolMetric[];
  academicYear: string;
}) {
  if (!academicYear)
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
        Select an academic year to view the report.
      </div>
    );
  if (schools.length === 0)
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
        No schools data available for the selected academic year and term.
      </div>
    );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['#', 'School Name', 'Employees', 'Attendance Rate', 'Performance', 'Portal'].map((h) => (
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
                  textAlign: ['Employees', 'Attendance Rate', 'Performance', 'Portal', '#'].includes(h) ? 'center' : 'left',
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
            const hasRateData = hasMetricData(school.metrics.expectedEmployeeDays);
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
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: rateColorHex(rate, hasRateData) }}>
                  {formatRateValue(rate, school.metrics.expectedEmployeeDays)}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: rateBg(rate, hasRateData), color: rateColorHex(rate, hasRateData) }}>
                    {rateLabel(rate, hasRateData)}
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

function EmployeesPreview({
  employees,
  academicYear,
}: {
  employees: EmployeeRanking[];
  academicYear: string;
}) {
  if (!academicYear)
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
        Select an academic year to view the report.
      </div>
    );
  if (employees.length === 0)
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
        No employee data available for the selected academic year and term.
      </div>
    );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['#', 'Employee', 'Code', 'School', 'Presence', 'Punctuality', 'Hours', 'Score'].map((h) => (
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
            const hasRateData = hasMetricData(emp.metrics.expectedDays);
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
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: emp.school.primaryColor }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{emp.school.name}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: rateColorHex(presence, hasRateData) }}>{formatRateValue(presence, emp.metrics.expectedDays)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: rateColorHex(punct, hasRateData) }}>{formatRateValue(punct, emp.metrics.expectedDays)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: rateColorHex(hours, hasRateData) }}>{formatRateValue(hours, emp.metrics.expectedDays)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: rateBg(score, hasRateData), color: rateColorHex(score, hasRateData) }}>
                    {formatRateValue(score, emp.metrics.expectedDays)}
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

function SummaryPreview({
  stats,
  academicYear,
}: {
  stats: PlatformStats | null;
  academicYear: string;
}) {
  if (!academicYear) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>Select an academic year to view the report.</div>;
  }
  if (!stats) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>No summary data available for the selected academic year and term.</div>;
  }
  const { overview } = stats;
  const cohorts = overview.cohorts ?? { excellent: 0, warning: 0, critical: 0 };
  const totalCohort = (cohorts.excellent + cohorts.warning + cohorts.critical) || 1;
  const hasOverviewData = hasMetricData(overview.expectedEmployeeDays);

  const metricCards = [
    { label: 'Total Schools', value: String(overview.totalSchools), color: '#8b5cf6' },
    { label: 'Active Schools', value: String(overview.activeSchools), color: '#22c55e' },
    { label: 'Suspended', value: String(overview.suspendedSchools), color: '#ef4444' },
    { label: 'Tracked Employees', value: overview.trackedEmployees.toLocaleString(), color: '#3b82f6' },
    { label: 'Present in Period', value: String(overview.presentInTimeframe), color: '#22c55e' },
    { label: 'Global Attendance', value: formatRateValue(overview.presenceRate, overview.expectedEmployeeDays), color: rateColorHex(overview.presenceRate, hasOverviewData) },
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
              const hasRateData = hasMetricData(s.metrics.expectedEmployeeDays);
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '20px', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'center', flexShrink: 0 }}>#{i + 1}</div>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.primaryColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: rateColorHex(rate, hasRateData), flexShrink: 0 }}>{formatRateValue(rate, s.metrics.expectedEmployeeDays)}</div>
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
  const [sortOrder, setSortOrder] = useState<SortOrder>('best');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const timeframe: Timeframe = 'term';

  const [schools, setSchools] = useState<SchoolMetric[]>([]);
  const [employees, setEmployees] = useState<EmployeeRanking[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  // Academic Calendar Filter State
  const [academicYear, setAcademicYear] = useState<string>('');
  const [termName, setTermName] = useState<string>('all');
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableTerms, setAvailableTerms] = useState<string[]>([]);
  const [allTermsData, setAllTermsData] = useState<AcademicTerm[]>([]);

  // Fetch available academic years and terms globally on mount
  useEffect(() => {
    async function loadTerms() {
      try {
        const res = await calendarApi.listTerms();
        const terms: AcademicTerm[] = Array.isArray(res.data) ? res.data : [];
        setAllTermsData(terms);

        const years = Array.from(new Set(terms.map((t) => t.academicYear).filter(Boolean))) as string[];
        years.sort((a, b) => b.localeCompare(a));
        setAvailableYears(years);

        const now = new Date();
        const currentTerm = terms.find((term) => {
          if (!term.startDate || !term.endDate) return false;
          const start = new Date(term.startDate);
          const end = new Date(term.endDate);
          end.setHours(23, 59, 59, 999);
          return now >= start && now <= end;
        });
        const activeTerm = terms.find((term) => term.isActive);
        const defaultYear = currentTerm?.academicYear ?? activeTerm?.academicYear ?? years[0] ?? '';
        setAcademicYear((current) => current || defaultYear);
      } catch (e) {
        console.error('Failed to load terms for filter:', e);
      }
    }
    loadTerms();
  }, []);

  // Update available terms when the selected academic year changes
  useEffect(() => {
    if (academicYear) {
      const termsForYear = allTermsData.filter((term) => term.academicYear === academicYear);
      const termNames = Array.from(new Set(termsForYear.map((term) => term.name))) as string[];
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
    if (!academicYear) {
      setSchools([]);
      setEmployees([]);
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearch('');

    const aYear = academicYear;
    const tName = termName && termName !== 'all' ? termName : undefined;

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
  }, [academicYear, reportType, sortOrder, termName, timeframe]);

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
    !academicYear
      ? 0
      : reportType === 'schools'
      ? filteredSchools.length
      : reportType === 'employees'
      ? filteredEmployees.length
      : stats
      ? 10
      : 0;
  const periodLabel = getPeriodLabel(academicYear, termName);

  const handleGeneratePdf = async () => {
    setGenerating(true);
    try {
      const now = new Date();
      const timestamp = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) +
        ' at ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      if (reportType === 'schools') {
        await generateSchoolsPdf(filteredSchools, periodLabel, sortOrder, timestamp);
      } else if (reportType === 'employees') {
        await generateEmployeesPdf(filteredEmployees, periodLabel, sortOrder, timestamp);
      } else if (stats) {
        await generateSummaryPdf(stats, periodLabel, timestamp);
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
                transition: 'all 0.18s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = `0 8px 28px ${rt.color}30`;
                e.currentTarget.style.borderColor = isActive ? rt.color : rt.color + '66';
                if (!isActive) {
                  e.currentTarget.style.background = rt.bg;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '';
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--bg-card)';
                } else {
                  e.currentTarget.style.borderColor = rt.color;
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
        {/* Academic Year / Term Selectors */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            aria-label="Select Academic Year"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
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
            <option value="" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>Select Academic Year</option>
            {availableYears.map((y) => (
              <option key={y} value={y} style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>{y}</option>
            ))}
          </select>

          <select
            aria-label="Select Term"
            value={termName}
            onChange={(e) => setTermName(e.target.value)}
            disabled={!academicYear}
            style={{
              padding: '5px 12px',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: 600,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: academicYear ? 'pointer' : 'not-allowed',
              opacity: academicYear ? 1 : 0.7,
            }}
          >
            <option value="all" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>Entire Academic Year</option>
            {availableTerms.map((t) => (
              <option key={t} value={t} style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>{t}</option>
            ))}
          </select>
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
            {REPORT_TYPES.find((r) => r.type === reportType)?.label} · {periodLabel}
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
          <SchoolsPreview schools={filteredSchools} academicYear={academicYear} />
        ) : reportType === 'employees' ? (
          <EmployeesPreview employees={filteredEmployees} academicYear={academicYear} />
        ) : (
          <SummaryPreview stats={stats} academicYear={academicYear} />
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
