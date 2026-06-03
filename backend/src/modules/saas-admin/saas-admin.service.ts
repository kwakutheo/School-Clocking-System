import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Connection, ILike, Not, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { Employee } from '../employees/employee.entity';
import { Branch } from '../branches/branch.entity';
import { Department } from '../departments/department.entity';
import { Shift } from '../shifts/shift.entity';
import { UserRole, AttendanceType, EmployeeStatus } from '../../common/enums';
import { SystemBulletin, BulletinType } from './system-bulletin.entity';
import { AttendanceLog } from '../attendance/attendance-log.entity';
import { AttendanceDailySummary } from '../attendance/attendance-daily-summary.entity';
import { AcademicTerm } from '../academic-calendar/term.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SaasAdminService implements OnModuleInit {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(SystemBulletin)
    private readonly bulletinRepo: Repository<SystemBulletin>,
    private readonly connection: Connection,
    private readonly auditService: AuditService,
  ) {}

  private readonly logger = new Logger(SaasAdminService.name);
  private employeeRankingsCache = new Map<
    string,
    { timestamp: number; data: any[] }
  >();
  private employeeRankingsInFlight = new Map<string, Promise<any[]>>();
  private readonly CACHE_TTL = 1000 * 60 * 5; // 5 minutes

  /**
   * Clears the employee rankings in-memory cache.
   * Called by AttendanceService after every successful clocking so the rankings
   * widget reflects the new data on the next poll instead of waiting up to 5 min.
   */
  clearEmployeeRankingsCache(): void {
    this.employeeRankingsCache.clear();
    this.employeeRankingsInFlight.clear();
  }

  private toPublicAdmin(user: User) {
    const { passwordHash: _, resetPin: __, fcmToken: ___, ...safe } = user;
    return {
      ...safe,
      accountScope: user.tenantId === null ? 'global' : 'tenant',
    };
  }

  private ensureGlobalAdminRole(role: UserRole) {
    if (
      ![UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.SUPERVISOR].includes(
        role,
      )
    ) {
      throw new BadRequestException(
        'Global admin role must be super_admin, hr_admin, or supervisor.',
      );
    }
  }

  async findGlobalAdmins(showArchived: boolean = false): Promise<any[]> {
    const users = await this.userRepo.find({
      where: [
        { tenantId: IsNull(), role: UserRole.SUPER_ADMIN },
        { tenantId: IsNull(), role: UserRole.HR_ADMIN },
        { tenantId: IsNull(), role: UserRole.SUPERVISOR },
      ],
      order: { createdAt: 'DESC' },
      withDeleted: showArchived,
    });

    return users.map((user) => this.toPublicAdmin(user));
  }

  async createGlobalAdmin(
    data: {
      fullName: string;
      username: string;
      password: string;
      role: UserRole;
      email?: string;
      phone?: string;
    },
    actor: User,
  ): Promise<any> {
    const role = data.role ?? UserRole.SUPERVISOR;
    this.ensureGlobalAdminRole(role);

    if (!data.fullName?.trim() || !data.username?.trim() || !data.password) {
      throw new BadRequestException(
        'Full name, username and password are required.',
      );
    }
    if (data.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    const username = data.username.trim();
    const existingUsername = await this.userRepo.findOne({
      where: { username },
    });
    if (existingUsername) {
      throw new BadRequestException('Username already in use.');
    }

    if (data.email) {
      const existingEmail = await this.userRepo.findOne({
        where: { email: data.email.trim().toLowerCase() },
      });
      if (existingEmail) {
        throw new BadRequestException('Email already in use.');
      }
    }

    if (data.phone) {
      const existingPhone = await this.userRepo.findOne({
        where: { phone: data.phone.trim() },
      });
      if (existingPhone) {
        throw new BadRequestException('Phone number already in use.');
      }
    }

    const user = this.userRepo.create({
      fullName: data.fullName.trim(),
      username,
      email: data.email?.trim().toLowerCase() || null,
      phone: data.phone?.trim() || null,
      passwordHash: await bcrypt.hash(data.password, 12),
      role,
      tenantId: null,
      isActive: true,
    });

    const saved = await this.userRepo.save(user);
    await this.auditService.log({
      user: actor,
      action: 'CREATE_GLOBAL_ADMIN',
      module: 'SAAS_ADMIN',
      targetId: saved.id,
      newValues: {
        fullName: saved.fullName,
        username: saved.username,
        email: saved.email,
        role: saved.role,
        accountScope: 'global',
      },
    });

    return this.toPublicAdmin(saved);
  }

  async updateGlobalAdmin(
    id: string,
    data: {
      fullName?: string;
      username?: string;
      email?: string | null;
      phone?: string | null;
      role?: UserRole;
      isActive?: boolean;
      password?: string;
    },
    actor: User,
  ): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { id, tenantId: IsNull() },
    });
    if (!user) {
      throw new NotFoundException('Global admin account not found.');
    }

    if (
      user.id === actor.id &&
      (data.isActive === false || (data.role && data.role !== user.role))
    ) {
      throw new BadRequestException(
        'You cannot deactivate or change the role of your own global admin account.',
      );
    }

    if (data.role) {
      this.ensureGlobalAdminRole(data.role);
    }

    const oldValues = {
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
    };

    if (data.username && data.username.trim() !== user.username) {
      const existing = await this.userRepo.findOne({
        where: { username: data.username.trim() },
      });
      if (existing && existing.id !== user.id) {
        throw new BadRequestException('Username already in use.');
      }
      user.username = data.username.trim();
    }

    if (data.email !== undefined) {
      const email = data.email?.trim().toLowerCase() || null;
      if (email && email !== user.email) {
        const existing = await this.userRepo.findOne({ where: { email } });
        if (existing && existing.id !== user.id) {
          throw new BadRequestException('Email already in use.');
        }
      }
      user.email = email;
    }

    if (data.phone !== undefined) {
      const phone = data.phone?.trim() || null;
      if (phone && phone !== user.phone) {
        const existing = await this.userRepo.findOne({ where: { phone } });
        if (existing && existing.id !== user.id) {
          throw new BadRequestException('Phone number already in use.');
        }
      }
      user.phone = phone;
    }

    if (data.fullName) user.fullName = data.fullName.trim();
    if (data.role) user.role = data.role;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    if (data.password) {
      if (data.password.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters.');
      }
      user.passwordHash = await bcrypt.hash(data.password, 12);
      user.requiresPasswordChange = false;
      user.resetPin = null;
    }

    const saved = await this.userRepo.save(user);
    await this.auditService.log({
      user: actor,
      action: 'UPDATE_GLOBAL_ADMIN',
      module: 'SAAS_ADMIN',
      targetId: saved.id,
      oldValues,
      newValues: {
        fullName: saved.fullName,
        username: saved.username,
        email: saved.email,
        phone: saved.phone,
        role: saved.role,
        isActive: saved.isActive,
        passwordChanged: !!data.password,
      },
    });

    return this.toPublicAdmin(saved);
  }

  async deleteGlobalAdmin(id: string, actor: User): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id, tenantId: IsNull() },
    });
    if (!user) {
      throw new NotFoundException('Global admin account not found.');
    }
    if (user.id === actor.id) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    await this.userRepo.softDelete(user.id);

    await this.auditService.log({
      user: actor,
      action: 'DELETE_GLOBAL_ADMIN',
      module: 'SAAS_ADMIN',
      targetId: id,
    });
  }

  async restoreGlobalAdmin(id: string, actor: User): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id, tenantId: IsNull() },
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundException('Global admin account not found.');
    }

    await this.userRepo.restore(user.id);

    await this.auditService.log({
      user: actor,
      action: 'RESTORE_GLOBAL_ADMIN',
      module: 'SAAS_ADMIN',
      targetId: id,
    });
  }

  async triggerPasswordReset(id: string, actor: User): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { id, tenantId: IsNull() },
    });
    if (!user) {
      throw new NotFoundException('Global admin account not found.');
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    await this.userRepo.update(user.id, {
      resetPin: pin,
      requiresPasswordChange: true,
    });

    await this.auditService.log({
      user: actor,
      action: 'TRIGGER_PASSWORD_RESET',
      module: 'SAAS_ADMIN',
      targetId: id,
    });

    // Simulate email dispatch
    console.warn('\n========================================================');
    console.warn(`Simulated Email Dispatch: Password Reset`);
    console.warn(`To: ${user.email || user.username}`);
    console.warn(`PIN: ${pin}`);
    console.warn('========================================================\n');

    return { success: true, message: 'Password reset link simulated and logged to console.' };
  }

  private toDateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  // Normalization helpers (mirror frontend rules)
  private normalizeSlugValue(v?: string) {
    return (v || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private normalizeInitialsValue(v?: string) {
    return (v || '')
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
  }

  async onModuleInit() {
    try {
      await this.connection.query(`
        CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_type_timestamp
        ON attendance_logs(employee_id, type, timestamp);
      `);
      await this.connection.query(`
        CREATE INDEX IF NOT EXISTS idx_attendance_logs_type_timestamp
        ON attendance_logs(type, timestamp);
      `);
    } catch (err) {
      this.logger.warn(`Failed to ensure SaaS ranking indexes: ${err}`);
    }
  }

  private countWeekdays(
    start: Date,
    end: Date,
    holidays: Set<string> = new Set(),
  ): number {
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        // Not Sunday (0) or Saturday (6)
        const dateStr = cur.toISOString().split('T')[0];
        if (!holidays.has(dateStr)) {
          count++;
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count || 1; // Prevent division by zero
  }

  private async getTenantRanges(
    tenants: Tenant[],
    timeframe: string,
  ): Promise<Map<string, { start: Date; end: Date; weekdays: number }>> {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const tenantRangesMap = new Map<
      string,
      { start: Date; end: Date; weekdays: number }
    >();

    const defaultStart = new Date();
    defaultStart.setHours(0, 0, 0, 0);
    const defaultEnd = new Date(endOfToday);

    if (timeframe === '7d') {
      defaultStart.setDate(defaultStart.getDate() - 6);
    } else if (timeframe === '30d') {
      defaultStart.setDate(defaultStart.getDate() - 29);
    } else if (timeframe === 'term') {
      defaultStart.setDate(defaultStart.getDate() - 89);
    }

    const defaultWeekdays = this.countWeekdays(defaultStart, defaultEnd);

    if (timeframe !== 'term') {
      for (const tenant of tenants) {
        tenantRangesMap.set(tenant.id, {
          start: defaultStart,
          end: defaultEnd,
          weekdays: defaultWeekdays,
        });
      }
    } else {
      const activeTerms = await this.connection
        .getRepository(AcademicTerm)
        .find({
          where: { isActive: true },
        });

      const now = new Date();
      activeTerms.sort((a, b) => {
        const aStart = new Date(a.startDate);
        const bStart = new Date(b.startDate);
        const aEnd = new Date(a.endDate);
        const bEnd = new Date(b.endDate);
        aEnd.setHours(23, 59, 59, 999);
        bEnd.setHours(23, 59, 59, 999);

        // Currently-active terms go FIRST (return -1 keeps 'a' before 'b')
        const aCurrent = aStart <= now && aEnd >= now;
        const bCurrent = bStart <= now && bEnd >= now;
        if (aCurrent && !bCurrent) return -1;
        if (!aCurrent && bCurrent) return 1;

        // Among past terms, most-recently-started goes first
        const aPast = aStart <= now;
        const bPast = bStart <= now;
        if (aPast && !bPast) return -1;
        if (!aPast && bPast) return 1;

        if (aPast && bPast) return bStart.getTime() - aStart.getTime(); // most recent first
        return aStart.getTime() - bStart.getTime(); // future: earliest start first
      });

      const activeTermsMap = new Map(activeTerms.map((t) => [t.tenantId, t]));

      for (const tenant of tenants) {
        const term = activeTermsMap.get(tenant.id);
        if (term) {
          const tStart = new Date(term.startDate);
          tStart.setHours(0, 0, 0, 0);

          let tEnd = new Date(term.endDate);
          tEnd.setHours(23, 59, 59, 999);

          if (tEnd > endOfToday) {
            tEnd = new Date(endOfToday);
          }
          if (tStart > endOfToday) {
            tenantRangesMap.set(tenant.id, {
              start: endOfToday,
              end: endOfToday,
              weekdays: 1,
            });
          } else {
            tenantRangesMap.set(tenant.id, {
              start: tStart,
              end: tEnd,
              weekdays: this.countWeekdays(tStart, tEnd),
            });
          }
        } else {
          const fallbackStart = new Date();
          fallbackStart.setDate(fallbackStart.getDate() - 89);
          fallbackStart.setHours(0, 0, 0, 0);
          tenantRangesMap.set(tenant.id, {
            start: fallbackStart,
            end: defaultEnd,
            weekdays: this.countWeekdays(fallbackStart, defaultEnd),
          });
        }
      }
    }
    return tenantRangesMap;
  }

  /** Get all schools with their dynamic usage metrics (employees count, branches count, shifts count, etc.). */
  async findAllTenants(
    timeframe: string = 'today',
    search?: string,
    limit?: number,
    offset?: number,
    sort?: string,
    cohort?: string,
  ): Promise<{ results: any[]; total: number }> {
    let tenants: Tenant[];
    if (search && search.trim() !== '') {
      const cleanSearch = search.trim();
      tenants = await this.tenantRepo.find({
        where: [
          { name: ILike(`%${cleanSearch}%`) },
          { slug: ILike(`%${cleanSearch}%`) },
        ],
        order: { createdAt: 'DESC' },
      });
    } else {
      tenants = await this.tenantRepo.find({ order: { createdAt: 'DESC' } });
    }
    if (tenants.length === 0) return { results: [], total: 0 };

    // 1. Fetch non-inactive employees count grouped by tenant.
    //    INACTIVE employees have resigned/been fired and must not appear in
    //    SaaS headcount metrics.  SUSPENDED employees are still on payroll.
    const employeeStats = await this.employeeRepo
      .createQueryBuilder('e')
      .select('e.tenantId', 'tenantId')
      .addSelect('COUNT(*)', 'count')
      .where('e.status != :inactive', { inactive: EmployeeStatus.INACTIVE })
      .groupBy('e.tenantId')
      .getRawMany();

    // 2. Fetch total branches count grouped by tenant in a single query
    const branchStats = await this.branchRepo
      .createQueryBuilder('b')
      .select('b.tenantId', 'tenantId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('b.tenantId')
      .getRawMany();

    // 3. Fetch total departments count grouped by tenant in a single query
    const departmentStats = await this.departmentRepo
      .createQueryBuilder('d')
      .select('d.tenantId', 'tenantId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('d.tenantId')
      .getRawMany();

    // 4. Fetch total shifts count grouped by tenant in a single query
    const shiftStats = await this.shiftRepo
      .createQueryBuilder('s')
      .select('s.tenantId', 'tenantId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.tenantId')
      .getRawMany();

    // Get tenant timeframe ranges
    const tenantRangesMap = await this.getTenantRanges(tenants, timeframe);

    // Fetch check-ins count based on selected timeframe
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    let checkinStats: any[] = [];
    if (timeframe !== 'term') {
      const firstTenantRange = tenantRangesMap.get(tenants[0].id) || {
        start: new Date(),
        end: endOfToday,
      };
      const defaultStart = firstTenantRange.start;
      const defaultEnd = firstTenantRange.end;
      const qb = this.connection
        .getRepository(AttendanceLog)
        .createQueryBuilder('log')
        .select('log.tenantId', 'tenantId')
        .where('log.timestamp BETWEEN :start AND :end', {
          start: defaultStart,
          end: defaultEnd,
        })
        .andWhere('log.type = :type', { type: AttendanceType.CLOCK_IN });

      if (timeframe === 'today') {
        qb.addSelect('COUNT(DISTINCT log.employee_id)', 'count');
      } else {
        qb.addSelect(
          "COUNT(DISTINCT CONCAT(log.employee_id, '_', DATE_TRUNC('day', log.timestamp)))",
          'count',
        ).andWhere('EXTRACT(ISODOW FROM log.timestamp) IN (1, 2, 3, 4, 5)');
      }
      checkinStats = await qb.groupBy('log.tenantId').getRawMany();
    } else {
      const promises = tenants.map(async (tenant) => {
        const range = tenantRangesMap.get(tenant.id);
        if (!range) return { tenantId: tenant.id, count: 0 };

        const result = await this.connection
          .getRepository(AttendanceLog)
          .createQueryBuilder('log')
          .select('log.tenantId', 'tenantId')
          .addSelect(
            "COUNT(DISTINCT CONCAT(log.employee_id, '_', DATE_TRUNC('day', log.timestamp)))",
            'count',
          )
          .where('log.tenantId = :tenantId', { tenantId: tenant.id })
          .andWhere('log.timestamp BETWEEN :start AND :end', {
            start: range.start,
            end: range.end,
          })
          .andWhere('log.type = :type', { type: AttendanceType.CLOCK_IN })
          .andWhere('EXTRACT(ISODOW FROM log.timestamp) IN (1, 2, 3, 4, 5)')
          .groupBy('log.tenantId')
          .getRawOne();

        return {
          tenantId: tenant.id,
          count: result ? Number(result.count) : 0,
        };
      });
      checkinStats = await Promise.all(promises);
    }

    // 6. Fetch weekday distinct check-ins count over the last 30 days grouped by tenant
    const startOf30DaysAgo = new Date();
    startOf30DaysAgo.setDate(startOf30DaysAgo.getDate() - 30);
    startOf30DaysAgo.setHours(0, 0, 0, 0);

    const weekdays30Count = this.countWeekdays(startOf30DaysAgo, endOfToday);

    const checkin30Stats = await this.connection
      .getRepository(AttendanceLog)
      .createQueryBuilder('log')
      .select('log.tenantId', 'tenantId')
      .addSelect(
        "COUNT(DISTINCT CONCAT(log.employee_id, '_', DATE_TRUNC('day', log.timestamp)))",
        'count',
      )
      .where('log.timestamp BETWEEN :start AND :end', {
        start: startOf30DaysAgo,
        end: endOfToday,
      })
      .andWhere('log.type = :type', { type: AttendanceType.CLOCK_IN })
      .andWhere('EXTRACT(ISODOW FROM log.timestamp) IN (1, 2, 3, 4, 5)')
      .groupBy('log.tenantId')
      .getRawMany();

    // Convert result arrays into fast key-value maps
    const employeeMap = new Map(
      employeeStats.map((s) => [s.tenantId, Number(s.count)]),
    );
    const branchMap = new Map(
      branchStats.map((s) => [s.tenantId, Number(s.count)]),
    );
    const departmentMap = new Map(
      departmentStats.map((s) => [s.tenantId, Number(s.count)]),
    );
    const shiftMap = new Map(
      shiftStats.map((s) => [s.tenantId, Number(s.count)]),
    );
    const checkinMap = new Map(
      checkinStats.map((s) => [s.tenantId, Number(s.count)]),
    );
    const checkin30Map = new Map(
      checkin30Stats.map((s) => [s.tenantId, Number(s.count)]),
    );

    // Compute bounding date range across all tenant ranges (term mode can vary per tenant)
    const allRangeValues = Array.from(tenantRangesMap.values());
    const boundingStart =
      allRangeValues.length > 0
        ? allRangeValues.reduce(
            (min, r) => (r.start < min ? r.start : min),
            allRangeValues[0].start,
          )
        : new Date();
    const boundingEnd =
      allRangeValues.length > 0
        ? allRangeValues.reduce(
            (max, r) => (r.end > max ? r.end : max),
            allRangeValues[0].end,
          )
        : new Date();

    // Fetch precise expected counts from the pre-computed AttendanceDailySummary
    // Scoped to the tenants actually in this request to prevent cross-tenant leakage
    const tenantIds = tenants.map((t) => t.id);
    const dailySummaries = await this.connection
      .getRepository(AttendanceDailySummary)
      .createQueryBuilder('s')
      .where('s.tenant_id IN (:...tenantIds)', { tenantIds })
      .andWhere('s.date >= :start AND s.date <= :end', {
        start: this.toDateStr(boundingStart),
        end: this.toDateStr(boundingEnd),
      })
      .getMany();

    const expectedMap = new Map<string, number>();
    for (const summary of dailySummaries) {
      const range = tenantRangesMap.get(summary.tenantId);
      if (!range) continue;
      if (
        summary.date >= this.toDateStr(range.start) &&
        summary.date <= this.toDateStr(range.end)
      ) {
        const current = expectedMap.get(summary.tenantId) || 0;
        expectedMap.set(summary.tenantId, current + summary.expectedCount);
      }
    }

    const summaries30 = await this.connection
      .getRepository(AttendanceDailySummary)
      .createQueryBuilder('s')
      .where('s.tenant_id IN (:...tenantIds)', { tenantIds })
      .andWhere('s.date >= :start AND s.date <= :end', {
        start: this.toDateStr(startOf30DaysAgo),
        end: this.toDateStr(endOfToday),
      })
      .getMany();

    const expected30Map = new Map<string, number>();
    for (const s of summaries30) {
      const current = expected30Map.get(s.tenantId) || 0;
      expected30Map.set(s.tenantId, current + s.expectedCount);
    }

    // Map tenants using the aggregated maps
    let results = tenants.map((tenant) => {
      const employeeCount = employeeMap.get(tenant.id) || 0;
      const branchCount = branchMap.get(tenant.id) || 0;
      const departmentCount = departmentMap.get(tenant.id) || 0;
      const shiftCount = shiftMap.get(tenant.id) || 0;
      const presentCount = checkinMap.get(tenant.id) || 0;
      const checkins30 = checkin30Map.get(tenant.id) || 0;

      // Use the accurate time-series expected count. If 0 (e.g. no summary run yet), fallback to generic math.
      const rangeParams = tenantRangesMap.get(tenant.id) || {
        start: boundingStart,
        end: boundingEnd,
        weekdays: 1,
      };
      const expectedInTimeframe =
        expectedMap.get(tenant.id) || employeeCount * rangeParams.weekdays;

      // Use two-decimal precision for rates; keep values numeric so frontend can format as needed
      const presenceRateRaw =
        expectedInTimeframe > 0
          ? (presentCount / expectedInTimeframe) * 100
          : 0;
      const presenceRate = Number(Math.min(100, presenceRateRaw).toFixed(2));

      const expected30 =
        expected30Map.get(tenant.id) || employeeCount * weekdays30Count;
      const sustained30Raw =
        expected30 > 0 ? (checkins30 / expected30) * 100 : 0;
      const sustained30DayRate = Number(
        Math.min(100, sustained30Raw).toFixed(2),
      );

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        initials: tenant.initials,
        isActive: tenant.isActive,
        primaryColor: tenant.primaryColor,
        logoUrl: tenant.logoUrl,
        customDomain: tenant.customDomain,
        createdAt: tenant.createdAt,
        metrics: {
          employees: employeeCount,
          branches: branchCount,
          departments: departmentCount,
          shifts: shiftCount,
          // Preserve existing field for compatibility, and add more explicit fields
          presentToday: presentCount,
          presentInTimeframe: presentCount,
          expectedEmployeeDays: expectedInTimeframe,
          presenceRate: presenceRate,
          sustained30DayRate: sustained30DayRate,
        },
      };
    });

    if (cohort) {
      if (cohort === 'excellent') {
        results = results.filter((s) => (s.metrics.presenceRate ?? 0) >= 90);
      } else if (cohort === 'warning') {
        results = results.filter(
          (s) =>
            (s.metrics.presenceRate ?? 0) >= 75 &&
            (s.metrics.presenceRate ?? 0) < 90,
        );
      } else if (cohort === 'critical') {
        results = results.filter((s) => (s.metrics.presenceRate ?? 0) < 75);
      }
    }

    if (sort) {
      const [field, direction] = sort.split(':');
      const isAsc = direction?.toUpperCase() === 'ASC';
      if (field === 'presenceRate') {
        results.sort((a, b) => {
          const diff =
            (a.metrics.presenceRate ?? 0) - (b.metrics.presenceRate ?? 0);
          return isAsc ? diff : -diff;
        });
      } else if (field === 'createdAt') {
        results.sort((a, b) => {
          const diff =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          return isAsc ? diff : -diff;
        });
      }
    }

    const total = results.length;

    if (offset !== undefined) {
      results = results.slice(Number(offset));
    }

    if (limit !== undefined) {
      results = results.slice(0, Number(limit));
    }

    return { results, total };
  }

  /**
   * Check tenant slug/initials uniqueness and cross-field conflicts.
   * Mirrors frontend normalization rules so client and server agree.
   */
  async checkTenantUnique(params: {
    slug?: string;
    initials?: string;
    excludeId?: string;
  }): Promise<{
    slugTaken?: boolean;
    initialsTaken?: boolean;
    initialsConflictWithSlug?: boolean;
    slugConflictWithInitials?: boolean;
  }> {
    const { slug, initials, excludeId } = params || {};

    const result: any = {};

    const slugNorm = this.normalizeSlugValue(slug);
    const initialsNorm = this.normalizeInitialsValue(initials);

    // Check slug itself and whether it conflicts with any existing initials
    if (slugNorm) {
      const slugWhere: any = { slug: slugNorm };
      if (excludeId) slugWhere.id = Not(excludeId);
      const existingSlug = await this.tenantRepo.findOne({ where: slugWhere });
      result.slugTaken = !!existingSlug;

      const initialsConflictWhere: any = { initials: slugNorm.toUpperCase() };
      if (excludeId) initialsConflictWhere.id = Not(excludeId);
      const initialsConflict = await this.tenantRepo.findOne({ where: initialsConflictWhere });
      result.slugConflictWithInitials = !!initialsConflict;
    }

    // Check initials itself and whether it conflicts with any existing slug
    if (initialsNorm) {
      const initialsWhere: any = { initials: initialsNorm };
      if (excludeId) initialsWhere.id = Not(excludeId);
      const existingInitials = await this.tenantRepo.findOne({ where: initialsWhere });
      result.initialsTaken = !!existingInitials;

      const slugConflictWhere: any = { slug: initialsNorm.toLowerCase() };
      if (excludeId) slugConflictWhere.id = Not(excludeId);
      const slugConflict = await this.tenantRepo.findOne({ where: slugConflictWhere });
      result.initialsConflictWithSlug = !!slugConflict;
    }

    return result;
  }

  /** Dynamically onboard a brand new school. */
  async onboardTenant(data: {
    name: string;
    slug: string;
    primaryColor?: string;
    initials?: string;
    adminUsername: string;
    adminPasswordHash: string; // Plain password passed from controller which we will hash
  }): Promise<Tenant> {
    const cleanSlug = this.normalizeSlugValue(data.slug);
    const initialsNorm = this.normalizeInitialsValue(data.initials);

    // 1. Verify unique slug
    const existingTenant = await this.tenantRepo.findOne({ where: { slug: cleanSlug } });
    if (existingTenant) {
      throw new BadRequestException(
        `A school with the subdomain "${cleanSlug}" already exists.`,
      );
    }

    // When creating a tenant we must perform the full set of cross-field checks
    // so that slugs and initials are mutually exclusive and cannot collide.
    if (cleanSlug) {
      const initialsConflict = await this.tenantRepo.findOne({ where: { initials: cleanSlug.toUpperCase() } });
      if (initialsConflict) {
        throw new BadRequestException(
          `Subdomain "${cleanSlug}" conflicts with existing school initials "${initialsConflict.initials}".`,
        );
      }
    }

    if (initialsNorm) {
      const existingInitials = await this.tenantRepo.findOne({ where: { initials: initialsNorm } });
      if (existingInitials) {
        throw new BadRequestException(
          `School initials "${initialsNorm}" are already in use.`,
        );
      }

      // initials must not collide with existing slugs
      const slugConflict = await this.tenantRepo.findOne({ where: { slug: initialsNorm.toLowerCase() } });
      if (slugConflict) {
        throw new BadRequestException(
          `Initials "${initialsNorm}" conflict with existing subdomain slug "${slugConflict.slug}".`,
        );
      }
    }

    // 3. Verify unique username
    const existingUser = await this.userRepo.findOne({ where: { username: data.adminUsername } });
    if (existingUser) {
      throw new BadRequestException(
        `A user with the admin username "${data.adminUsername}" already exists.`,
      );
    }

    // 3. Perform atomic transaction for maximum safety
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create Tenant
      const tenant = queryRunner.manager.create(Tenant, {
        name: data.name,
        slug: cleanSlug,
        primaryColor: data.primaryColor || '#3b82f6',
        initials: initialsNorm || null,
        isActive: true,
      });
      const savedTenant = await queryRunner.manager.save(Tenant, tenant);

      // Create Admin User bound to that Tenant
      const hashedPassword = await bcrypt.hash(data.adminPasswordHash.trim(), 12);
      const adminUser = queryRunner.manager.create(User, {
        fullName: `${data.name?.trim()} Admin`,
        username: data.adminUsername?.trim(),
        passwordHash: hashedPassword,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        tenantId: savedTenant.id,
      });
      await queryRunner.manager.save(User, adminUser);

      await queryRunner.commitTransaction();
      return savedTenant;
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      // Map Postgres unique constraint violations to friendly errors
      if (err && (err.code === '23505' || err.constraint)) {
        const constraint = err.constraint || err.detail || '';
        if (/initials/i.test(constraint)) {
          throw new BadRequestException(
            `School initials "${initialsNorm}" are already in use.`,
          );
        }
        if (/slug/i.test(constraint)) {
          throw new BadRequestException(
            `Subdomain "${cleanSlug}" already exists.`,
          );
        }
        if (/username/i.test(constraint)) {
          throw new BadRequestException(
            `A user with the admin username "${data.adminUsername}" already exists.`,
          );
        }
        throw new BadRequestException('Duplicate value violates unique constraint.');
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** Toggle active/suspended state of a school. */
  async toggleTenantStatus(id: string, isActive: boolean): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`School with ID "${id}" not found.`);
    }

    tenant.isActive = isActive;
    return this.tenantRepo.save(tenant);
  }

  /** Get platform-wide business and usage stats for the system owner. */
  async getSystemStats(timeframe: string = 'today'): Promise<any> {
    const totalTenants = await this.tenantRepo.count();
    const activeTenants = await this.tenantRepo.count({
      where: { isActive: true },
    });
    // Exclude INACTIVE (resigned/fired) employees from the global headcount.
    // SUSPENDED employees are still considered active workforce members.
    const totalEmployees = await this.employeeRepo.count({
      where: { status: Not(EmployeeStatus.INACTIVE) },
    });

    // Call findAllTenants to get precise tenant-specific aggregates
    const { results: schools } = await this.findAllTenants(timeframe);

    // Sum active checked-in staff count over this timeframe (use presentInTimeframe when available)
    const uniquePresentInTimeframe = schools.reduce(
      (acc, s) =>
        acc + (s.metrics.presentInTimeframe ?? s.metrics.presentToday ?? 0),
      0,
    );

    // Sum active expected check-ins count over this timeframe. Prefer expectedEmployeeDays when present
    const tenants = await this.tenantRepo.find();
    const tenantRangesMap = await this.getTenantRanges(tenants, timeframe);

    let totalExpected = 0;
    for (const s of schools) {
      totalExpected +=
        s.metrics.expectedEmployeeDays ??
        s.metrics.employees * (tenantRangesMap.get(s.id)?.weekdays ?? 1);
    }

    const globalPresenceRate =
      totalExpected > 0
        ? Number(
            Math.min(
              100,
              (uniquePresentInTimeframe / totalExpected) * 100,
            ).toFixed(2),
          )
        : 0; // No employees in the system → 0%, not 100%

    // Calculate cohort counts
    let excellentCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    for (const s of schools) {
      const rate = s.metrics.presenceRate ?? 0;
      if (rate >= 90) {
        excellentCount++;
      } else if (rate >= 75) {
        warningCount++;
      } else {
        criticalCount++;
      }
    }

    // Bottom 5 (Lowest presence rate first)
    const bottomFive = [...schools]
      .sort(
        (a, b) => (a.metrics.presenceRate ?? 0) - (b.metrics.presenceRate ?? 0),
      )
      .slice(0, 5);

    // Top 5 (Highest presence rate first, tie-breaker: largest workforce first)
    const topFive = [...schools]
      .sort((a, b) => {
        const rateDiff =
          (b.metrics.presenceRate ?? 0) - (a.metrics.presenceRate ?? 0);
        if (rateDiff !== 0) return rateDiff;
        return b.metrics.employees - a.metrics.employees;
      })
      .slice(0, 5);

    // Top 10 sustained (Highest sustained 30-day rate first, tie-breaker: largest workforce first)
    const topTenSustained = [...schools]
      .sort((a, b) => {
        const rateDiff =
          (b.metrics.sustained30DayRate ?? 0) -
          (a.metrics.sustained30DayRate ?? 0);
        if (rateDiff !== 0) return rateDiff;
        return b.metrics.employees - a.metrics.employees;
      })
      .slice(0, 10);

    // Calculate true chronological global presence rates for each of the last 6 weeks
    const history: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - (i + 1) * 7);
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setDate(end.getDate() - i * 7);
      end.setHours(23, 59, 59, 999);

      const result = await this.connection
        .getRepository(AttendanceLog)
        .createQueryBuilder('log')
        .select(
          "COUNT(DISTINCT CONCAT(log.employee_id, '_', DATE_TRUNC('day', log.timestamp)))",
          'count',
        )
        .where('log.timestamp BETWEEN :start AND :end', { start, end })
        .andWhere('log.type = :type', { type: AttendanceType.CLOCK_IN })
        .andWhere('EXTRACT(ISODOW FROM log.timestamp) IN (1, 2, 3, 4, 5)')
        .getRawOne();

      const expectedRes = await this.connection
        .getRepository(AttendanceDailySummary)
        .createQueryBuilder('s')
        .select('SUM(s.expectedCount)', 'expected')
        .where('s.date >= :start AND s.date <= :end', {
          start: this.toDateStr(start),
          end: this.toDateStr(end),
        })
        .getRawOne();

      const checkins = Number(result?.count) || 0;
      const expected =
        Number(expectedRes?.expected) ||
        totalEmployees * this.countWeekdays(start, end);
      const rate =
        expected > 0
          ? Number(Math.min(100, (checkins / expected) * 100).toFixed(2))
          : 100.0;
      history.push(rate);
    }

    // history[0] = 6 weeks ago (baseline), history[5] = current week
    const momGrowth = Number((history[5] - history[0]).toFixed(2));

    // Real-time Health Checks
    const dbStartTime = performance.now();
    let apiStatus = 'DEGRADED';
    let latencyMs = 0;
    let databaseUptime = '99.99%'; // Default fallback
    try {
      // Query PostgreSQL for real server uptime and measure latency
      const result = await this.connection.query(
        'SELECT EXTRACT(EPOCH FROM (current_timestamp - pg_postmaster_start_time())) as uptime_seconds',
      );
      latencyMs = Math.round(performance.now() - dbStartTime);
      apiStatus = 'HEALTHY';

      const uptimeSecs = result[0]?.uptime_seconds;
      if (uptimeSecs) {
        const days = Math.floor(uptimeSecs / 86400);
        const hours = Math.floor((uptimeSecs % 86400) / 3600);
        if (days > 0) {
          databaseUptime = `${days}d ${hours}h`;
        } else {
          const mins = Math.floor((uptimeSecs % 3600) / 60);
          databaseUptime = `${hours}h ${mins}m`;
        }
      }
    } catch (err) {
      latencyMs = -1;
      apiStatus = 'DEGRADED';
      databaseUptime = 'Offline';
    }

    return {
      overview: {
        totalSchools: totalTenants,
        activeSchools: activeTenants,
        suspendedSchools: totalTenants - activeTenants,
        trackedEmployees: totalEmployees,
        // presentInTimeframe is the aggregated "present" count for the selected timeframe
        presentInTimeframe: uniquePresentInTimeframe,
        // Keep presentToday for backwards compatibility (alias)
        presentToday: uniquePresentInTimeframe,
        expectedEmployeeDays: totalExpected,
        presenceRate: globalPresenceRate,
        history,
        momGrowth,
        cohorts: {
          excellent: excellentCount,
          warning: warningCount,
          critical: criticalCount,
        },
      },
      topFive,
      bottomFive,
      topTenSustained,
      health: {
        apiStatus,
        databaseUptime,
        latencyMs,
      },
    };
  }

  /** Update tenant branding and white-label config details. */
  async updateTenantBranding(
    id: string,
    data: {
      name?: string;
      slug?: string;
      primaryColor?: string;
      initials?: string;
      logoUrl?: string;
      customDomain?: string;
    },
  ): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`School with ID "${id}" not found.`);
    }

    // If slug is being updated, normalize and enforce uniqueness + cross-field checks
    if (data.slug !== undefined) {
      const cleanSlug = this.normalizeSlugValue(data.slug);
      if (cleanSlug !== tenant.slug) {
        const existing = await this.tenantRepo.findOne({ where: { slug: cleanSlug } });
        if (existing && existing.id !== tenant.id) {
          throw new BadRequestException(
            `Subdomain "${cleanSlug}" is already registered to another school.`,
          );
        }

        // Ensure the new slug does not conflict with any tenant initials
        if (cleanSlug) {
          const initialsConflict = await this.tenantRepo.findOne({ where: { initials: cleanSlug.toUpperCase() } });
          if (initialsConflict && initialsConflict.id !== tenant.id) {
            throw new BadRequestException(
              `Subdomain "${cleanSlug}" conflicts with existing school initials "${initialsConflict.initials}".`,
            );
          }
        }

        tenant.slug = cleanSlug;
      }
    }

    if (data.customDomain) {
      const cleanDomain = data.customDomain.toLowerCase().trim();
      if (cleanDomain !== tenant.customDomain) {
        const existing = await this.tenantRepo.findOne({
          where: { customDomain: cleanDomain },
        });
        if (existing) {
          throw new BadRequestException(
            `Domain "${cleanDomain}" is already linked to another school.`,
          );
        }
        tenant.customDomain = cleanDomain;
      }
    } else if (data.customDomain === '') {
      tenant.customDomain = null;
    }

    if (data.name) tenant.name = data.name;
    if (data.primaryColor) tenant.primaryColor = data.primaryColor;
    if (data.initials !== undefined) {
      const initialsNorm = this.normalizeInitialsValue(data.initials);
      if ((tenant.initials || null) !== (initialsNorm || null)) {
        if (initialsNorm) {
          const existing = await this.tenantRepo.findOne({ where: { initials: initialsNorm } });
          if (existing && existing.id !== tenant.id) {
            throw new BadRequestException(
              `School initials "${initialsNorm}" are already in use.`,
            );
          }

          // Ensure initials do not collide with any existing slug
          const slugConflict = await this.tenantRepo.findOne({ where: { slug: initialsNorm.toLowerCase() } });
          if (slugConflict && slugConflict.id !== tenant.id) {
            throw new BadRequestException(
              `Initials "${initialsNorm}" conflict with existing subdomain slug "${slugConflict.slug}".`,
            );
          }
        }

        tenant.initials = initialsNorm || null;
      }
    }
    if (data.logoUrl !== undefined) tenant.logoUrl = data.logoUrl || null;

    return this.tenantRepo.save(tenant);
  }

  // ── Bulletins / System CRM Operations ──────────────────────────────────────

  /** List all system bulletins (both active and inactive) for administrative audit. */
  async findAllBulletins(): Promise<SystemBulletin[]> {
    return this.bulletinRepo.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * List only currently active bulletins visible to a specific tenant.
   * A bulletin is visible if:
   *   - targetTenantIds is NULL (broadcast to all), OR
   *   - targetTenantIds contains the requesting tenantId.
   */
  async findActiveBulletins(
    tenantId?: string | null,
  ): Promise<SystemBulletin[]> {
    const qb = this.bulletinRepo
      .createQueryBuilder('b')
      .where('b.is_active = true')
      .orderBy('b.created_at', 'DESC');

    if (tenantId) {
      // Return global bulletins OR bulletins that explicitly target this tenant.
      qb.andWhere(
        '(b.target_tenant_ids IS NULL OR b.target_tenant_ids LIKE :tid)',
        { tid: `%${tenantId}%` },
      );
    }

    return qb.getMany();
  }

  /** Create and publish a new platform bulletin. */
  async createBulletin(data: {
    title: string;
    content: string;
    type: BulletinType;
    targetTenantIds?: string[] | null;
  }): Promise<SystemBulletin> {
    if (!data.title || !data.content) {
      throw new BadRequestException(
        'Title and content are required to publish a bulletin.',
      );
    }
    const bulletin = this.bulletinRepo.create({
      title: data.title,
      content: data.content,
      type: data.type || BulletinType.INFO,
      isActive: true,
      // Normalize: store null when empty array so the SQL IS NULL check works.
      targetTenantIds:
        data.targetTenantIds && data.targetTenantIds.length > 0
          ? data.targetTenantIds
          : null,
    });
    return this.bulletinRepo.save(bulletin);
  }

  /** Update a bulletin status or body. */
  async updateBulletin(
    id: string,
    data: {
      title?: string;
      content?: string;
      type?: BulletinType;
      isActive?: boolean;
    },
  ): Promise<SystemBulletin> {
    const bulletin = await this.bulletinRepo.findOne({ where: { id } });
    if (!bulletin) {
      throw new NotFoundException(
        `Bulletin announcement with ID "${id}" not found.`,
      );
    }

    if (data.title) bulletin.title = data.title;
    if (data.content) bulletin.content = data.content;
    if (data.type) bulletin.type = data.type;
    if (data.isActive !== undefined) bulletin.isActive = data.isActive;

    return this.bulletinRepo.save(bulletin);
  }

  /** Delete a bulletin permanently. */
  async deleteBulletin(id: string): Promise<void> {
    const bulletin = await this.bulletinRepo.findOne({ where: { id } });
    if (!bulletin) {
      throw new NotFoundException(
        `Bulletin announcement with ID "${id}" not found.`,
      );
    }
    await this.bulletinRepo.remove(bulletin);
  }

  /** Get individual employee performance rankings across all tenants.
   * Composite Score = Presence(40%) + Punctuality/SignOut(30%) + HoursCompletion(20%) + ForgotOutCompliance(10%)
   */
  async getEmployeeRankings(
    timeframe: string = '30d',
    sort: 'best' | 'worst' = 'best',
    page: number = 1,
    limit: number = 50,
    search?: string,
    school?: string,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const allResults = await this.getEmployeeRankingRows(timeframe);

    const searchTerm = search?.trim().toLowerCase();
    const schoolTerm = school?.trim().toLowerCase();
    let finalResults =
      sort === 'worst' ? [...allResults].reverse() : [...allResults];

    if (searchTerm) {
      finalResults = finalResults.filter(
        (emp) =>
          String(emp.name ?? '')
            .toLowerCase()
            .includes(searchTerm) ||
          String(emp.employeeCode ?? '')
            .toLowerCase()
            .includes(searchTerm),
      );
    }

    if (schoolTerm) {
      finalResults = finalResults.filter((emp) =>
        String(emp.school?.name ?? '')
          .toLowerCase()
          .includes(schoolTerm),
      );
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const total = finalResults.length;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
    const offset = (safePage - 1) * safeLimit;

    return {
      data: finalResults.slice(offset, offset + safeLimit),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  private async getEmployeeRankingRows(timeframe: string): Promise<any[]> {
    const cacheKey = timeframe;
    const cached = this.employeeRankingsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const inFlight = this.employeeRankingsInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const calculation = (async () => {
      const now = new Date();
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      if (timeframe === '7d') {
        startDate.setDate(startDate.getDate() - 6);
      } else if (timeframe === '30d') {
        startDate.setDate(startDate.getDate() - 29);
      } else if (timeframe === 'term') {
        startDate.setDate(startDate.getDate() - 89);
      } // 'today' keeps startDate as start-of-today

      const employees = await this.employeeRepo
        .createQueryBuilder('emp')
        .leftJoin('emp.user', 'user')
        .leftJoin('emp.shift', 'shift')
        .where('emp.status = :status', { status: EmployeeStatus.ACTIVE })
        .select([
          'emp.id',
          'emp.tenantId',
          'emp.employeeCode',
          'emp.position',
          'emp.photoUrl',
          'user.id',
          'user.fullName',
          'shift.id',
          'shift.startTime',
          'shift.endTime',
          'shift.workingDays',
        ])
        .getMany();
      if (employees.length === 0) return [];

      const tenants = await this.tenantRepo
        .createQueryBuilder('tenant')
        .select([
          'tenant.id',
          'tenant.name',
          'tenant.primaryColor',
          'tenant.slug',
        ])
        .getMany();
      const tenantMap = new Map(tenants.map((t) => [t.id, t]));

      const employeeIds = employees.map((e) => e.id);

      const clockInLogs = await this.connection.query(
        `SELECT DISTINCT ON (employee_id, DATE_TRUNC('day', timestamp)::date)
          employee_id,
          DATE_TRUNC('day', timestamp)::date::text AS day,
          timestamp,
          is_late
         FROM attendance_logs
         WHERE employee_id = ANY($1)
           AND timestamp BETWEEN $2 AND $3
           AND type = $4
         ORDER BY employee_id, DATE_TRUNC('day', timestamp)::date, timestamp ASC`,
        [employeeIds, startDate, endOfToday, AttendanceType.CLOCK_IN],
      );

      const clockOutLogs = await this.connection.query(
        `SELECT
          employee_id,
          DATE_TRUNC('day', timestamp)::date::text AS day,
          MAX(timestamp) AS timestamp
         FROM attendance_logs
         WHERE employee_id = ANY($1)
           AND timestamp BETWEEN $2 AND $3
           AND type = $4
         GROUP BY employee_id, DATE_TRUNC('day', timestamp)::date`,
        [employeeIds, startDate, endOfToday, AttendanceType.CLOCK_OUT],
      );

      const clockInsByEmp = new Map<
        string,
        { dates: Map<string, { isLate: boolean; ts: Date }> }
      >();
      for (const row of clockInLogs) {
        const empId: string = row.employee_id;
        if (!clockInsByEmp.has(empId))
          clockInsByEmp.set(empId, { dates: new Map() });
        clockInsByEmp.get(empId)!.dates.set(row.day, {
          isLate: row.is_late,
          ts: new Date(row.timestamp),
        });
      }

      const clockOutsByEmp = new Map<string, Map<string, Date>>();
      for (const row of clockOutLogs) {
        const empId: string = row.employee_id;
        if (!clockOutsByEmp.has(empId)) clockOutsByEmp.set(empId, new Map());
        clockOutsByEmp.get(empId)!.set(row.day, new Date(row.timestamp));
      }

      const results: any[] = [];

      for (const emp of employees) {
        const shift = emp.shift;
        if (!emp.tenantId) continue;
        const tenant = tenantMap.get(emp.tenantId);
        if (!tenant) continue;

        const workingDays: number[] = shift?.workingDays ?? [1, 2, 3, 4, 5];
        let expectedDays = 0;
        const cursor = new Date(startDate);
        while (cursor <= endOfToday) {
          const dow = cursor.getDay();
          if (workingDays.includes(dow === 0 ? 7 : dow)) expectedDays++;
          cursor.setDate(cursor.getDate() + 1);
        }
        if (expectedDays === 0) expectedDays = 1;

        const inMap =
          clockInsByEmp.get(emp.id)?.dates ??
          new Map<string, { isLate: boolean; ts: Date }>();
        const outMap = clockOutsByEmp.get(emp.id) ?? new Map<string, Date>();

        const presentDates = Array.from(inMap.keys());
        const daysPresent = presentDates.length;

        const presenceRate = Math.min(100, (daysPresent / expectedDays) * 100);

        let onTimeEvents = 0;
        let totalExpectedEvents = 0;
        let earlyOutCount = 0;

        for (const dateKey of presentDates) {
          const cin = inMap.get(dateKey)!;
          const cout = outMap.get(dateKey);

          // 1. Evaluate Clock-In (with 5-min grace period)
          totalExpectedEvents++;
          if (shift?.startTime) {
            const [sh, sm] = shift.startTime.split(':').map(Number);
            const shiftStart = new Date(cin.ts);
            shiftStart.setHours(sh, sm, 0, 0);
            const graceStart = new Date(shiftStart.getTime() + 5 * 60000); // 5 mins late is okay
            if (cin.ts <= graceStart) onTimeEvents++;
          } else {
            if (!cin.isLate) onTimeEvents++;
          }

          // 2. Evaluate Clock-Out (Only if it exists! No double jeopardy)
          if (cout) {
            totalExpectedEvents++;
            if (shift?.endTime) {
              const [eh, em] = shift.endTime.split(':').map(Number);
              const shiftEnd = new Date(cout);
              shiftEnd.setHours(eh, em, 0, 0);
              const graceEnd = new Date(shiftEnd.getTime() - 5 * 60000); // leaving 5 mins early is okay
              if (cout >= graceEnd) {
                onTimeEvents++;
              } else {
                earlyOutCount++;
              }
            } else {
              onTimeEvents++;
            }
          }
        }

        // If the employee never clocked in, they cannot be "punctual".
        // Default to 0 instead of 100 to avoid inflating absent employees' scores.
        const punctualityRate =
          daysPresent > 0 && totalExpectedEvents > 0
            ? Math.min(100, (onTimeEvents / totalExpectedEvents) * 100)
            : 0;

        let totalActualMinutes = 0;
        let totalExpectedMinutes = 0;
        if (shift?.startTime && shift?.endTime) {
          const [sh, sm] = shift.startTime.split(':').map(Number);
          const [eh, em] = shift.endTime.split(':').map(Number);
          const shiftDurationMins = eh * 60 + em - (sh * 60 + sm);
          if (shiftDurationMins > 0) {
            totalExpectedMinutes = daysPresent * shiftDurationMins;
            for (const dateKey of presentDates) {
              const cin = inMap.get(dateKey)!;
              const cout = outMap.get(dateKey);
              if (cout) {
                // effectiveStart: if employee clocked in early, start counting only
                // from shift start. If they clocked in late, count from actual clock-in.
                const shiftStart = new Date(cin.ts);
                shiftStart.setHours(sh, sm, 0, 0);
                const effectiveStart =
                  cin.ts < shiftStart ? shiftStart : cin.ts;

                // effectiveEnd: if employee clocked out after shift end, stop counting
                // at shift end (no overtime credit). If they left early, use actual clock-out.
                const shiftEnd = new Date(cout);
                shiftEnd.setHours(eh, em, 0, 0);
                const effectiveEnd = cout > shiftEnd ? shiftEnd : cout;

                const actualMins =
                  (effectiveEnd.getTime() - effectiveStart.getTime()) / 60000;
                totalActualMinutes += Math.max(0, actualMins);
              }
            }
          }
        }
        const hoursCompletionRate =
          totalExpectedMinutes > 0
            ? Math.min(100, (totalActualMinutes / totalExpectedMinutes) * 100) // Strictly capped at 100% — no overtime
            : daysPresent > 0
              ? 100
              : 0;

        let forgotOutCount = 0;
        for (const dateKey of presentDates) {
          if (!outMap.has(dateKey)) forgotOutCount++;
        }
        // If never present, sign-out rate is 0 — cannot have a sign-out record
        // for a shift that was never attended.
        const forgotOutRate =
          daysPresent > 0 ? Math.max(0, 100 - forgotOutCount * 10) : 0;

        const score = Number(
          (
            presenceRate * 0.4 +
            punctualityRate * 0.3 +
            hoursCompletionRate * 0.2 +
            forgotOutRate * 0.1
          ).toFixed(2),
        );

        results.push({
          id: emp.id,
          name: emp.user?.fullName ?? 'Unknown',
          employeeCode: emp.employeeCode,
          position: emp.position ?? null,
          photoUrl: emp.photoUrl ?? null,
          school: {
            id: tenant.id,
            name: tenant.name,
            primaryColor: tenant.primaryColor,
            slug: tenant.slug,
          },
          metrics: {
            presenceRate: Number(presenceRate.toFixed(2)),
            punctualityRate: Number(punctualityRate.toFixed(2)),
            hoursCompletionRate: Number(hoursCompletionRate.toFixed(2)),
            forgotOutRate: Number(forgotOutRate.toFixed(2)),
            score,
            daysPresent,
            expectedDays,
            earlyOutCount,
            forgotOutCount,
          },
        });
      }

      results.sort((a, b) => b.metrics.score - a.metrics.score);

      results.forEach((r, idx) => {
        r.rank = idx + 1;
        r.totalEmployees = results.length;
      });

      this.employeeRankingsCache.set(cacheKey, {
        timestamp: Date.now(),
        data: results,
      });
      return results;
    })();

    this.employeeRankingsInFlight.set(cacheKey, calculation);
    try {
      return await calculation;
    } finally {
      this.employeeRankingsInFlight.delete(cacheKey);
    }
  }

  /** Delete a school tenant permanently (hard-purge all associated tables via database cascade). */
  async deleteTenant(id: string): Promise<void> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`School tenant with ID "${id}" not found.`);
    }
    await this.tenantRepo.remove(tenant);
  }
}
