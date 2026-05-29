import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveRequest } from './leave-request.entity';
import { Employee } from '../employees/employee.entity';
import { User } from '../users/user.entity';
import { LeaveStatus, UserRole } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { tenantLocalStorage } from '../../common/tenant/tenant.context';
import { getCurrentTenantId } from '../../common/tenant/tenant-filter.helper';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRepo: Repository<LeaveRequest>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Employee Actions ──────────────────────────────────────────────────────

  /** Apply for leave. Any employee can do this for themselves. */
  async requestLeave(
    userId: string,
    data: {
      leaveType: string;
      startDate: string;
      endDate: string;
      reason?: string;
    },
  ): Promise<LeaveRequest> {
    const employee = await this.employeeRepo
      .createQueryBuilder('emp')
      .leftJoinAndSelect('emp.user', 'user')
      .where('user.id = :userId', { userId })
      .getOne();
    if (!employee) throw new NotFoundException('Employee profile not found.');

    // ── Guard 1: Date Sanity Checks ───────────────────────────────────────────
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        'Invalid date format. Please use YYYY-MM-DD.',
      );
    }

    if (end < start) {
      throw new BadRequestException(
        'Invalid date range: the end date cannot be before the start date.',
      );
    }

    // Allow SICK leave retroactively (e.g., employee was already home sick)
    const isSick = data.leaveType?.toUpperCase() === 'SICK';
    if (!isSick && end < today) {
      throw new BadRequestException(
        'Invalid date range: leave requests cannot be submitted for dates entirely in the past.',
      );
    }

    // ── Guard 2: Overlap Prevention ───────────────────────────────────────────
    const conflicting = await this.leaveRepo
      .createQueryBuilder('leave')
      .where('leave.employee_id = :empId', { empId: employee.id })
      .andWhere('leave.status IN (:...statuses)', {
        statuses: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      })
      .andWhere('leave.start_date <= :end', { end: data.endDate })
      .andWhere('leave.end_date >= :start', { start: data.startDate })
      .getOne();

    if (conflicting) {
      throw new BadRequestException(
        `You already have an overlapping ${conflicting.status.toLowerCase()} ${conflicting.leaveType} leave ` +
          `from ${conflicting.startDate} to ${conflicting.endDate}. ` +
          `Please cancel it first or choose different dates.`,
      );
    }

    const leave = this.leaveRepo.create({
      employee,
      leaveType: data.leaveType as any,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      status: LeaveStatus.PENDING,
    });
    return this.leaveRepo.save(leave);
  }

  /** Cancel a pending leave request (only by the owner). */
  async cancelLeave(leaveId: string, userId: string): Promise<LeaveRequest> {
    const leave = await this._findById(leaveId);
    if (leave.employee.user.id !== userId) {
      throw new ForbiddenException("You cannot cancel someone else's leave.");
    }
    if (leave.status !== LeaveStatus.PENDING) {
      throw new ForbiddenException('Only PENDING leaves can be cancelled.');
    }
    leave.status = LeaveStatus.CANCELLED;
    return this.leaveRepo.save(leave);
  }

  /** Get leave requests for the currently logged-in employee. */
  async findMyLeaves(userId: string): Promise<LeaveRequest[]> {
    return this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.employee', 'emp')
      .leftJoinAndSelect('emp.user', 'user')
      .leftJoinAndSelect('leave.reviewedBy', 'reviewer')
      .where('user.id = :userId', { userId })
      .orderBy('leave.createdAt', 'DESC')
      .getMany();
  }

  // ── Admin Actions ─────────────────────────────────────────────────────────

  /** Get all leave requests (admin/HR). */
  async findAll(
    status?: LeaveStatus,
    page: number = 1,
    limit: number = 15,
    search?: string,
    year?: string,
  ): Promise<{ data: LeaveRequest[]; meta: any }> {
    const tenantId = tenantLocalStorage.getStore();
    const qb = this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.employee', 'emp')
      .leftJoinAndSelect('emp.user', 'user')
      .leftJoinAndSelect('emp.branch', 'branch')
      .leftJoinAndSelect('emp.department', 'department')
      .leftJoinAndSelect('leave.reviewedBy', 'reviewer')
      .orderBy('leave.createdAt', 'DESC');

    if (tenantId) {
      qb.andWhere('leave.tenantId = :tenantId', { tenantId });
    }

    if (status && status !== ('ALL' as any)) {
      qb.andWhere('leave.status = :status', { status });
    }

    if (year && year !== 'ALL') {
      qb.andWhere('leave.startDate LIKE :year', { year: `${year}%` });
    }

    if (search) {
      qb.andWhere(
        '(user.fullName ILIKE :search OR emp.employeeCode ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const totalItems = await qb.getCount();
    qb.skip((page - 1) * limit).take(limit);

    const data = await qb.getMany();

    return {
      data,
      meta: {
        totalItems,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit) || 1,
        currentPage: Number(page),
      },
    };
  }

  /** Get all leaves for a specific employee (admin view). */
  async findByEmployee(employeeId: string): Promise<LeaveRequest[]> {
    const tenantId = getCurrentTenantId();
    const where: any = { employee: { id: employeeId } };
    if (tenantId) where.tenantId = tenantId;

    return this.leaveRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /** Get leaves that overlap with a date range (used by report service). */
  async findApprovedInRange(
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<LeaveRequest[]> {
    const tenantId = getCurrentTenantId();
    const qb = this.leaveRepo
      .createQueryBuilder('leave')
      .where('leave.employee_id = :employeeId', { employeeId })
      .andWhere('leave.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('leave.start_date <= :endDate', { endDate })
      .andWhere('leave.end_date >= :startDate', { startDate });

    if (tenantId) {
      qb.andWhere('leave.tenantId = :tenantId', { tenantId });
    }

    return qb.getMany();
  }

  /** Get all approved leaves for all employees that overlap with a date range. */
  async findAllApprovedInRange(
    startDate: string,
    endDate: string,
  ): Promise<LeaveRequest[]> {
    const tenantId = getCurrentTenantId();
    const qb = this.leaveRepo
      .createQueryBuilder('leave')
      .leftJoinAndSelect('leave.employee', 'employee')
      .where('leave.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('leave.start_date <= :endDate', { endDate })
      .andWhere('leave.end_date >= :startDate', { startDate });

    if (tenantId) {
      qb.andWhere('leave.tenantId = :tenantId', { tenantId });
    }

    return qb.getMany();
  }

  /** Approve or reject a leave request. */
  async reviewLeave(
    leaveId: string,
    reviewer: User,
    decision: {
      status: LeaveStatus.APPROVED | LeaveStatus.REJECTED;
      reviewNote?: string;
    },
  ): Promise<LeaveRequest> {
    const leave = await this._findById(leaveId);

    if (leave.status !== LeaveStatus.PENDING) {
      throw new ForbiddenException(
        'Only PENDING leave requests can be reviewed.',
      );
    }

    const oldStatus = leave.status;
    leave.status = decision.status;
    leave.reviewedBy = reviewer;
    leave.reviewNote = decision.reviewNote ?? null;

    const saved = await this.leaveRepo.save(leave);

    await this.auditService.log({
      user: reviewer,
      action: `LEAVE_${decision.status}`,
      module: 'LEAVES',
      targetId: leaveId,
      oldValues: { status: oldStatus },
      newValues: { status: decision.status, reviewNote: decision.reviewNote },
    });

    // Send a silent sync to the employee's phone to refresh their dashboard instantly
    if (leave.employee?.user?.fcmToken) {
      await this.notificationsService.sendSilentSyncToToken(
        leave.employee.user.fcmToken,
        'refresh_dashboard',
      );

      // Also send a visible push notification to inform them of the decision
      await this.notificationsService.sendPushToToken(
        leave.employee.user.fcmToken,
        'Leave Request Update',
        `Your leave request has been ${decision.status.toLowerCase()}.`,
      );
    }

    return saved;
  }

  /** Apply for leave on behalf of an employee (admin action). */
  async createLeaveOnBehalfOf(
    reviewer: User,
    employeeId: string,
    data: {
      leaveType: string;
      startDate: string;
      endDate: string;
      reason?: string;
      status?: LeaveStatus;
    },
  ): Promise<LeaveRequest> {
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId },
      relations: ['user'],
    });
    if (!employee) throw new NotFoundException('Employee profile not found.');

    // ── Guard 1: Date Sanity Checks ───────────────────────────────────────────
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        'Invalid date format. Please use YYYY-MM-DD.',
      );
    }

    if (end < start) {
      throw new BadRequestException(
        'Invalid date range: the end date cannot be before the start date.',
      );
    }

    // ── Guard 2: Overlap Prevention ───────────────────────────────────────────
    const conflicting = await this.leaveRepo
      .createQueryBuilder('leave')
      .where('leave.employee_id = :empId', { empId: employee.id })
      .andWhere('leave.status IN (:...statuses)', {
        statuses: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      })
      .andWhere('leave.start_date <= :end', { end: data.endDate })
      .andWhere('leave.end_date >= :start', { start: data.startDate })
      .getOne();

    if (conflicting) {
      throw new BadRequestException(
        `This employee already has an overlapping ${conflicting.status.toLowerCase()} ${conflicting.leaveType} leave ` +
          `from ${conflicting.startDate} to ${conflicting.endDate}.`,
      );
    }

    const targetStatus = data.status || LeaveStatus.APPROVED;

    const leave = this.leaveRepo.create({
      employee,
      leaveType: data.leaveType as any,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      status: targetStatus,
    });

    if (targetStatus !== LeaveStatus.PENDING) {
      leave.reviewedBy = reviewer;
      leave.reviewNote = 'Created and approved directly by administrator.';
    }

    const saved = await this.leaveRepo.save(leave);

    // Audit log
    await this.auditService.log({
      user: reviewer,
      action: `LEAVE_CREATE_ON_BEHALF`,
      module: 'LEAVES',
      targetId: saved.id,
      newValues: {
        employeeId: employee.id,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        status: leave.status,
      },
    });

    // Notify employee via push/silent sync
    if (employee.user?.fcmToken) {
      await this.notificationsService.sendSilentSyncToToken(
        employee.user.fcmToken,
        'refresh_dashboard',
      );
      await this.notificationsService.sendPushToToken(
        employee.user.fcmToken,
        'New Leave Registered',
        `A ${leave.leaveType.toLowerCase()} leave request has been submitted on your behalf and is ${leave.status.toLowerCase()}.`,
      );
    }

    return saved;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async _findById(id: string): Promise<LeaveRequest> {
    const tenantId = getCurrentTenantId();
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

    const leave = await this.leaveRepo.findOne({
      where,
      relations: ['employee', 'employee.user', 'reviewedBy'],
    });
    if (!leave) throw new NotFoundException('Leave request not found.');
    return leave;
  }
}
