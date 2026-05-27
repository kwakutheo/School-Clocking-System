import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AttendanceLog } from '../attendance/attendance-log.entity';
import { Employee } from '../employees/employee.entity';
import { EmployeeStatusLog } from '../employees/employee-status-log.entity';
import { HolidaysService } from '../holidays/holidays.service';
import { AcademicCalendarService } from '../academic-calendar/academic-calendar.service';
import { LeavesService } from '../leaves/leaves.service';
import { LeaveRequest } from '../leaves/leave-request.entity';
import { EmployeeStatus, AttendanceType } from '../../common/enums';
import { tenantLocalStorage } from '../../common/tenant/tenant.context';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isWeekend, 
  format,
  isSameDay,
  isAfter,
  startOfDay,
  parseISO,
  eachMonthOfInterval
} from 'date-fns';

/** Resolve what status an employee had on a specific calendar day by walking the history log. */
function resolveStatusOnDay(logs: EmployeeStatusLog[], day: Date): EmployeeStatus | null {
  const dayStr = format(day, 'yyyy-MM-dd');
  const match = logs.find(log => {
    const start = format(new Date(log.startDate), 'yyyy-MM-dd');
    const end = log.endDate ? format(new Date(log.endDate), 'yyyy-MM-dd') : null;
    return dayStr >= start && (end === null || dayStr <= end);
  });
  return match ? match.status : null;
}

@Injectable()
export class AttendanceReportService {
  constructor(
    @InjectRepository(AttendanceLog)
    private readonly attendanceRepo: Repository<AttendanceLog>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeeStatusLog)
    private readonly statusLogRepo: Repository<EmployeeStatusLog>,
    private readonly holidaysService: HolidaysService,
    private readonly academicCalendarService: AcademicCalendarService,
    private readonly leavesService: LeavesService,
  ) {}

  async getMonthlyReport(employeeId: string, month: number, year: number) {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    const approvedLeaves = await this.leavesService.findApprovedInRange(employeeId, startStr, endStr);
    return this.getReportForRange(employeeId, startDate, endDate, undefined, approvedLeaves);
  }

  async getTermReport(employeeId: string, termId: string, preloadedLogs?: EmployeeStatusLog[]) {
    const term = await this.academicCalendarService.findOneTerm(termId);
    const startDate = parseISO(term.startDate);
    const endDate = parseISO(term.endDate);
    const approvedLeaves = await this.leavesService.findApprovedInRange(employeeId, term.startDate, term.endDate);
    const fullReport = await this.getReportForRange(employeeId, startDate, endDate, preloadedLogs, approvedLeaves);
    
    // Group by month for "monthly tabs"
    const months: any[] = [];
    const monthsInTerm = eachMonthOfInterval({ start: startDate, end: endDate });
    
    monthsInTerm.forEach(monthDate => {
      const mStart = startOfMonth(monthDate);
      const mEnd = endOfMonth(monthDate);
      const monthDays = fullReport.days.filter(d => {
        const dDate = parseISO(d.date);
        return dDate >= mStart && dDate <= mEnd;
      });
      
      if (monthDays.length > 0) {
        const mSummary = monthDays.reduce((acc, day) => {
          acc.totalHours += day.hours;
          if (day.status === 'PRESENT' || (day.status === 'IN PROGRESS' && day.clockIn)) acc.daysWorked++;
          if (day.status === 'ABSENT') acc.daysAbsent++;
          if (day.isLate) {
            acc.daysLate++;
            acc.totalLateMinutes += day.lateMinutes;
          }
          if (day.isEarlyOut) {
            acc.daysEarlyDeparture++;
            acc.totalEarlyOutMinutes += day.earlyOutMinutes;
          }
          if (day.missingClockOut) {
            acc.daysForgotClockOut++;
          }
          return acc;
        }, {
          totalHours: 0,
          daysWorked: 0,
          daysAbsent: 0,
          daysLate: 0,
          totalLateMinutes: 0,
          daysEarlyDeparture: 0,
          totalEarlyOutMinutes: 0,
          daysForgotClockOut: 0
        });

        months.push({
          name: format(monthDate, 'MMMM yyyy'),
          month: monthDate.getMonth() + 1,
          year: monthDate.getFullYear(),
          summary: {
            ...mSummary,
            totalHours: Number(mSummary.totalHours.toFixed(2))
          },
          days: monthDays
        });
      }
    });

    return {
      ...fullReport,
      months,
      term
    };
  }

  async getBulkMonthlyReport(month: number, year: number, branchId?: string) {
    const query: any = {};
    if (branchId) query.branch = { id: branchId };
    const employees = await this.employeeRepo.find({ where: query });
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);
    const tenantId = tenantLocalStorage.getStore();

    // One bulk query for all status logs in the report range — O(1) for any employee count
    const allLogs = await this.statusLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.employee', 'emp')
      .where('log.start_date <= :end', { end: format(endDate, 'yyyy-MM-dd') })
      .andWhere('(log.end_date IS NULL OR log.end_date >= :start)', { start: format(startDate, 'yyyy-MM-dd') })
      .andWhere('log.tenantId = :tenantId', { tenantId })
      .getMany();

    const logsByEmployee = new Map<string, EmployeeStatusLog[]>();
    allLogs.forEach(log => {
      const empId = log.employee.id;
      if (!logsByEmployee.has(empId)) logsByEmployee.set(empId, []);
      logsByEmployee.get(empId)!.push(log);
    });

    const results = await Promise.all(employees.map(async (emp) => {
      const empLogs = logsByEmployee.get(emp.id) ?? [];
      // Skip employees who were fully inactive before this month and never worked it
      const wasEverActive = empLogs.some(l => l.status === EmployeeStatus.ACTIVE);
      if (!wasEverActive && emp.status === EmployeeStatus.INACTIVE) return null;

      const report = await this.getReportForRange(emp.id, startDate, endDate, empLogs);
      if (emp.status === EmployeeStatus.INACTIVE && report.summary.daysWorked === 0) return null;

      return { employee: report.employee, summary: report.summary };
    }));

    return results.filter(r => r !== null);
  }

  async getBulkTermReport(termId: string, branchId?: string) {
    const query: any = {};
    if (branchId) query.branch = { id: branchId };
    const employees = await this.employeeRepo.find({ where: query });

    const term = await this.academicCalendarService.findOneTerm(termId);
    const startDate = parseISO(term.startDate);
    const endDate = parseISO(term.endDate);
    const tenantId = tenantLocalStorage.getStore();

    // One bulk query for all status logs in the term range
    const allLogs = await this.statusLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.employee', 'emp')
      .where('log.start_date <= :end', { end: term.endDate })
      .andWhere('(log.end_date IS NULL OR log.end_date >= :start)', { start: term.startDate })
      .andWhere('log.tenantId = :tenantId', { tenantId })
      .getMany();

    const logsByEmployee = new Map<string, EmployeeStatusLog[]>();
    allLogs.forEach(log => {
      const empId = log.employee.id;
      if (!logsByEmployee.has(empId)) logsByEmployee.set(empId, []);
      logsByEmployee.get(empId)!.push(log);
    });

    const results = await Promise.all(employees.map(async (emp) => {
      const empLogs = logsByEmployee.get(emp.id) ?? [];
      const wasEverActive = empLogs.some(l => l.status === EmployeeStatus.ACTIVE);
      if (!wasEverActive && emp.status === EmployeeStatus.INACTIVE) return null;

      const report = await this.getTermReport(emp.id, termId, empLogs);
      if (emp.status === EmployeeStatus.INACTIVE && report.summary.daysWorked === 0) return null;

      return { employee: report.employee, summary: report.summary };
    }));

    return results.filter(r => r !== null);
  }

  private async getReportForRange(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    preloadedLogs?: EmployeeStatusLog[],
    preloadedLeaves?: LeaveRequest[],
  ) {
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId },
      relations: ['user', 'shift'],
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // Fetch this employee's status history if not preloaded (for individual reports)
    const statusLogs: EmployeeStatusLog[] = preloadedLogs ?? await this.statusLogRepo.find({
      where: { employee: { id: employeeId } },
      order: { startDate: 'ASC' },
    });

    // Fetch approved leaves if not preloaded (for individual reports)
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    const approvedLeaves: LeaveRequest[] = preloadedLeaves ??
      await this.leavesService.findApprovedInRange(employeeId, startStr, endStr);

    const logs = await this.attendanceRepo.find({
      where: {
        employee: { id: employeeId },
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'ASC' },
    });

    const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });
    const holidays = await this.holidaysService.findAll();
    const terms = await this.academicCalendarService.findAllTerms();
    const today = startOfDay(new Date());
    
    let totalHours = 0;
    let daysWorked = 0;
    let daysAbsent = 0;
    let daysOnLeave = 0;
    let daysLate = 0;
    let totalLateMinutes = 0;
    let daysEarlyDeparture = 0;
    let totalEarlyOutMinutes = 0;
    let daysForgotClockOut = 0;

    const registrationDate = employee.hireDate ? new Date(employee.hireDate) : new Date(employee.createdAt);
    registrationDate.setHours(0, 0, 0, 0);

    const reportDays = daysInRange.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayLogs = logs.filter(l => isSameDay(new Date(l.timestamp), day));
      
      const isWeekEnd = isWeekend(day);
      const holiday = holidays.find(h => {
        const hDate = h.date;
        if (h.isRecurring) {
          return hDate.substring(5) === dayStr.substring(5);
        }
        return hDate === dayStr;
      });

      const term = terms.find(t => dayStr >= t.startDate && dayStr <= t.endDate);
      const breakItem = term?.breaks?.find(b => dayStr >= b.startDate && dayStr <= b.endDate);

      const clockIn = dayLogs.find(l => l.type === AttendanceType.CLOCK_IN);
      const clockOut = dayLogs.find(l => l.type === AttendanceType.CLOCK_OUT);

      const isFuture = isAfter(day, today);
      const isToday = isSameDay(day, today);
      
      let status = 'PRESENT';
      let hours = 0;
      let isLate = false;
      let lateMinutes = 0;
      let isEarlyOut = false;
      let earlyOutMinutes = 0;
      let missingClockIn = false;
      let missingClockOut = false;

      if (employee.shift) {
        const shiftStart = this._timeToMinutes(employee.shift.startTime);
        const shiftEnd = this._timeToMinutes(employee.shift.endTime);
        const grace = employee.shift.graceMinutes || 0;

        if (clockIn) {
          const actualIn = clockIn.timestamp.getHours() * 60 + clockIn.timestamp.getMinutes();
          if (actualIn > shiftStart + grace) {
            isLate = true;
            lateMinutes = actualIn - shiftStart;
            daysLate++;
            totalLateMinutes += lateMinutes;
          }
        }

        if (clockOut) {
          const actualOut = clockOut.timestamp.getHours() * 60 + clockOut.timestamp.getMinutes();
          if (actualOut < shiftEnd) {
            isEarlyOut = true;
            earlyOutMinutes = shiftEnd - actualOut;
            daysEarlyDeparture++;
            totalEarlyOutMinutes += earlyOutMinutes;
          }
        }
      }

      if (clockIn || clockOut) {
        daysWorked++;
        
        if (clockIn && employee.shift) {
          const [sHours, sMins] = employee.shift.startTime.split(':').map(Number);
          const [eHours, eMins] = employee.shift.endTime.split(':').map(Number);
          
          const sStart = new Date(day);
          sStart.setHours(sHours, sMins, 0, 0);
          const sEnd = new Date(day);
          sEnd.setHours(eHours, eMins, 0, 0);

          // Start at max(clockIn, shiftStart)
          const calcStart = clockIn.timestamp > sStart ? clockIn.timestamp : sStart;
          
          // End at min(clockOut ?? now, shiftEnd)
          let calcEnd: Date;
          if (clockOut) {
            calcEnd = clockOut.timestamp < sEnd ? clockOut.timestamp : sEnd;
          } else if (isToday) {
            calcEnd = new Date() > sEnd ? sEnd : new Date();
            status = 'IN PROGRESS';
          } else if (!isFuture) {
            calcEnd = sEnd;
            status = 'PRESENT';
            missingClockOut = true;
            daysForgotClockOut++;
          } else {
            calcEnd = calcStart; // No hours for future?
          }

          hours = Math.max(0, (calcEnd.getTime() - calcStart.getTime()) / 3600000);
        } else if (clockIn && clockOut) {
          // Legacy calculation if no shift
          hours = (clockOut.timestamp.getTime() - clockIn.timestamp.getTime()) / (1000 * 60 * 60);
        } else if (isToday && clockIn) {
          status = 'IN PROGRESS';
          hours = (new Date().getTime() - clockIn.timestamp.getTime()) / (1000 * 60 * 60);
        } else if (clockIn || clockOut) {
          status = 'PRESENT';
          missingClockIn = !clockIn;
          missingClockOut = !clockOut;
          if (missingClockOut) daysForgotClockOut++;
        }
        
        totalHours += hours;
      } else {
        // ── Temporal Status Resolution using History Log ──────────────────
        // Look up what status this employee actually had on this specific day.
        const effectiveStatus = resolveStatusOnDay(statusLogs, day);

        if (effectiveStatus === EmployeeStatus.INACTIVE) {
          status = 'INACTIVE';
        } else if (day < registrationDate) {
          status = 'NOT REGISTERED';
        } else if (isWeekEnd) {
          status = 'WEEKEND';
        } else if (holiday) {
          status = `HOLIDAY (${holiday.name})`;
        } else if (breakItem) {
          status = `BREAK (${breakItem.name})`;
        } else if (!term) {
          status = 'OFF-TERM / VACATION';
        } else if (effectiveStatus === EmployeeStatus.SUSPENDED) {
          status = 'SUSPENDED';
        } else {
          // ── Check approved personal leaves before marking ABSENT ──────────
          const onLeave = approvedLeaves.find(
            l => dayStr >= l.startDate && dayStr <= l.endDate,
          );
          if (onLeave) {
            // Approved leave — not counted as absent
            status = `LEAVE (${onLeave.leaveType})`;
            daysOnLeave++;
          } else if (isFuture || isToday) {
            if (isToday && employee.shift) {
              const [eHours, eMins] = employee.shift.endTime.split(':').map(Number);
              const sEnd = new Date(day);
              sEnd.setHours(eHours, eMins, 0, 0);
              if (new Date() > sEnd) {
                status = 'ABSENT';
                daysAbsent++;
              } else {
                status = 'AWAITING';
              }
            } else {
              status = isToday ? 'AWAITING' : 'SCHEDULED';
            }
          } else {
            status = 'ABSENT';
            daysAbsent++;
          }
        }
      }

      return {
        date: dayStr,
        status,
        clockIn: clockIn?.timestamp,
        clockOut: clockOut?.timestamp,
        hours: Number(hours.toFixed(2)),
        isLate,
        lateMinutes,
        isEarlyOut,
        earlyOutMinutes,
        missingClockIn,
        missingClockOut,
      };
    });

    return {
      employee: {
        fullName: employee.user.fullName,
        code: employee.employeeCode,
        shift: employee.shift ? `${employee.shift.startTime} - ${employee.shift.endTime}` : 'No Shift',
      },
      summary: {
        totalHours: Number(totalHours.toFixed(2)),
        daysWorked,
        daysAbsent,
        daysOnLeave,
        daysLate,
        totalLateMinutes,
        daysEarlyDeparture,
        totalEarlyOutMinutes,
        daysForgotClockOut,
      },
      days: reportDays,
    };
  }

  private _timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
