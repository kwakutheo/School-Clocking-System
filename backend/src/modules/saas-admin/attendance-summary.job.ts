import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { AttendanceDailySummary } from '../attendance/attendance-daily-summary.entity';
import { Employee } from '../employees/employee.entity';
import { EmployeeStatusLog } from '../employees/employee-status-log.entity';
import { Holiday } from '../holidays/holiday.entity';
import { AttendanceLog } from '../attendance/attendance-log.entity';
import { Tenant } from '../tenants/tenant.entity';
import { AttendanceType, EmployeeStatus } from '../../common/enums';

/**
 * AttendanceSummaryJob
 *
 * Runs nightly at 01:00 AM server time. Recomputes the last BACKFILL_DAYS
 * calendar days for every active tenant and upserts one row per (tenant, date)
 * into attendance_daily_summaries.
 *
 * Why pre-computed summaries?
 * ─────────────────
 *  With 1 000+ schools × 100+ employees each you easily reach 100 000 employee
 *  records. Computing presence rates on every dashboard page-load by scanning
 *  attendance_logs with complex date arithmetic would take seconds and would
 *  not scale over 10 years of accumulated log data.
 *
 *  By materialising one tiny row per (tenant, date) the SaaS Admin dashboard
 *  can aggregate months of data in milliseconds with a simple SUM query.
 *
 * Correctness guarantees
 * ──────────────────────
 *  • Expected count uses EmployeeStatusLog to reconstruct what each employee's
 *    status was on each specific calendar date – not their current status.
 *  • Employees hired after a date are excluded (hireDate > date).
 *  • Employees on a shift whose workingDays does not include the ISO day-of-week
 *    (1=Mon … 7=Sun) are excluded. Employees with no shift assigned default to
 *    Mon–Fri (ISO days 1-5).
 *  • Both global (tenantId IS NULL) and school-specific holidays are applied,
 *    setting expectedCount = 0 for that date.
 *  • The 90-day rolling backfill window corrects for backdated admin changes.
 */
@Injectable()
export class AttendanceSummaryJob {
  private readonly logger = new Logger(AttendanceSummaryJob.name);

  /**
   * How many calendar days back the job will recompute on each nightly run.
   * 90 days catches retroactive status changes, bulk imports, and term edits.
   */
  private readonly BACKFILL_DAYS = 90;

  constructor(
    @InjectRepository(AttendanceDailySummary)
    private readonly summaryRepo: Repository<AttendanceDailySummary>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeeStatusLog)
    private readonly statusLogRepo: Repository<EmployeeStatusLog>,
    @InjectRepository(Holiday)
    private readonly holidayRepo: Repository<Holiday>,
    @InjectRepository(AttendanceLog)
    private readonly attendanceLogRepo: Repository<AttendanceLog>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Nightly at 01:00 ───────────────────────────────────────────────────────
  @Cron('0 1 * * *', { name: 'attendance-summary-nightly' })
  async runNightly() {
    this.logger.log('Attendance summary job started');
    const t0 = Date.now();

    const end = new Date();
    end.setDate(end.getDate() + 7); // Forward fill 7 days so expected counts exist for today
    end.setHours(23, 59, 59, 999);

    const start = new Date();
    start.setDate(start.getDate() - this.BACKFILL_DAYS);
    start.setHours(0, 0, 0, 0);

    await this.recompute(start, end);

    this.logger.log(`Attendance summary job finished in ${Date.now() - t0}ms`);
  }

  /**
   * Public method so that the SaasAdminController can trigger an on-demand
   * backfill (e.g. immediately after a global holiday is added/deleted).
   */
  async recompute(start: Date, end: Date): Promise<void> {
    const tenants = await this.tenantRepo.find({ where: { isActive: true } });
    if (tenants.length === 0) return;

    const tenantIds = tenants.map((t) => t.id);
    const startStr = this.toDateStr(start);
    const endStr = this.toDateStr(end);
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    // ── 1. Load global holidays (tenantId IS NULL) once ─────────────────────
    const globalHolidays = await this.holidayRepo.find({
      where: { tenantId: IsNull() },
    });

    // ── 2. Load all tenant-specific holidays in one query ───────────────────
    const schoolHolidays = await this.holidayRepo
      .createQueryBuilder('h')
      .where('h.tenant_id IN (:...tenantIds)', { tenantIds })
      .getMany();

    // ── 3. Load all employees for all tenants (id, tenantId, hireDate, shift.workingDays) ─
    const employees = await this.employeeRepo
      .createQueryBuilder('e')
      .select([
        'e.id',
        'e.tenantId',
        'e.hireDate',
        'e.status',
        's.workingDays',
      ])
      .leftJoin('e.shift', 's')
      .where('e.tenantId IN (:...tenantIds)', { tenantIds })
      .getMany();

    // ── 4. Load all status-log entries that overlap [start, end] ────────────
    //    A row overlaps if startDate <= end AND (endDate IS NULL OR endDate >= start)
    const statusLogs = await this.statusLogRepo
      .createQueryBuilder('sl')
      .where('sl.tenantId IN (:...tenantIds)', { tenantIds })
      .andWhere('sl.startDate <= :endStr', { endStr })
      .andWhere('(sl.endDate IS NULL OR sl.endDate >= :startStr)', { startStr })
      .getMany();

    // ── 5. Load CLOCK_IN counts grouped by (tenantId, date) ─────────────────
    const clockInRows: { tenantId: string; day: string; cnt: string }[] =
      await this.attendanceLogRepo
        .createQueryBuilder('log')
        .select('log.tenantId', 'tenantId')
        .addSelect("DATE_TRUNC('day', log.timestamp)::date::text", 'day')
        .addSelect('COUNT(DISTINCT log.employee_id)', 'cnt')
        .where('log.tenantId IN (:...tenantIds)', { tenantIds })
        .andWhere('log.timestamp BETWEEN :start AND :end', { start, end })
        .andWhere('log.type = :type', { type: AttendanceType.CLOCK_IN })
        .groupBy('log.tenantId')
        .addGroupBy("DATE_TRUNC('day', log.timestamp)::date::text")
        .getRawMany();

    // Index clock-in counts: tenantId → dateStr → count
    const clockInMap = new Map<string, Map<string, number>>();
    for (const row of clockInRows) {
      if (!clockInMap.has(row.tenantId)) clockInMap.set(row.tenantId, new Map());
      clockInMap.get(row.tenantId)!.set(row.day, Number(row.cnt));
    }

    // Index employees by tenantId
    const employeesByTenant = new Map<string, typeof employees>();
    for (const emp of employees) {
      if (!emp.tenantId) continue;
      if (!employeesByTenant.has(emp.tenantId)) employeesByTenant.set(emp.tenantId, []);
      employeesByTenant.get(emp.tenantId)!.push(emp);
    }

    // Index status logs by employeeId for fast lookup
    const statusLogsByEmployee = new Map<string, EmployeeStatusLog[]>();
    for (const sl of statusLogs) {
      const empId = sl.employeeId;
      if (!empId) continue;
      if (!statusLogsByEmployee.has(empId)) statusLogsByEmployee.set(empId, []);
      statusLogsByEmployee.get(empId)!.push(sl);
    }

    // ── 6. Build holiday exclusion sets per tenant ───────────────────────────
    const holidayExclusionByTenant = new Map<string, Set<string>>();

    // Global set
    const globalSet = new Set<string>();
    for (const h of globalHolidays) {
      this.expandHolidayDates(h.date, h.isRecurring, startYear, endYear, startStr, endStr, globalSet);
    }

    for (const tenant of tenants) {
      const tSet = new Set<string>(globalSet);
      for (const h of schoolHolidays.filter((h) => h.tenantId === tenant.id)) {
        this.expandHolidayDates(h.date, h.isRecurring, startYear, endYear, startStr, endStr, tSet);
      }
      holidayExclusionByTenant.set(tenant.id, tSet);
    }

    // ── 7. Generate the date series [start, end] ─────────────────────────────
    const dates: string[] = [];
    const cur = new Date(start);
    while (this.toDateStr(cur) <= endStr) {
      dates.push(this.toDateStr(cur));
      cur.setDate(cur.getDate() + 1);
    }

    // ── 8. Compute expected count per (tenant, date) and upsert ─────────────
    const upsertRows: Partial<AttendanceDailySummary>[] = [];

    for (const tenant of tenants) {
      const tenantEmployees = employeesByTenant.get(tenant.id) ?? [];
      const holidaySet = holidayExclusionByTenant.get(tenant.id) ?? new Set<string>();
      const tenantClockIns = clockInMap.get(tenant.id) ?? new Map<string, number>();

      for (const dateStr of dates) {
        const isHoliday = holidaySet.has(dateStr);
        let expectedCount = 0;

        if (!isHoliday) {
          const dateObj = new Date(dateStr);
          // ISO day-of-week: 1=Monday … 7=Sunday
          const isoDow = dateObj.getUTCDay() === 0 ? 7 : dateObj.getUTCDay();

          for (const emp of tenantEmployees) {
            // a) Not yet hired
            if (emp.hireDate) {
              const hireDateStr = this.toDateStr(new Date(emp.hireDate));
              if (hireDateStr > dateStr) continue;
            }

            // b) Check shift working days (default Mon-Fri if no shift)
            const workingDays: number[] = emp.shift?.workingDays ?? [1, 2, 3, 4, 5];
            if (!workingDays.includes(isoDow)) continue;

            // c) Reconstruct status on this specific date using status logs
            const empStatus = this.getStatusOnDate(
              emp.id,
              dateStr,
              emp.status,
              statusLogsByEmployee,
            );
            if (empStatus !== EmployeeStatus.ACTIVE) continue;

            expectedCount++;
          }
        }

        const presentCount = tenantClockIns.get(dateStr) ?? 0;

        upsertRows.push({
          tenantId: tenant.id,
          date: dateStr,
          expectedCount,
          presentCount,
          isHoliday,
        });
      }
    }

    // ── 9. Batch upsert (conflict on tenantId+date → update) ────────────────
    //  Process in chunks of 500 to avoid hitting parameter limits
    const CHUNK_SIZE = 500;
    for (let i = 0; i < upsertRows.length; i += CHUNK_SIZE) {
      const chunk = upsertRows.slice(i, i + CHUNK_SIZE);
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(AttendanceDailySummary)
        .values(chunk as AttendanceDailySummary[])
        .orUpdate(
          ['expected_count', 'present_count', 'is_holiday', 'computed_at'],
          ['tenant_id', 'date'],
        )
        .execute();
    }

    this.logger.log(
      `Upserted ${upsertRows.length} summary rows for ${tenants.length} tenants ` +
        `across ${dates.length} dates`,
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private toDateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  /**
   * Reconstructs an employee's status on a specific date by consulting the
   * status-log history. Falls back to the employee's current status field if no
   * log entry covers that date.
   */
  private getStatusOnDate(
    employeeId: string,
    dateStr: string,
    currentStatus: EmployeeStatus,
    statusLogsByEmployee: Map<string, EmployeeStatusLog[]>,
  ): EmployeeStatus {
    const logs = statusLogsByEmployee.get(employeeId);
    if (!logs || logs.length === 0) return currentStatus;

    // Find a log entry whose [startDate, endDate] window contains dateStr
    for (const log of logs) {
      const logStart = this.toDateStr(new Date(log.startDate));
      const logEnd = log.endDate ? this.toDateStr(new Date(log.endDate)) : null;

      if (logStart <= dateStr && (logEnd === null || logEnd >= dateStr)) {
        return log.status;
      }
    }

    return currentStatus;
  }

  /**
   * Expands a single holiday record into concrete YYYY-MM-DD strings and adds
   * them to targetSet. Recurring holidays are expanded for every year in the
   * [startYear, endYear] range.
   */
  private expandHolidayDates(
    date: string,
    isRecurring: boolean,
    startYear: number,
    endYear: number,
    startStr: string,
    endStr: string,
    targetSet: Set<string>,
  ): void {
    if (isRecurring) {
      const mmdd = date.substring(5);
      for (let year = startYear; year <= endYear; year++) {
        const d = `${year}-${mmdd}`;
        if (d >= startStr && d <= endStr) targetSet.add(d);
      }
    } else {
      if (date >= startStr && date <= endStr) targetSet.add(date);
    }
  }
}
