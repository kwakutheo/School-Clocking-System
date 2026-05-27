import { Injectable } from '@nestjs/common';
import { AttendanceReportService } from './attendance-report.service';
const pdfmake = require('pdfmake');

@Injectable()
export class AttendanceExportService {
  constructor(private readonly reportService: AttendanceReportService) {
    // Use standard PDF fonts so we don't need TTF files
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };
    pdfmake.setFonts(fonts);
  }

  async exportMonthlyPdf(employeeId: string, month: number, year: number): Promise<Buffer> {
    const report = await this.reportService.getMonthlyReport(employeeId, month, year);
    const docDefinition = this.buildMonthlyDocDefinition(report, month, year);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    return await pdfDoc.getBuffer();
  }

  async exportTermPdf(employeeId: string, termId: string): Promise<Buffer> {
    const report = await this.reportService.getTermReport(employeeId, termId);
    const docDefinition = this.buildTermDocDefinition(report);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    return await pdfDoc.getBuffer();
  }

  async exportBulkMonthlyPdf(month: number, year: number, branchId?: string, branchName?: string): Promise<Buffer> {
    const reports = await this.reportService.getBulkMonthlyReport(month, year, branchId);
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month - 1];
    const title = `Bulk Attendance Summary - ${monthName} ${year}`;
    const subtitle = branchId ? `Branch: ${branchName}` : 'All Branches';

    const docDefinition = this.buildBulkSummaryDocDefinition(reports, title, subtitle);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    return await pdfDoc.getBuffer();
  }

  async exportBulkTermPdf(termId: string, branchId?: string, branchName?: string, termName?: string): Promise<Buffer> {
    const reports = await this.reportService.getBulkTermReport(termId, branchId);
    
    const title = `Bulk Attendance Summary - ${termName || 'Term'}`;
    const subtitle = branchId ? `Branch: ${branchName}` : 'All Branches';

    const docDefinition = this.buildBulkSummaryDocDefinition(reports, title, subtitle);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    return await pdfDoc.getBuffer();
  }

  private buildBulkSummaryDocDefinition(reports: any[], title: string, subtitle: string): any {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const generatedStr = `${dd}/${mm}/${yyyy} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    const footerFn = function(currentPage: number, pageCount: number) {
      return {
        columns: [
          {
            width: '*',
            columns: [
              { image: require('path').join(process.cwd(), '..', 'dashboard', 'public', 'logo.png'), width: 20, margin: [0, -2, 5, 0] },
              { text: 'TK Clocking System', alignment: 'left', margin: [0, 2, 0, 0], color: '#6b7280', fontSize: 9 }
            ]
          },
          { text: `Report generated on ${generatedStr}`, alignment: 'center', margin: [0, 2, 0, 0], color: '#6b7280', fontSize: 9, width: '*' },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', margin: [0, 2, 0, 0], color: '#6b7280', fontSize: 9, width: '*' }
        ],
        margin: [40, 10, 40, 0]
      };
    };

    const tableBody = reports.map(r => [
      { text: r.employee.fullName, bold: true },
      `${r.summary.totalHours}h`,
      r.summary.daysWorked.toString(),
      r.summary.daysAbsent.toString(),
      `${r.summary.daysLate} (${this.formatMinutes(r.summary.totalLateMinutes)})`,
      `${r.summary.daysEarlyDeparture} (${this.formatMinutes(r.summary.totalEarlyOutMinutes)})`,
      r.summary.daysForgotClockOut.toString()
    ]);

    tableBody.unshift([
      { text: 'Employee', style: 'tableHeader' } as any,
      { text: 'Hrs', style: 'tableHeader' },
      { text: 'Wrk', style: 'tableHeader' },
      { text: 'Abs', style: 'tableHeader' },
      { text: 'Late', style: 'tableHeader' },
      { text: 'EarlyOut', style: 'tableHeader' },
      { text: 'MissOut', style: 'tableHeader' }
    ]);

    return {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 60],
      footer: footerFn,
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      content: [
        { text: title, style: 'coverTitle', alignment: 'center', margin: [0, 10, 0, 5] },
        { text: subtitle, style: 'coverSub', alignment: 'center', margin: [0, 0, 0, 15] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 2, lineColor: '#e5e7eb' }], margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex !== 0 && rowIndex % 2 === 0) ? '#f8fafc' : null,
            hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 2 : 1,
            vLineWidth: () => 0,
            hLineColor: () => '#e2e8f0',
            paddingLeft: () => 10,
            paddingRight: () => 10,
            paddingTop: () => 8,
            paddingBottom: () => 8
          }
        }
      ],
      styles: {
        coverTitle: { fontSize: 22, bold: true, color: '#111827' },
        coverSub: { fontSize: 14, color: '#4b5563' },
        tableHeader: { bold: true, fillColor: '#2563eb', color: '#ffffff', margin: [0, 4, 0, 4] }
      }
    };
  }

  private formatMinutes(mins: number): string {
    if (!mins || mins === 0) return '0m';
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  private buildMonthlyDocDefinition(report: any, month: number, year: number): any {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month - 1];

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const generatedStr = `${dd}/${mm}/${yyyy} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const footerFn = function(currentPage: number, pageCount: number) {
      return {
        columns: [
          {
            width: '*',
            columns: [
              { image: require('path').join(process.cwd(), '..', 'dashboard', 'public', 'logo.png'), width: 20, margin: [0, -2, 5, 0] },
              { text: 'TK Clocking System', alignment: 'left', margin: [0, 2, 0, 0], color: '#6b7280', fontSize: 9 }
            ]
          },
          { text: `Report generated on ${generatedStr}`, alignment: 'center', margin: [0, 2, 0, 0], color: '#6b7280', fontSize: 9, width: '*' },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', margin: [0, 2, 0, 0], color: '#6b7280', fontSize: 9, width: '*' }
        ],
        margin: [40, 10, 40, 0]
      };
    };

    return {
      footer: footerFn,
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      content: [
        { text: 'Monthly Attendance Report', style: 'header' },
        { text: `Employee: ${report.employee.fullName}`, style: 'subheader' },
        { text: `Period: ${monthName} ${year}`, style: 'subheader', margin: [0, 0, 0, 15] },
        this.buildSummaryTable(report.summary),
        { text: 'Daily Log', style: 'sectionHeader', margin: [0, 20, 0, 10] },
        this.buildDailyLogTable(report.days)
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5] },
        subheader: { fontSize: 12, color: '#000000', margin: [0, 0, 0, 5] },
        sectionHeader: { fontSize: 14, bold: true },
        tableHeader: { bold: true, fillColor: '#f3f4f6', color: '#374151' }
      }
    };
  }

  private buildTermDocDefinition(report: any): any {
    const content: any[] = [
      { text: 'Academic Term Attendance Report', style: 'coverTitle', alignment: 'center', margin: [0, 60, 0, 10] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#00000038' }], margin: [0, 0, 0, 20] },
      { text: report.employee.fullName, style: 'coverName', alignment: 'center' },
      { text: ``, alignment: 'center', margin: [0, 5, 0, 20] },
      { text: `Term: ${report.term.name}`, style: 'coverSub', alignment: 'center' },
      { text: `Academic Year: ${report.term.academicYear}`, style: 'coverSub', alignment: 'center', margin: [0, 5, 0, 40] },
      { text: 'Term Summary Overview', style: 'sectionHeader', alignment: 'center', margin: [0, 0, 0, 15] },
      this.buildSummaryTable(report.summary)
    ];

    report.months.forEach((m: any) => {
      content.push({ text: m.name, style: 'sectionHeader', margin: [0, 20, 0, 10], pageBreak: 'before' });
      content.push(this.buildSummaryTable(m.summary));
      content.push({ text: 'Daily Log', style: 'subheader', margin: [0, 15, 0, 5] });
      content.push(this.buildDailyLogTable(m.days));
    });

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const generatedStr = `${dd}/${mm}/${yyyy} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const footerFn = function(currentPage: number, pageCount: number) {
      return {
        columns: [
          {
            width: '*',
            columns: [
              { image: require('path').join(process.cwd(), '..', 'dashboard', 'public', 'logo.png'), width: 20, margin: [0, -2, 5, 0] },
              { text: 'TK Clocking System', alignment: 'left', margin: [0, 2, 0, 0], color: '#6b7280', fontSize: 9 }
            ]
          },
          { text: `Report generated on ${generatedStr}`, alignment: 'center', margin: [0, 2, 0, 0], color: '#6b7280', fontSize: 9, width: '*' },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', margin: [0, 2, 0, 0], color: '#6b7280', fontSize: 9, width: '*' }
        ],
        margin: [40, 10, 40, 0]
      };
    };

    return {
      footer: footerFn,
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      content,
      styles: {
        coverTitle: { fontSize: 24, bold: true, color: '#111827' },
        coverName: { fontSize: 20, bold: true, color: '#2563eb' },
        coverSub: { fontSize: 14, color: '#4b5563' },
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5] },
        subheader: { fontSize: 12, color: '#4b5563', margin: [0, 0, 0, 5] },
        sectionHeader: { fontSize: 14, bold: true },
        tableHeader: { bold: true, fillColor: '#f3f4f6', color: '#374151' }
      }
    };
  }

  private buildSummaryTable(summary: any) {
    return {
      margin: [0, 5, 0, 20],
      table: {
        widths: ['25%', '25%', '25%', '25%'],
        body: [
          [
            { text: 'Total Hours', bold: true, fillColor: '#f8fafc' },
            { text: `${summary.totalHours}h` },
            { text: 'Days Worked', bold: true, fillColor: '#f8fafc' },
            { text: summary.daysWorked.toString() }
          ],
          [
            { text: 'Days Absent', bold: true, fillColor: '#f8fafc' },
            { text: summary.daysAbsent.toString() },
            { text: 'Days Late', bold: true, fillColor: '#f8fafc' },
            { text: `${summary.daysLate} (${this.formatMinutes(summary.totalLateMinutes)})` }
          ],
          [
            { text: 'Early Departures', bold: true, fillColor: '#f8fafc' },
            { text: `${summary.daysEarlyDeparture} (${this.formatMinutes(summary.totalEarlyOutMinutes)})` },
            { text: 'Missed Clock-Out', bold: true, fillColor: '#f8fafc' },
            { text: summary.daysForgotClockOut.toString() }
          ]
        ]
      },
      layout: {
        hLineWidth: (i: number, node: any) => 1,
        vLineWidth: (i: number, node: any) => 1,
        hLineColor: (i: number, node: any) => '#e2e8f0',
        vLineColor: (i: number, node: any) => '#e2e8f0',
        paddingLeft: (i: number, node: any) => 12,
        paddingRight: (i: number, node: any) => 12,
        paddingTop: (i: number, node: any) => 10,
        paddingBottom: (i: number, node: any) => 10,
      }
    };
  }

  private buildDailyLogTable(days: any[]) {
    // Get today's date as YYYY-MM-DD
    const today = new Date();
    // Use local timezone offset to get correct today date
    const offset = today.getTimezoneOffset();
    const todayLocal = new Date(today.getTime() - (offset * 60 * 1000));
    const todayStr = todayLocal.toISOString().split('T')[0];

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${daysOfWeek[d.getDay()]}, ${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]}`;
    };

    const tableBody = days.map(d => {
      const isFuture = d.date > todayStr;

      if (isFuture) {
        return [
          formatDate(d.date),
          { text: '-', color: '#6b7280', bold: false },
          '-',
          '-',
          '-',
          '-',
          '-'
        ];
      }

      let statusColor = '#000000';
      if (d.status === 'ABSENT') statusColor = '#ef4444'; // Red
      else if (d.status === 'SUSPENDED' || d.status === 'INACTIVE') statusColor = '#f59e0b'; // Amber/Orange
      else if (d.status.includes('HOLIDAY') || d.status === 'WEEKEND' || d.status.includes('BREAK') || d.status.includes('OFF-TERM')) statusColor = '#6b7280'; // Gray
      else if (d.status === 'PRESENT') statusColor = '#059669'; // Green
      else if (d.status.includes('LEAVE')) statusColor = '#0284c7'; // Blue

      return [
        formatDate(d.date),
        { text: d.status, color: statusColor, bold: d.status === 'ABSENT' || d.status === 'PRESENT' },
        d.clockIn ? new Date(d.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        d.clockOut ? new Date(d.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        `${d.hours}h`,
        d.isLate ? `Yes (${this.formatMinutes(d.lateMinutes)})` : 'No',
        d.isEarlyOut ? `Yes (${this.formatMinutes(d.earlyOutMinutes)})` : 'No'
      ];
    });

    tableBody.unshift([
      { text: 'Date', style: 'tableHeader' } as any,
      { text: 'Status', style: 'tableHeader' },
      { text: 'In', style: 'tableHeader' },
      { text: 'Out', style: 'tableHeader' },
      { text: 'Hours', style: 'tableHeader' },
      { text: 'Late', style: 'tableHeader' },
      { text: 'Early Out', style: 'tableHeader' }
    ]);

    return {
      table: {
        headerRows: 1,
        widths: ['auto', '*', 55, 55, 'auto', 'auto', 'auto'],
        body: tableBody
      },
      layout: {
        hLineWidth: (i: number, node: any) => 1,
        vLineWidth: (i: number, node: any) => 0,
        hLineColor: (i: number, node: any) => '#e5e7eb',
        paddingTop: (i: number, node: any) => 6,
        paddingBottom: (i: number, node: any) => 6,
      }
    };
  }
}
