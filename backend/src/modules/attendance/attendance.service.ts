import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceLog } from './attendance-log.entity';
import { EmployeesService } from '../employees/employees.service';
import { BranchesService } from '../branches/branches.service';
import { HolidaysService } from '../holidays/holidays.service';
import { AcademicCalendarService } from '../academic-calendar/academic-calendar.service';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { SyncOfflineDto } from './dto/sync-offline.dto';
import { QrClockDto } from './dto/qr-clock.dto';
import { AdminManualClockDto } from './dto/admin-manual-clock.dto';
import { AttendanceType, UserRole, LeaveStatus } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import { LeavesService } from '../leaves/leaves.service';
import { User } from '../users/user.entity';
import { getCurrentTenantId } from '../../common/tenant/tenant-filter.helper';


@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceLog)
    private readonly repo: Repository<AttendanceLog>,
    private readonly employees: EmployeesService,
    private readonly branches: BranchesService,
    private readonly holidays: HolidaysService,
    private readonly academicCalendar: AcademicCalendarService,
    private readonly auditService: AuditService,
    private readonly leavesService: LeavesService,
  ) {}

  // ── Record single event ───────────────────────────────────────────────────
  async record(userId: string, dto: RecordAttendanceDto): Promise<AttendanceLog> {
    // Check if school has academic terms configured
    const allTerms = await this.academicCalendar.findAllTerms();
    if (!allTerms || allTerms.length === 0) {
      throw new BadRequestException(
        'Action denied: Your school has no active academic calendar. Please contact your school administrator.',
      );
    }

    const employee = await this.employees.findByUserId(userId);
    if (!employee) {
      throw new NotFoundException('No employee profile found for this user.');
    }

    if (!employee.shift) {
      throw new BadRequestException(
        'You have not been assigned a work shift. Please contact HR to assign you a shift before clocking in.',
      );
    }

    if (employee.status !== 'active') {
      throw new BadRequestException(
        `Action denied. Your account status is currently: ${employee.status.toUpperCase()}.`,
      );
    }

    const now = dto.timestamp ? new Date(dto.timestamp) : new Date();

    // ── Non-working day guard ─────────────────────────────────────────────
    const dayStatus = await this._checkNonWorkingDay(now);
    if (dayStatus.isNonWorking) {
      throw new BadRequestException(
        `Action denied: Today is a ${dayStatus.name}. Clocking is not allowed on non-working days.`,
      );
    }

    // ── Individual Leave guard ────────────────────────────────────────────
    const dateStr = now.toISOString().split('T')[0];
    const approvedLeaves = await this.leavesService.findApprovedInRange(
      employee.id,
      dateStr,
      dateStr,
    );

    if (approvedLeaves.length > 0) {
      const leave = approvedLeaves[0];
      throw new BadRequestException(
        `Action denied: You have an approved ${leave.leaveType.toUpperCase()} LEAVE for today. Clocking is not allowed while on leave.`,
      );
    }

    // ── Determine the current working day boundary ─────────────────────────
    // "Today" for attendance purposes is the calendar day of 'now'.
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    // Fetch all of today's logs for this employee, oldest first.
    const todayLogs = await this.repo
      .createQueryBuilder('log')
      .where('log.employee = :empId', { empId: employee.id })
      .andWhere('log.timestamp >= :dayStart', { dayStart })
      .andWhere('log.timestamp <= :dayEnd', { dayEnd })
      .orderBy('log.timestamp', 'ASC')
      .getMany();

    const hasClockedInToday = todayLogs.some(l => l.type === AttendanceType.CLOCK_IN);
    const hasClockOutToday  = todayLogs.some(l => l.type === AttendanceType.CLOCK_OUT);

    // ── State-machine validation ──────────────────────────────────────────
    switch (dto.type) {
      case AttendanceType.CLOCK_IN: {
        // Rule: Only one clock-in per working day.
        if (hasClockedInToday) {
          throw new BadRequestException(
            'You have already clocked in today. You cannot clock in again until the next working day.',
          );
        }
        // Rule: Must clock in within assigned working hours.
        if (!this._isWithinShiftHours(now, employee.shift)) {
          throw new BadRequestException(
            `Action denied: Clock-in can only be recorded within your assigned working hours (${employee.shift.startTime} - ${employee.shift.endTime}).`,
          );
        }
        break;
      }

      case AttendanceType.CLOCK_OUT: {
        // Rule: Must have clocked in first.
        if (!hasClockedInToday) {
          throw new BadRequestException(
            'You have not clocked in today. Please clock in before clocking out.',
          );
        }
        // Rule: Cannot clock out if already clocked out.
        if (hasClockOutToday) {
          throw new BadRequestException(
            'You have already clocked out today.',
          );
        }
        // Rule: Cannot clock out while on a break (last relevant event is BREAK_IN).
        const lastRelevant = [...todayLogs]
          .reverse()
          .find(l => [
            AttendanceType.CLOCK_IN,
            AttendanceType.CLOCK_OUT,
            AttendanceType.BREAK_IN,
            AttendanceType.BREAK_OUT,
          ].includes(l.type));
        if (lastRelevant?.type === AttendanceType.BREAK_IN) {
          throw new BadRequestException(
            'You are currently on a break. Please end your break before clocking out.',
          );
        }

        // Rule: Cannot clock out before the shift even starts (if clocked in early).
        if (employee.shift) {
          const [sHours, sMins] = employee.shift.startTime.split(':').map(Number);
          const shiftStart = new Date(now);
          shiftStart.setHours(sHours, sMins, 0, 0);

          if (now < shiftStart) {
            throw new BadRequestException(
              `Action denied: Your shift starts at ${employee.shift.startTime}. You cannot clock out until the shift has officially started.`,
            );
          }
        }

        // Rule: Early clock-out warning (soft block — user can override with forceEarlyOut).
        if (!dto.forceEarlyOut) {
          const fullEmp = await this.employees.findById(employee.id);
          const shift = fullEmp?.shift;
          if (shift) {
            const [eHours, eMins] = shift.endTime.split(':').map(Number);
            const shiftEnd = new Date(now);
            shiftEnd.setHours(eHours, eMins, 0, 0);

            if (now < shiftEnd) {
              const remainingMs = shiftEnd.getTime() - now.getTime();
              const remainingMins = Math.round(remainingMs / 60_000);
              const hours = Math.floor(remainingMins / 60);
              const mins  = remainingMins % 60;
              const timeLeft = hours > 0
                ? `${hours}h ${mins}m`
                : `${mins} minute${mins !== 1 ? 's' : ''}`;

              throw new BadRequestException(
                JSON.stringify({
                  code: 'EARLY_CLOCK_OUT',
                  message: `Your shift ends at ${shift.endTime}. You still have ${timeLeft} remaining. Are you sure you want to clock out early?`,
                  remainingMinutes: remainingMins,
                }),
              );
            }
          }
        }
        break;
      }

      case AttendanceType.BREAK_IN: {
        // Rule: Must have clocked in first.
        if (!hasClockedInToday) {
          throw new BadRequestException(
            'You have not clocked in today. You must clock in before starting a break.',
          );
        }
        // Rule: Must be within working hours.
        if (!this._isWithinShiftHours(now, employee.shift)) {
          throw new BadRequestException(
            `Action denied: Breaks can only be recorded within your assigned working hours (${employee.shift.startTime} - ${employee.shift.endTime}).`,
          );
        }
        // Rule: Cannot start a break if already on a break.
        const lastBreakRelevant = [...todayLogs]
          .reverse()
          .find(l => [AttendanceType.BREAK_IN, AttendanceType.BREAK_OUT, AttendanceType.CLOCK_OUT].includes(l.type));
        if (lastBreakRelevant?.type === AttendanceType.BREAK_IN) {
          throw new BadRequestException(
            'You are already on a break. Please end your current break before starting a new one.',
          );
        }
        // Rule: Cannot start a break after clocking out.
        if (hasClockOutToday) {
          throw new BadRequestException(
            'You have already clocked out for the day. You cannot start a break.',
          );
        }
        break;
      }

      case AttendanceType.BREAK_OUT: {
        // Rule: Must have clocked in first.
        if (!hasClockedInToday) {
          throw new BadRequestException(
            'You have not clocked in today. You must clock in before ending a break.',
          );
        }
        // Rule: Must be within working hours.
        if (!this._isWithinShiftHours(now, employee.shift)) {
          throw new BadRequestException(
            `Action denied: Breaks can only be recorded within your assigned working hours (${employee.shift.startTime} - ${employee.shift.endTime}).`,
          );
        }
        // Rule: Must be on a break to end one.
        const lastBreakOutRelevant = [...todayLogs]
          .reverse()
          .find(l => [AttendanceType.BREAK_IN, AttendanceType.BREAK_OUT, AttendanceType.CLOCK_IN].includes(l.type));
        if (!lastBreakOutRelevant || lastBreakOutRelevant.type !== AttendanceType.BREAK_IN) {
          throw new BadRequestException(
            'You are not currently on a break. Please start a break before ending one.',
          );
        }
        // Rule: Cannot end a break after clocking out.
        if (hasClockOutToday) {
          throw new BadRequestException(
            'You have already clocked out for the day. You cannot end a break.',
          );
        }
        break;
      }
    }

    // ── Geofence validation ───────────────────────────────────────────────
    const branchId = dto.branchId ?? employee.branch?.id;
    if (!branchId) {
      throw new BadRequestException(
        'You are not assigned to any branch. Please contact HR to assign you to a branch before clocking in.',
      );
    }

    let branch = await this.branches.findById(branchId).catch(() => null);
    if (!branch) {
      throw new BadRequestException('The assigned branch could not be found.');
    }

    if (branch?.latitude && dto.latitude && dto.longitude) {
      const dist = this._haversine(
        dto.latitude, dto.longitude,
        Number(branch.latitude), Number(branch.longitude),
      );
      if (dist > branch.allowedRadius) {
        throw new BadRequestException(
          `You are ${Math.round(dist)}m from ${branch.name} (limit: ${branch.allowedRadius}m).`,
        );
      }
    }

    // ── Duplicate prevention: no two same-type events within 1 minute ─────
    const oneMinuteAgo = new Date(now.getTime() - 60_000);
    const duplicate = await this.repo
      .createQueryBuilder('log')
      .where('log.employee = :empId', { empId: employee.id })
      .andWhere('log.type = :type', { type: dto.type })
      .andWhere('log.timestamp > :cutoff', { cutoff: oneMinuteAgo })
      .getOne();

    if (duplicate) {
      throw new BadRequestException('Duplicate attendance event detected. Please wait a moment before trying again.');
    }

    const log = this.repo.create({
      employee,
      branch: branch ?? undefined,
      type: dto.type,
      timestamp: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      deviceId: dto.deviceId,
      isOfflineSync: dto.isOfflineSync ?? false,
    });

    const savedLog = await this.repo.save(log);

    return savedLog;
  }

  // ── Batch offline sync ────────────────────────────────────────────────────
  async syncOffline(userId: string, dto: SyncOfflineDto): Promise<{ synced: number; errors?: string[] }> {
    let synced = 0;
    const errors: string[] = [];
    
    for (const record of dto.records) {
      try {
        await this.record(userId, { ...record, isOfflineSync: true });
        synced++;
      } catch (e: any) {
        errors.push(e.message || 'Unknown validation error');
      }
    }
    
    // If all records in the batch failed (which is always true for the app's 1-by-1 sync when it fails)
    // we throw the error so the client receives a 400 Bad Request with the actual reason.
    if (errors.length > 0 && synced === 0) {
      throw new BadRequestException(errors.join(', '));
    }

    return { synced, errors: errors.length > 0 ? errors : undefined };
  }

  // ── Admin Manual Clock Override ───────────────────────────────────────────
  /**
   * Allows an ADMIN to manually clock in/out on behalf of another employee.
   * Rules:
   *  - Only HR_ADMIN or SUPER_ADMIN can call this.
   *  - An admin CANNOT clock themselves in/out (self-clocking is blocked).
   *  - Another admin CAN clock for a fellow admin (cross-admin is allowed).
   *  - Records are flagged as `isAdminOverride = true` for the audit trail.
   */
  async adminManualClock(
    actingUserId: string,
    actingUserRole: UserRole,
    actingUserFullName: string,
    dto: AdminManualClockDto,
  ): Promise<AttendanceLog> {
    // Check if school has academic terms configured
    const allTerms = await this.academicCalendar.findAllTerms();
    if (!allTerms || allTerms.length === 0) {
      throw new BadRequestException(
        'Action denied: Your school has no academic calendar terms configured. Please configure your academic terms in the settings panel first.',
      );
    }

    // ── Role guard ──────────────────────────────────────────────────────────
    if (actingUserRole !== UserRole.HR_ADMIN && actingUserRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only admins can perform manual clock overrides.');
    }

    // ── Resolve the ACTING admin's own employee record ──────────────────────
    const actingEmployee = await this.employees.findByUserId(actingUserId);

    // ── Resolve the TARGET employee ─────────────────────────────────────────
    const targetEmployee = await this.employees.findById(dto.employeeId);
    if (!targetEmployee) {
      throw new NotFoundException('Target employee not found.');
    }

    // ── Self-clocking block ─────────────────────────────────────────────────
    if (actingEmployee && actingEmployee.id === targetEmployee.id) {
      throw new ForbiddenException(
        'You cannot perform a manual clock override for yourself. Another admin must do it for you.',
      );
    }

    if (targetEmployee.status !== 'active') {
      throw new BadRequestException(
        `Action denied. The target employee account status is: ${targetEmployee.status.toUpperCase()}.`,
      );
    }

    const now = dto.timestamp ? new Date(dto.timestamp) : new Date();

    // ── Non-working day guard ─────────────────────────────────────────────
    const dayStatus = await this._checkNonWorkingDay(now);
    if (dayStatus.isNonWorking) {
      throw new BadRequestException(
        `Action denied: The selected date is a ${dayStatus.name}. Manual clocking is not allowed on non-working days.`,
      );
    }

    // ── Target employee Leave guard ───────────────────────────────────────
    const dateStr = now.toISOString().split('T')[0];
    const approvedLeaves = await this.leavesService.findApprovedInRange(
      targetEmployee.id,
      dateStr,
      dateStr,
    );

    if (approvedLeaves.length > 0) {
      const leave = approvedLeaves[0];
      throw new BadRequestException(
        `Action denied: This person has an approved ${leave.leaveType.toUpperCase()} LEAVE for today. Manual clocking is not allowed while on leave.`,
      );
    }

    // ── Current Day Guard (Same Day Enforcement) ────────────────────────────
    if (now.toDateString() !== new Date().toDateString()) {
      throw new BadRequestException(
        'Action denied: Manual clocking can only be performed for the current calendar day.',
      );
    }

    // ── Real-Time Ceiling Guard ─────────────────────────────────────────────
    if (now > new Date()) {
      throw new BadRequestException('The selected time cannot be in the future.');
    }

    // ── Shift Boundary Guard ────────────────────────────────────────────────
    if (targetEmployee.shift && !this._isWithinShiftHours(now, targetEmployee.shift)) {
      throw new BadRequestException(
        `Action denied: Manual clocking must be within the employee's assigned shift hours (${targetEmployee.shift.startTime} - ${targetEmployee.shift.endTime}).`,
      );
    }

    // ── Determine today's boundary relative to the chosen timestamp ──────────
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    const todayLogs = await this.repo
      .createQueryBuilder('log')
      .where('log.employee = :empId', { empId: targetEmployee.id })
      .andWhere('log.timestamp >= :dayStart', { dayStart })
      .andWhere('log.timestamp <= :dayEnd', { dayEnd })
      .orderBy('log.timestamp', 'ASC')
      .getMany();

    const hasClockedInToday = todayLogs.some(l => l.type === AttendanceType.CLOCK_IN);
    const hasClockOutToday  = todayLogs.some(l => l.type === AttendanceType.CLOCK_OUT);

    // ── State-machine validation (same rules as regular record) ─────────────
    if (dto.type === AttendanceType.CLOCK_IN && hasClockedInToday) {
      throw new BadRequestException(
        'The employee has already clocked in today. Cannot add a duplicate clock-in.',
      );
    }
    if (dto.type === AttendanceType.CLOCK_OUT) {
      if (!hasClockedInToday) {
        throw new BadRequestException(
          'The employee has not clocked in today. Cannot clock out without a prior clock-in.',
        );
      }
      if (hasClockOutToday) {
        throw new BadRequestException('The employee has already clocked out today.');
      }
      // Rule: Cannot clock out before the shift has officially started (mirrors mobile app rule).
      if (targetEmployee.shift) {
        const [sHours, sMins] = targetEmployee.shift.startTime.split(':').map(Number);
        const shiftStart = new Date(now);
        shiftStart.setHours(sHours, sMins, 0, 0);
        if (now < shiftStart) {
          throw new BadRequestException(
            `Action denied: The employee's shift starts at ${targetEmployee.shift.startTime}. A clock-out cannot be recorded until the shift has officially started.`,
          );
        }
      }
    }

    // ── Determine isLate for CLOCK_IN ────────────────────────────────────────
    let isLate = false;
    if (dto.type === AttendanceType.CLOCK_IN && targetEmployee.shift) {
      const [sHours, sMins] = targetEmployee.shift.startTime.split(':').map(Number);
      const shiftStart = new Date(now);
      shiftStart.setHours(sHours, sMins + (targetEmployee.shift.graceMinutes || 0), 0, 0);
      isLate = now > shiftStart;
    }

    // ── Persist the log ──────────────────────────────────────────────────────
    // Resolve the admin's display name for the employee-facing banner.
    // Prefer the linked employee profile name, then fall back to the JWT
    // fullName (covers admins with no employee profile), then a generic label.
    const adminDisplayName =
      actingEmployee?.user?.fullName ?? actingUserFullName ?? 'An Administrator';

    const log = this.repo.create({
      employee: targetEmployee,
      branch: targetEmployee.branch ?? undefined,
      type: dto.type,
      timestamp: now,
      isLate,
      isOfflineSync: false,
      isAdminOverride: true,
      adminNote: dto.note,
      adminOverrideName: adminDisplayName,
    });

    const savedLog = await this.repo.save(log);

    const actingUser = { id: actingUserId, role: actingUserRole } as User;
    await this.auditService.log({
      user: actingUser,
      action: 'ADMIN_MANUAL_CLOCK',
      module: 'ATTENDANCE',
      targetId: savedLog.id,
      newValues: {
        targetEmployeeId: targetEmployee.id,
        targetEmployeeName: targetEmployee.user?.fullName,
        type: dto.type,
        timestamp: now,
        note: dto.note,
      },
    });

    return savedLog;
  }

  // ── QR code clock-in ──────────────────────────────────────────────────────
  async recordViaQr(userId: string, dto: QrClockDto): Promise<AttendanceLog> {
    // Check if school has academic terms configured
    const allTerms = await this.academicCalendar.findAllTerms();
    if (!allTerms || allTerms.length === 0) {
      throw new BadRequestException(
        'Action denied: Your school has no active academic calendar. Please contact your school administrator.',
      );
    }

    const employee = await this.employees.findByUserId(userId);
    if (!employee) {
      throw new NotFoundException('No employee profile found for this user.');
    }

    if (!employee.shift) {
      throw new BadRequestException(
        'You have not been assigned a work shift. Please contact HR to assign you a shift before clocking in.',
      );
    }

    if (employee.status !== 'active') {
      throw new BadRequestException(
        `Action denied. Your account status is currently: ${employee.status.toUpperCase()}.`,
      );
    }

    const now = dto.timestamp ? new Date(dto.timestamp) : new Date();

    const dayStatus = await this._checkNonWorkingDay(now);
    if (dayStatus.isNonWorking) {
      throw new BadRequestException(
        `Action denied: Today is a ${dayStatus.name}. Clocking is not allowed on non-working days.`,
      );
    }

    // ── Individual Leave guard ────────────────────────────────────────────
    const dateStr = now.toISOString().split('T')[0];
    const approvedLeaves = await this.leavesService.findApprovedInRange(
      employee.id,
      dateStr,
      dateStr,
    );

    if (approvedLeaves.length > 0) {
      const leave = approvedLeaves[0];
      throw new BadRequestException(
        `Action denied: You have an approved ${leave.leaveType.toUpperCase()} LEAVE for today. Clocking is not allowed while on leave.`,
      );
    }

    const branch = await this.branches.findByQrCode(dto.qrCode);
    if (!branch) throw new BadRequestException('Invalid QR code.');

    if (employee.branch?.id !== branch.id) {
      throw new BadRequestException('This QR code does not belong to your assigned branch.');
    }

    // ── Same state-machine as record() ───────────────────────────────────
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    const todayLogs = await this.repo
      .createQueryBuilder('log')
      .where('log.employee = :empId', { empId: employee.id })
      .andWhere('log.timestamp >= :dayStart', { dayStart })
      .andWhere('log.timestamp <= :dayEnd', { dayEnd })
      .orderBy('log.timestamp', 'ASC')
      .getMany();

    const hasClockedInToday = todayLogs.some(l => l.type === AttendanceType.CLOCK_IN);
    const hasClockOutToday  = todayLogs.some(l => l.type === AttendanceType.CLOCK_OUT);

    switch (dto.type) {
      case AttendanceType.CLOCK_IN: {
        if (hasClockedInToday) {
          throw new BadRequestException(
            'You have already clocked in today. You cannot clock in again until the next working day.',
          );
        }
        if (!this._isWithinShiftHours(now, employee.shift)) {
          throw new BadRequestException(
            `Action denied: Clock-in can only be recorded within your assigned working hours (${employee.shift.startTime} - ${employee.shift.endTime}).`,
          );
        }
        break;
      }
      case AttendanceType.CLOCK_OUT: {
        if (!hasClockedInToday) throw new BadRequestException('You have not clocked in today. Please clock in before clocking out.');
        if (hasClockOutToday)   throw new BadRequestException('You have already clocked out today.');
        const last = [...todayLogs].reverse().find(l => [AttendanceType.CLOCK_IN, AttendanceType.CLOCK_OUT, AttendanceType.BREAK_IN, AttendanceType.BREAK_OUT].includes(l.type));
        if (last?.type === AttendanceType.BREAK_IN) throw new BadRequestException('You are currently on a break. Please end your break before clocking out.');

        // Rule: Cannot clock out before the shift even starts (if clocked in early).
        if (employee.shift) {
          const [sHours, sMins] = employee.shift.startTime.split(':').map(Number);
          const shiftStart = new Date(now);
          shiftStart.setHours(sHours, sMins, 0, 0);

          if (now < shiftStart) {
            throw new BadRequestException(
              `Action denied: Your shift starts at ${employee.shift.startTime}. You cannot clock out until the shift has officially started.`,
            );
          }
        }

        // Rule: Early clock-out warning (soft block — user can override with forceEarlyOut).
        if (!dto.forceEarlyOut) {
          const fullEmp = await this.employees.findById(employee.id);
          const shift = fullEmp?.shift;
          if (shift) {
            const [eHours, eMins] = shift.endTime.split(':').map(Number);
            const shiftEnd = new Date(now);
            shiftEnd.setHours(eHours, eMins, 0, 0);

            if (now < shiftEnd) {
              const remainingMs = shiftEnd.getTime() - now.getTime();
              const remainingMins = Math.round(remainingMs / 60_000);
              const hours = Math.floor(remainingMins / 60);
              const mins  = remainingMins % 60;
              const timeLeft = hours > 0
                ? `${hours}h ${mins}m`
                : `${mins} minute${mins !== 1 ? 's' : ''}`;

              throw new BadRequestException(
                JSON.stringify({
                  code: 'EARLY_CLOCK_OUT',
                  message: `Your shift ends at ${shift.endTime}. You still have ${timeLeft} remaining. Are you sure you want to clock out early?`,
                  remainingMinutes: remainingMins,
                }),
              );
            }
          }
        }
        break;
      }
      case AttendanceType.BREAK_IN: {
        if (!hasClockedInToday) throw new BadRequestException('You must clock in before starting a break.');
        // Rule: Must be within working hours.
        if (!this._isWithinShiftHours(now, employee.shift)) {
          throw new BadRequestException(
            `Action denied: Breaks can only be recorded within your assigned working hours (${employee.shift.startTime} - ${employee.shift.endTime}).`,
          );
        }
        if (hasClockOutToday)   throw new BadRequestException('You have already clocked out. You cannot start a break.');
        const last = [...todayLogs].reverse().find(l => [AttendanceType.BREAK_IN, AttendanceType.BREAK_OUT, AttendanceType.CLOCK_OUT].includes(l.type));
        if (last?.type === AttendanceType.BREAK_IN) throw new BadRequestException('You are already on a break.');
        break;
      }
      case AttendanceType.BREAK_OUT: {
        if (!hasClockedInToday) throw new BadRequestException('You must clock in before ending a break.');
        // Rule: Must be within working hours.
        if (!this._isWithinShiftHours(now, employee.shift)) {
          throw new BadRequestException(
            `Action denied: Breaks can only be recorded within your assigned working hours (${employee.shift.startTime} - ${employee.shift.endTime}).`,
          );
        }
        if (hasClockOutToday)   throw new BadRequestException('You have already clocked out. You cannot end a break.');
        const last = [...todayLogs].reverse().find(l => [AttendanceType.BREAK_IN, AttendanceType.BREAK_OUT, AttendanceType.CLOCK_IN].includes(l.type));
        if (!last || last.type !== AttendanceType.BREAK_IN) throw new BadRequestException('You are not currently on a break.');
        break;
      }
    }

    // GPS geofence validation
    if (branch.latitude && dto.latitude && dto.longitude) {
      const dist = this._haversine(
        dto.latitude, dto.longitude,
        Number(branch.latitude), Number(branch.longitude),
      );
      if (dist > branch.allowedRadius) {
        throw new BadRequestException(
          `You are ${Math.round(dist)}m from ${branch.name} (limit: ${branch.allowedRadius}m).`,
        );
      }
    }

    // Duplicate prevention
    const oneMinuteAgo = new Date(now.getTime() - 60_000);
    const duplicate = await this.repo
      .createQueryBuilder('log')
      .where('log.employee = :empId', { empId: employee.id })
      .andWhere('log.type = :type', { type: dto.type })
      .andWhere('log.timestamp > :cutoff', { cutoff: oneMinuteAgo })
      .getOne();

    if (duplicate) {
      throw new BadRequestException('Duplicate attendance event detected. Please wait a moment before trying again.');
    }

    const log = this.repo.create({
      employee,
      branch: branch ?? undefined,
      type: dto.type,
      timestamp: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      isOfflineSync: false,
    });

    const savedLog = await this.repo.save(log);

    return savedLog;
  }

  // ── History ───────────────────────────────────────────────────────────────
  async getHistory(
    userId: string,
    userRole: UserRole,
    page = 1,
    limit = 20,
    employeeId?: string,
  ): Promise<{ data: AttendanceLog[]; total: number }> {
    const isAdmin =
      userRole === UserRole.SUPER_ADMIN ||
      userRole === UserRole.HR_ADMIN ||
      userRole === UserRole.SUPERVISOR;

    // 1. Determine whose history we are fetching.
    // Non-admin users always see their OWN records — resolved from the JWT user
    // ID, never from the query param (which may carry a user UUID instead of an
    // employee UUID when employeeId is null on the mobile side).
    let targetEmployeeId: string | undefined;

    if (!isAdmin) {
      // Regular employee: always resolve from JWT, ignore query param.
      const employee = await this.employees.findByUserId(userId);
      if (!employee) throw new NotFoundException('Employee profile not found.');
      targetEmployeeId = employee.id;
    } else {
      // Admin: use the supplied employee_id to scope, or show everything.
      targetEmployeeId = employeeId || undefined;
      // If admin passed their own user ID instead of an employee ID, resolve it.
      if (targetEmployeeId) {
        const asEmployee = await this.employees.findByUserId(targetEmployeeId).catch(() => null);
        if (asEmployee) targetEmployeeId = asEmployee.id;
      }
    }

    // 2. Build the query
    const tenantId = getCurrentTenantId();
    const qb = this.repo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.employee', 'emp')
      .leftJoinAndSelect('emp.user', 'user')
      .leftJoinAndSelect('log.branch', 'branch');

    if (tenantId) {
      qb.where('log.tenantId = :tenantId', { tenantId });
    }

    if (targetEmployeeId) {
      // Filter by the resolved employee ID
      if (tenantId) {
        qb.andWhere('emp.id = :empId', { empId: targetEmployeeId });
      } else {
        qb.where('emp.id = :empId', { empId: targetEmployeeId });
      }
    }

    qb.orderBy('log.timestamp', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  // ── Home Data ─────────────────────────────────────────────────────────────
  async getHomeData(userId: string): Promise<any> {
    const employee = await this.employees.findByUserId(userId);
    if (!employee) throw new NotFoundException('Employee not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfWeek = new Date(today);
    const day = firstDayOfWeek.getDay();
    const diff = firstDayOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    firstDayOfWeek.setDate(diff);

    // 1. Last Activity
    const lastLog = await this.repo
      .createQueryBuilder('log')
      .where('log.employee = :empId', { empId: employee.id })
      .orderBy('log.timestamp', 'DESC')
      .getOne();

    let isClockedIn = false;
    let isOnBreak = false;
    let clockedInTime: Date | null = null;
    let forgotToClockOut = false;
    // 'none' | 'late' | 'persistent_late'
    let lateStatus: 'none' | 'late' | 'persistent_late' = 'none';
    let isShiftOver = false;
    let isAbsentToday = false;
    let holidayName: string | null = null;
    let isWeekend = false;
    let isVacation = false;
    let vacationName: string | null = null;
    let noShiftAssigned = false;

    // Check non-working day
    const dayStatus = await this._checkNonWorkingDay(new Date());
    let isNonWorking = dayStatus.isNonWorking;

    if (dayStatus.isNonWorking) {
      if (dayStatus.type === 'weekend') isWeekend = true;
      else if (dayStatus.type === 'holiday') holidayName = dayStatus.name;
      else if (dayStatus.type === 'break' || dayStatus.type === 'vacation') {
        isVacation = true;
        vacationName = dayStatus.name;
      }
    }

    // Check individual approved leave for today
    const dateStr = today.toISOString().split('T')[0];
    const approvedLeaves = await this.leavesService.findApprovedInRange(
      employee.id,
      dateStr,
      dateStr,
    );
    if (approvedLeaves.length > 0) {
      isVacation = true;
      vacationName = `Leave (${approvedLeaves[0].leaveType})`;
      isNonWorking = true;
    }

    // Determine current clock-in status
    if (lastLog) {
      if (lastLog.type === AttendanceType.CLOCK_IN || lastLog.type === AttendanceType.BREAK_OUT) {
        isClockedIn = true;
        clockedInTime = lastLog.timestamp;
      } else if (lastLog.type === AttendanceType.BREAK_IN) {
        isClockedIn = true;
        isOnBreak = true;
        clockedInTime = lastLog.timestamp;
      }
    }

    // 2. Today's logs
    const todayLogs = await this.repo
      .createQueryBuilder('log')
      .where('log.employee = :empId', { empId: employee.id })
      .andWhere('log.timestamp >= :today', { today })
      .orderBy('log.timestamp', 'ASC')
      .getMany();

    const hasClockedInToday = todayLogs.some(l => l.type === AttendanceType.CLOCK_IN);

    // 3. Shift and Hours Calculation
    const fullEmp = await this.employees.findById(employee.id);
    const shift = fullEmp?.shift;

    let todayHours = 0;
    if (todayLogs.length > 0) {
      const clockIn = todayLogs.find(l => l.type === AttendanceType.CLOCK_IN);
      const clockOut = todayLogs.find(l => l.type === AttendanceType.CLOCK_OUT);

      if (clockIn) {
        if (shift) {
          const [sHours, sMins] = shift.startTime.split(':').map(Number);
          const [eHours, eMins] = shift.endTime.split(':').map(Number);
          const shiftStart = new Date(today);
          shiftStart.setHours(sHours, sMins, 0, 0);
          const shiftEnd = new Date(today);
          shiftEnd.setHours(eHours, eMins, 0, 0);

          // Start at max(clockIn, shiftStart)
          const calcStart = clockIn.timestamp > shiftStart ? clockIn.timestamp : shiftStart;
          
          // End at min(clockOut ?? now, shiftEnd)
          // If no clock out, we use 'now' but cap at shiftEnd (covers "forgot to clock out" case)
          const calcEnd = clockOut 
            ? (clockOut.timestamp < shiftEnd ? clockOut.timestamp : shiftEnd)
            : (new Date() > shiftEnd ? shiftEnd : new Date());

          todayHours = Math.max(0, (calcEnd.getTime() - calcStart.getTime()) / 3600000);
        } else {
          // Fallback if no shift is assigned
          if (clockOut) {
            todayHours = (clockOut.timestamp.getTime() - clockIn.timestamp.getTime()) / 3600000;
          } else if (isClockedIn) {
            todayHours = (new Date().getTime() - clockIn.timestamp.getTime()) / 3600000;
          }
        }
      }
    }

    if (shift) {
      const now = new Date();

      const [sHours, sMins] = shift.startTime.split(':').map(Number);
      const [eHours, eMins] = shift.endTime.split(':').map(Number);

      const shiftStart = new Date(today);
      shiftStart.setHours(sHours, sMins + (shift.graceMinutes || 0), 0, 0);

      const shiftEnd = new Date(today);
      shiftEnd.setHours(eHours, eMins, 0, 0);

      // Dynamic window for "forgot to clock out" detection
      const bufferStr = '10';
      const bufferMins = parseInt(bufferStr, 10) || 10;
      const forgotCutoff = new Date(shiftEnd.getTime() + bufferMins * 60 * 1000);

      // Track whether the shift window has ended
      isShiftOver = now > shiftEnd;

      // Late alert: only show while shift is still ongoing and employee never clocked in today.
      // Note: We use the raw shift start (sHours, sMins) for the banner so it appears 
      // immediately when the countdown hits zero, even if the grace period hasn't ended.
      const bannerLateStart = new Date(today);
      bannerLateStart.setHours(sHours, sMins, 0, 0);

      if (!hasClockedInToday && now >= bannerLateStart && now <= shiftEnd && !isNonWorking) {
        const minutesLate = (now.getTime() - bannerLateStart.getTime()) / 60000;
        lateStatus = minutesLate > 180 ? 'persistent_late' : 'late';
      }

      // Absent today: shift is over and employee never clocked in at all
      if (isShiftOver && !hasClockedInToday && !isNonWorking) {
        isAbsentToday = true;
      }

      // Forgot to clock out: employee is still "clocked in" (no CLOCK_OUT today) and 
      // working hours ended more than 10 minutes ago
      if (isClockedIn && hasClockedInToday && now > forgotCutoff) {
        const hasClockOut = todayLogs.some(l => l.type === AttendanceType.CLOCK_OUT);
        if (!hasClockOut) {
          forgotToClockOut = true;
          // "forgot to clock out" overrides the "still clocked in" state for banner priority
          isClockedIn = false;
        }
      }

      // Legacy: clocked in since a previous day (safety net)
      if (isClockedIn && clockedInTime && clockedInTime < today) {
        isClockedIn = false;
      }
    } else {
      noShiftAssigned = true;
      // No shift assigned — reset stale clocked-in state from previous days
      if (isClockedIn && clockedInTime && clockedInTime < today) {
        isClockedIn = false;
      }
    }

    // 3. This Week's Hours
    const weekLogs = await this.repo
      .createQueryBuilder('log')
      .where('log.employee = :empId', { empId: employee.id })
      .andWhere('log.timestamp >= :weekStart', { weekStart: firstDayOfWeek })
      .orderBy('log.timestamp', 'ASC')
      .getMany();

    let weekHours = 0;
    let daysWorkedThisWeek = 0;
    const logsByDay: Record<string, AttendanceLog[]> = {};
    weekLogs.forEach(log => {
      const logDay = log.timestamp.toISOString().substring(0, 10);
      if (!logsByDay[logDay]) logsByDay[logDay] = [];
      logsByDay[logDay].push(log);
    });

    Object.values(logsByDay).forEach(dayLogs => {
      const cIn = dayLogs.find(l => l.type === AttendanceType.CLOCK_IN);
      const cOut = dayLogs.find(l => l.type === AttendanceType.CLOCK_OUT);
      if (cIn) {
        daysWorkedThisWeek++;
        if (shift) {
          const logDate = new Date(cIn.timestamp);
          logDate.setHours(0, 0, 0, 0);

          const [sHours, sMins] = shift.startTime.split(':').map(Number);
          const [eHours, eMins] = shift.endTime.split(':').map(Number);

          const sStart = new Date(logDate);
          sStart.setHours(sHours, sMins, 0, 0);
          const sEnd = new Date(logDate);
          sEnd.setHours(eHours, eMins, 0, 0);

          const calcStart = cIn.timestamp > sStart ? cIn.timestamp : sStart;
          let calcEnd: Date;
          if (cOut) {
            calcEnd = cOut.timestamp < sEnd ? cOut.timestamp : sEnd;
          } else {
            // For the current day, if still clocked in, use min(now, sEnd)
            // For past days, treat as "forgot to clock out" and use sEnd
            const isLogToday = logDate.getTime() === today.getTime();
            if (isLogToday && isClockedIn) {
              calcEnd = new Date() > sEnd ? sEnd : new Date();
            } else {
              calcEnd = sEnd;
            }
          }
          weekHours += Math.max(0, (calcEnd.getTime() - calcStart.getTime()) / 3600000);
        } else if (cOut) {
          weekHours += (cOut.timestamp.getTime() - cIn.timestamp.getTime()) / 3600000;
        }
      }
    });

    // 4. Determine Upcoming Holiday
    const allHolidays = await this.holidays.findAll();
    let upcomingHolidayName: string | null = null;
    let upcomingHolidayDate: string | null = null;
    const nowMs = today.getTime();

    const futureHolidays = allHolidays.map(h => {
      const parts = h.date.split('-');
      let hDate = new Date(h.date);
      if (h.isRecurring && hDate.getTime() < nowMs) {
        hDate.setFullYear(today.getFullYear());
        if (hDate.getTime() < nowMs) {
          hDate.setFullYear(today.getFullYear() + 1);
        }
      }
      return { ...h, parsedDate: hDate };
    })
    .filter(h => h.parsedDate.getTime() > nowMs)
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

    if (futureHolidays.length > 0) {
      upcomingHolidayName = futureHolidays[0].name;
      upcomingHolidayDate = futureHolidays[0].parsedDate.toISOString();
    }

    // 5. Determine Target Hours
    let targetDailyHours = 8;
    if (shift) {
      const [sHours, sMins] = shift.startTime.split(':').map(Number);
      const [eHours, eMins] = shift.endTime.split(':').map(Number);
      targetDailyHours = (eHours + eMins / 60) - (sHours + sMins / 60);
      if (targetDailyHours < 0) targetDailyHours += 24;
    }
    const targetWeeklyHours = targetDailyHours * 5; // Defaulting to 5 days a week

    const fullEmpForBranch = await this.employees.findById(employee.id);
    const branch = fullEmpForBranch?.branch;

    // 6. Determine Next Shift Date
    let nextShiftDateStr: string | null = null;
    if (shift) {
      let tempDate = new Date(today);
      
      const now = new Date();
      const [sHours, sMins] = shift.startTime.split(':').map(Number);
      const shiftStart = new Date(today);
      shiftStart.setHours(sHours, sMins, 0, 0);

      const hasClockOutToday = todayLogs.some(l => l.type === AttendanceType.CLOCK_OUT);
      const isShiftStarted = now >= shiftStart;
      const shouldSkipToday = hasClockOutToday || (isShiftOver && !isClockedIn) || isShiftStarted;
      
      if (shouldSkipToday) {
        tempDate.setDate(tempDate.getDate() + 1); // start checking from tomorrow
      }

      // Fetch approved leaves for the next 60 days
      const limitDate = new Date(tempDate);
      limitDate.setDate(limitDate.getDate() + 60);
      const startLimitStr = tempDate.toISOString().split('T')[0];
      const endLimitStr = limitDate.toISOString().split('T')[0];
      const futureLeaves = await this.leavesService.findApprovedInRange(
        employee.id,
        startLimitStr,
        endLimitStr
      );

      for (let i = 0; i < 60; i++) { // check up to 60 days ahead
        const status = await this._checkNonWorkingDay(tempDate);
        const tempStr = tempDate.toISOString().split('T')[0];
        const isLeave = futureLeaves.some(l => tempStr >= l.startDate && tempStr <= l.endDate);

        if (!status.isNonWorking && !isLeave) {
          nextShiftDateStr = tempDate.toISOString();
          break;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
    }

    return {
      lastActivity: lastLog ? {
        type: lastLog.type,
        timestamp: lastLog.timestamp,
      } : null,
      isClockedIn,
      // Whether the employee had any CLOCK_IN event today (useful for client-side logic)
      hasClockedInToday,
      clockedInTime,
      isOnBreak,
      forgotToClockOut,
      // Backwards-compatible: isLateToday is true for either late variant
      isLateToday: lateStatus !== 'none',
      lateStatus,
      isShiftOver,
      isAbsentToday,
      isWeekend,
      isVacation,
      vacationName,
      noShiftAssigned,
      todayHours: Number(todayHours.toFixed(2)),
      weekHours: Number(weekHours.toFixed(2)),
      daysWorkedThisWeek,
      isHoliday: holidayName !== null,
      holidayName,
      // Used by mobile app to calculate the pre-shift countdown banner
      shiftStartTime: shift ? shift.startTime : null,
      nextShiftStartTime: shift ? shift.startTime : null,
      nextShiftDate: nextShiftDateStr,
      upcomingHolidayName,
      upcomingHolidayDate,
      targetDailyHours: Number(targetDailyHours.toFixed(2)),
      targetWeeklyHours: Number(targetWeeklyHours.toFixed(2)),
      branchLat: branch?.latitude ? Number(branch.latitude) : null,
      branchLng: branch?.longitude ? Number(branch.longitude) : null,
      branchRadius: branch?.allowedRadius ? Number(branch.allowedRadius) : null,
      // Admin override info — shown as a banner on the mobile app
      adminOverride: (() => {
        const overrideLog = todayLogs.find(
          l => l.isAdminOverride && l.type === AttendanceType.CLOCK_IN,
        );
        if (!overrideLog) return null;
        return {
          adminName: overrideLog.adminOverrideName ?? 'An Administrator',
          note: overrideLog.adminNote ?? '',
          timestamp: overrideLog.timestamp,
          type: overrideLog.type,
        };
      })(),
    };
  }

  // ── Live attendance (for dashboard) ──────────────────────────────────────
  async getLive(dateStr?: string): Promise<AttendanceLog[]> {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const tenantId = getCurrentTenantId();
    const qb = this.repo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.employee', 'emp')
      .leftJoinAndSelect('emp.user', 'user')
      .leftJoinAndSelect('log.branch', 'branch')
      .where('log.timestamp >= :startOfDay', { startOfDay })
      .andWhere('log.timestamp <= :endOfDay', { endOfDay });

    if (tenantId) {
      qb.andWhere('log.tenantId = :tenantId', { tenantId });
    }

    return qb.orderBy('log.timestamp', 'DESC').getMany();
  }

  async getDashboardStats(dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const isHistorical = !!dateStr && targetDate.toDateString() !== new Date().toDateString();

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const dayStatus = await this._checkNonWorkingDay(targetDate);
    const evaluationTime = isHistorical ? endOfDay : new Date();

    const dateStrFormatted = startOfDay.toISOString().split('T')[0];
    const approvedLeaves = await this.leavesService.findAllApprovedInRange(dateStrFormatted, dateStrFormatted);

    const tenantId = getCurrentTenantId();
    const qb = this.repo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.employee', 'emp')
      .leftJoinAndSelect('emp.user', 'user')
      .leftJoinAndSelect('emp.branch', 'branch')
      .leftJoinAndSelect('emp.shift', 'shift')
      .where('log.timestamp >= :startOfDay', { startOfDay })
      .andWhere('log.timestamp <= :endOfDay', { endOfDay });

    if (tenantId) {
      qb.andWhere('log.tenantId = :tenantId', { tenantId });
    }

    const logs = await qb.orderBy('log.timestamp', 'ASC').getMany();

    // Group logs by employee
    const employeeLogs: Record<string, AttendanceLog[]> = {};
    logs.forEach(log => {
      if (!employeeLogs[log.employee.id]) {
        employeeLogs[log.employee.id] = [];
      }
      employeeLogs[log.employee.id].push(log);
    });

    const presentEmployees: any[] = [];
    const lateEmployees: any[] = [];
    const earlyOutEmployees: any[] = [];
    const forgotOutEmployees: any[] = [];

    Object.values(employeeLogs).forEach(userLogs => {
      const clockIns = userLogs.filter(l => l.type === AttendanceType.CLOCK_IN);
      
      let empDetails: any = null;
      let firstClockIn: any = null;
      
      if (clockIns.length > 0) {
        firstClockIn = clockIns[0];
        const emp = firstClockIn.employee;
        empDetails = {
          id: emp.id,
          fullName: (emp as any).user?.fullName ?? 'Unknown',
          employeeCode: emp.employeeCode,
          branch: (emp as any).branch?.name ?? null,
          shift: emp.shift ? `${emp.shift.startTime} – ${emp.shift.endTime}` : null,
          clockInTime: firstClockIn.timestamp,
        };

        if (emp?.shift) {
          const [sHours, sMins] = emp.shift.startTime.split(':').map(Number);
          const shiftStart = new Date(startOfDay);
          shiftStart.setHours(sHours, sMins + (emp.shift.graceMinutes || 0), 0, 0);
          
          if (firstClockIn.timestamp > shiftStart && !dayStatus.isNonWorking) {
            lateEmployees.push({
              ...empDetails,
              shiftStart,
              minutesLate: Math.round((firstClockIn.timestamp.getTime() - shiftStart.getTime()) / 60000),
            });
          }
        }
      }

      const clockOuts = userLogs.filter(l => l.type === AttendanceType.CLOCK_OUT);
      let isForgotOut = false;
      if (clockIns.length > 0) {
        const emp = clockIns[0].employee;
        if (emp?.shift) {
          const [eHours, eMins] = emp.shift.endTime.split(':').map(Number);
          const shiftEnd = new Date(startOfDay);
          shiftEnd.setHours(eHours, eMins, 0, 0);
          
          if (clockOuts.length > 0) {
            const lastClockOut = clockOuts[clockOuts.length - 1];
            if (lastClockOut.timestamp < shiftEnd) {
              earlyOutEmployees.push({
                ...empDetails,
                shiftEnd,
                clockOutTime: lastClockOut.timestamp,
                minutesEarly: Math.round((shiftEnd.getTime() - lastClockOut.timestamp.getTime()) / 60000),
              });
            }
          } else {
            const forgotCutoff = new Date(shiftEnd.getTime() + 60 * 60 * 1000);
            if (evaluationTime > forgotCutoff) {
              forgotOutEmployees.push({
                ...empDetails,
                status: 'Clocked In',
              });
              isForgotOut = true;
            }
          }
        }
      }

      // Check their latest status
      if (!isHistorical) {
        const latestLog = userLogs[userLogs.length - 1];
        if ((latestLog.type === AttendanceType.CLOCK_IN || latestLog.type === AttendanceType.BREAK_OUT) && !isForgotOut) {
          if (empDetails) {
            presentEmployees.push({
              ...empDetails,
              status: 'Working',
            });
          }
        }
      } else if (empDetails && !isForgotOut) {
         presentEmployees.push({
            ...empDetails,
            clockOutTime: clockOuts.length > 0 ? clockOuts[clockOuts.length - 1].timestamp : null,
         });
      }
    });

    const totalUniqueAttendance = Object.values(employeeLogs).filter(userLogs => 
      userLogs.some(l => l.type === AttendanceType.CLOCK_IN)
    ).length;
    let currentlyOnSite = presentEmployees.length;

    if (isHistorical) {
      currentlyOnSite = totalUniqueAttendance;
    }

    const absentEmployees: any[] = [];
    const onLeaveEmployees: any[] = [];

    if (!dayStatus.isNonWorking) {
      const allEmployees = await this.employees.findAllUnpaginated();
      allEmployees.forEach(emp => {
        if (
          (emp.status !== 'active' && emp.status !== 'suspended') ||
          !emp.shift ||
          // Exclude employees who weren't registered yet on the queried date.
          // Use hireDate as the registration date (matching the attendance report logic),
          // falling back to createdAt if hireDate is not set.
          (() => {
            const regDate = emp.hireDate ? new Date(emp.hireDate) : new Date(emp.createdAt);
            regDate.setHours(0, 0, 0, 0);
            return regDate > startOfDay;
          })() ||
          (employeeLogs[emp.id] && employeeLogs[emp.id].some(l => l.type === AttendanceType.CLOCK_IN))
        ) return;

        const [sHours, sMins] = emp.shift.startTime.split(':').map(Number);
        const shiftStart = new Date(startOfDay);
        shiftStart.setHours(sHours, sMins + (emp.shift.graceMinutes || 0), 0, 0);

        if (evaluationTime > shiftStart) {
          const leaveRecord = approvedLeaves.find(l => l.employee?.id === emp.id);
          
          const empData = {
            id: emp.id,
            fullName: (emp as any).user?.fullName ?? 'Unknown',
            employeeCode: emp.employeeCode,
            branch: (emp as any).branch?.name ?? null,
            shift: `${emp.shift.startTime} – ${emp.shift.endTime}`,
            isSuspended: emp.status === 'suspended',
          };

          if (leaveRecord) {
            onLeaveEmployees.push({
              ...empData,
              leaveType: leaveRecord.leaveType,
            });
          } else {
            absentEmployees.push(empData);
          }
        }
      });
    }

    return {
      totalUniqueAttendance,
      currentlyOnSite,
      lateArrivals: lateEmployees.length,
      absentToday: absentEmployees.length,
      onLeaveToday: onLeaveEmployees.length,
      earlyOuts: earlyOutEmployees.length,
      forgotClockOut: forgotOutEmployees.length,
      presentEmployees,
      lateEmployees,
      absentEmployees,
      onLeaveEmployees,
      earlyOutEmployees,
      forgotOutEmployees,
      dayStatus,
    };
  }

  // ── Haversine distance (meters) ───────────────────────────────────────────
  private _haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6_371_000;
    const dLat = this._rad(lat2 - lat1);
    const dLon = this._rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this._rad(lat1)) * Math.cos(this._rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private _rad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  // ── Non-Working Day Checker ───────────────────────────────────────────────
  private async _checkNonWorkingDay(date: Date): Promise<{ isNonWorking: boolean; type: string | null; name: string | null }> {
    // 1. Weekend
    const currentDay = date.getDay();
    if (currentDay === 0 || currentDay === 6) {
      return { isNonWorking: true, type: 'weekend', name: 'Weekend' };
    }

    // 2. Public Holiday
    const holiday = await this.holidays.getHolidayForDate(date);
    if (holiday) {
      return { isNonWorking: true, type: 'holiday', name: holiday.name };
    }

    // 3. Academic Calendar Break
    const breakName = await this.academicCalendar.isBreak(date);
    if (breakName) {
      return { isNonWorking: true, type: 'break', name: breakName };
    }

    // 4. Vacation (Outside any term)
    // Only enforce vacation if the school actually has term records defined in their calendar.
    // If they have no terms, we assume the school is open by default.
    const allTerms = await this.academicCalendar.findAllTerms();
    if (allTerms && allTerms.length > 0) {
      const term = await this.academicCalendar.getTermForDate(date);
      if (!term) {
        return { isNonWorking: true, type: 'vacation', name: 'Vacation' };
      }
    }

    return { isNonWorking: false, type: null, name: null };
  }

  // ── Shift Hour Checker ──────────────────────────────────────────────────
  private _isWithinShiftHours(date: Date, shift: any): boolean {
    if (!shift) return true;

    const [sHours, sMins] = shift.startTime.split(':').map(Number);
    const [eHours, eMins] = shift.endTime.split(':').map(Number);

    const shiftStart = new Date(date);
    shiftStart.setHours(sHours, sMins, 0, 0);

    const shiftEnd = new Date(date);
    shiftEnd.setHours(eHours, eMins, 0, 0);

    // Handle overnight shifts (e.g., 22:00 to 06:00)
    if (shiftEnd < shiftStart) {
      if (date.getHours() < eHours || (date.getHours() === eHours && date.getMinutes() < eMins)) {
        // We are in the post-midnight part of the shift; shift started yesterday.
        shiftStart.setDate(shiftStart.getDate() - 1);
      } else {
        // We are in the pre-midnight part of the shift; shift ends tomorrow.
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }
    }

    // Expand the window to start 2 hours before the actual shift time
    const windowStart = new Date(shiftStart);
    windowStart.setHours(windowStart.getHours() - 2);

    return date >= windowStart && date <= shiftEnd;
  }
}
