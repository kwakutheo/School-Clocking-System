import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Employee } from './employee.entity';
import { EmployeeStatusLog } from './employee-status-log.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { UserRole, EmployeeStatus } from '../../common/enums';
import { AuditService } from '../audit/audit.service';
import { tenantLocalStorage } from '../../common/tenant/tenant.context';
import { getCurrentTenantId } from '../../common/tenant/tenant-filter.helper';
import { Tenant } from '../tenants/tenant.entity';

@Injectable()
export class EmployeesService implements OnModuleInit {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly repo: Repository<Employee>,
    @InjectRepository(EmployeeStatusLog)
    private readonly statusLogRepo: Repository<EmployeeStatusLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly users: UsersService,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /**
   * One-time migration: ensures every existing employee has at least one
   * status log entry so the history system works from day one.
   */
  async onModuleInit() {
    try {
      // 1. Auto-migrate missing columns and tables for Render production
      this.logger.log('Running automatic database migrations...');
      
      await this.dataSource.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS status_change_date DATE NULL;`);
      await this.dataSource.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT NULL;`);

      
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS employee_status_logs (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          status        VARCHAR(20)  NOT NULL,
          start_date    DATE         NOT NULL,
          end_date      DATE         NULL,
          created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
          employee_id   UUID         NOT NULL REFERENCES employees(id) ON DELETE CASCADE
        );
      `);
      await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_status_logs_employee ON employee_status_logs(employee_id);`);
      await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_status_logs_dates ON employee_status_logs(start_date, end_date);`);

      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS leave_requests (
          id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          leave_type   VARCHAR(20)  NOT NULL,
          start_date   DATE         NOT NULL,
          end_date     DATE         NOT NULL,
          reason       TEXT         NULL,
          status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
          review_note  TEXT         NULL,
          created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
          employee_id  UUID         NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          reviewed_by  UUID         NULL     REFERENCES users(id) ON DELETE SET NULL
        );
      `);
      await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);`);
      await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);`);
      await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);`);

      this.logger.log('Database migrations completed successfully.');

      // 2. Perform the one-time data migration for status history
      const employees = await this.repo.find();
      for (const emp of employees) {
        const existing = await this.statusLogRepo.findOne({
          where: { employee: { id: emp.id } },
        });
        if (!existing) {
          const startDate = emp.hireDate
            ? new Date(emp.hireDate)
            : new Date(emp.createdAt);
          startDate.setHours(0, 0, 0, 0);
          await this.statusLogRepo.save(
            this.statusLogRepo.create({
              employee: emp,
              status: emp.status,
              startDate,
              endDate: null,
            }),
          );
        }
      }
      this.logger.log('Employee status history migration complete.');
    } catch (err) {
      this.logger.error('Error during status history migration', err);
    }
  }

  async findAllUnpaginated(): Promise<Employee[]> {
    const tenantId = getCurrentTenantId();
    return this.repo.find({
      where: tenantId ? { tenantId } : {},
      relations: ['user', 'department', 'branch', 'shift'],
    });
  }

  async findAll(opts: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    branchId?: string;
  } = {}): Promise<{
    data: Employee[];
    total: number;
    page: number;
    limit: number;
    counts: { all: number; active: number; inactive: number; suspended: number };
  }> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(Math.max(1, opts.limit ?? 50), 1000);
    const skip = (page - 1) * limit;

    const tenantId = getCurrentTenantId();

    // ── Main paginated query ──────────────────────────────────────────────────
    const qb = this.repo.createQueryBuilder('emp')
      .leftJoinAndSelect('emp.user', 'user')
      .leftJoinAndSelect('emp.department', 'department')
      .leftJoinAndSelect('emp.branch', 'branch')
      .leftJoinAndSelect('emp.shift', 'shift');

    // ── Tenant isolation (CRITICAL) ───────────────────────────────────────────
    if (tenantId) {
      qb.where('emp.tenantId = :tenantId', { tenantId });
    }

    if (opts.search) {
      const q = `%${opts.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(user.fullName) LIKE :q OR LOWER(emp.employeeCode) LIKE :q OR LOWER(user.username) LIKE :q OR LOWER(department.name) LIKE :q)',
        { q },
      );
    }
    if (opts.status) {
      qb.andWhere('emp.status = :status', { status: opts.status });
    }
    if (opts.branchId) {
      qb.andWhere('branch.id = :branchId', { branchId: opts.branchId });
    }

    qb.orderBy('emp.employeeCode', 'ASC').skip(skip).take(limit);
    const [data, total] = await qb.getManyAndCount();

    // ── Status counts (same search + branch, no status filter) ───────────────
    const cqb = this.repo.createQueryBuilder('empC')
      .leftJoin('empC.user', 'userC')
      .leftJoin('empC.department', 'deptC')
      .leftJoin('empC.branch', 'branchC');

    // ── Tenant isolation on counts (CRITICAL) ────────────────────────────────
    if (tenantId) {
      cqb.where('empC.tenantId = :tenantId', { tenantId });
    }

    if (opts.search) {
      const q = `%${opts.search.toLowerCase()}%`;
      cqb.andWhere(
        '(LOWER(userC.fullName) LIKE :q OR LOWER(empC.employeeCode) LIKE :q OR LOWER(userC.username) LIKE :q OR LOWER(deptC.name) LIKE :q)',
        { q },
      );
    }
    if (opts.branchId) {
      cqb.andWhere('branchC.id = :branchId', { branchId: opts.branchId });
    }

    const rawCounts = await cqb
      .select('empC.status', 'status')
      .addSelect('COUNT(empC.id)', 'cnt')
      .groupBy('empC.status')
      .getRawMany();

    const counts = { all: 0, active: 0, inactive: 0, suspended: 0 };
    for (const row of rawCounts) {
      const c = parseInt(row.cnt, 10) || 0;
      counts.all += c;
      if (row.status === 'active') counts.active = c;
      else if (row.status === 'inactive') counts.inactive = c;
      else if (row.status === 'suspended') counts.suspended = c;
    }

    return { data, total, page, limit, counts };
  }

  async findById(id: string): Promise<Employee> {
    const tenantId = getCurrentTenantId();
    const where: any = tenantId ? { id, tenantId } : { id };
    const emp = await this.repo.findOne({
      where,
      relations: ['user', 'department', 'branch', 'shift'],
    });
    if (!emp) throw new NotFoundException('Employee not found.');
    return emp;
  }

  /** Find employee by their user.id (used in auth-gated endpoints). */
  async findByUserId(userId: string): Promise<Employee | null> {
    const tenantId = getCurrentTenantId();
    const qb = this.repo
      .createQueryBuilder('emp')
      .leftJoinAndSelect('emp.user', 'user')
      .leftJoinAndSelect('user.tenant', 'userTenant')
      .leftJoinAndSelect('emp.branch', 'branch')
      .leftJoinAndSelect('emp.department', 'department')
      .leftJoinAndSelect('emp.shift', 'shift')
      .where('user.id = :userId', { userId });

    if (tenantId) {
      qb.andWhere('emp.tenantId = :tenantId', { tenantId });
    }

    return qb.getOne();
  }

  async create(data: Partial<Employee>): Promise<Employee> {
    const existing = await this.repo.findOne({
      where: { employeeCode: data.employeeCode },
    });
    if (existing) {
      throw new ConflictException(
        `Employee code '${data.employeeCode}' is already in use.`,
      );
    }
    return this.repo.save(this.repo.create(data));
  }

  private async _generateEmployeeCode(): Promise<string> {
    const tenantId = tenantLocalStorage.getStore();
    let prefix = 'TK';
    
    if (tenantId) {
      const tenant = await this.dataSource.getRepository(Tenant).findOne({ where: { id: tenantId } });
      if (tenant) {
        prefix = tenant.initials ? tenant.initials.toUpperCase() : tenant.slug.substring(0, 2).toUpperCase();
      }
    }

    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yymm = `${yy}${mm}`;
    
    const basePrefix = `${prefix}/${yymm}/`;
    
    // Find the highest serial number for this prefix
    const highestEmp = await this.repo.createQueryBuilder('emp')
      .where('emp.employeeCode LIKE :pattern', { pattern: `${basePrefix}%` })
      .orderBy('emp.employeeCode', 'DESC')
      .getOne();
      
    let nextSerial = 1;
    if (highestEmp) {
      const parts = highestEmp.employeeCode.split('/');
      if (parts.length === 3) {
        const lastSerial = parseInt(parts[2], 10);
        if (!isNaN(lastSerial)) {
          nextSerial = lastSerial + 1;
          if (nextSerial > 999) {
            nextSerial = 1;
          }
        }
      }
    }
    
    const code = `${basePrefix}${String(nextSerial).padStart(3, '0')}`;
    
    // Fallback sanity check just in case
    const existing = await this.repo.findOne({ where: { employeeCode: code } });
    if (existing) {
       const num = Math.floor(100 + Math.random() * 900);
       return `${basePrefix}${num}`;
    }
    
    return code;
  }

  async createEmployeeWithUser(payload: {
    fullName: string;
    username: string;
    password: string;
    employeeCode?: string;
    departmentId?: string;
    branchId?: string;
    shiftId?: string;
    position?: string;
    hireDate?: string;
    phone?: string;
    role?: UserRole;
  }, adminUser?: User): Promise<Employee> {
    const employeeCode = payload.employeeCode ?? await this._generateEmployeeCode();

    const existingCode = await this.repo.findOne({
      where: { employeeCode },
    });
    if (existingCode) {
      throw new ConflictException(
        `Employee code '${employeeCode}' is already in use.`,
      );
    }

    const existingUser = await this.users.findByUsername(payload.username);
    if (existingUser) {
      throw new ConflictException('Username already in use.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const passwordHash = await bcrypt.hash(payload.password, 12);
      const user = queryRunner.manager.create(User, {
        fullName: payload.fullName,
        username: payload.username,
        phone: payload.phone,
        passwordHash,
        role: payload.role ?? UserRole.EMPLOYEE,
        isActive: true,
      });
      const savedUser = await queryRunner.manager.save(user);

      const employee = queryRunner.manager.create(Employee, {
        user: savedUser,
        employeeCode,
        position: payload.position,
        hireDate: payload.hireDate ? new Date(payload.hireDate) : undefined,
      } as any);

      if (payload.departmentId) {
        (employee as any).department = { id: payload.departmentId };
      }
      if (payload.branchId) {
        (employee as any).branch = { id: payload.branchId };
      }
      if (payload.shiftId) {
        (employee as any).shift = { id: payload.shiftId };
      }

      const savedEmployee = await queryRunner.manager.save(employee);

      // Create the first status history log (Active from hire date)
      const logStartDate = payload.hireDate ? new Date(payload.hireDate) : new Date();
      logStartDate.setHours(0, 0, 0, 0);
      await queryRunner.manager.save(
        this.statusLogRepo.create({
          employee: savedEmployee,
          status: EmployeeStatus.ACTIVE,
          startDate: logStartDate,
          endDate: null,
        }),
      );

      await queryRunner.commitTransaction();

      if (adminUser) {
        await this.auditService.log({
          user: adminUser,
          action: 'CREATE_EMPLOYEE',
          module: 'EMPLOYEES',
          targetId: savedEmployee.id,
          oldValues: null,
          newValues: {
            fullName: savedUser.fullName,
            username: savedUser.username,
            employeeCode: savedEmployee.employeeCode,
            role: savedUser.role,
          },
        });
      }

      return savedEmployee;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    id: string,
    data: Omit<Partial<Employee>, 'hireDate' | 'department' | 'branch' | 'shift'> & {
      fullName?: string;
      email?: string;
      phone?: string;
      username?: string;
      role?: UserRole;
      departmentId?: string;
      branchId?: string;
      shiftId?: string;
      hireDate?: string;
      status?: EmployeeStatus;
    },
    adminUser?: User,
  ): Promise<Employee> {
    const emp = await this.findById(id);



    const oldValues = {
      fullName: emp.user.fullName,
      phone: emp.user.phone,
      username: emp.user.username,
      role: emp.user.role,
      position: emp.position,
      status: (emp as any).status,
      shift: emp.shift?.name ?? null,
      branch: emp.branch?.name ?? null,
      department: emp.department?.name ?? null,
    };

    if (data.username && data.username !== emp.user.username) {
      const existing = await this.users.findByUsername(data.username);
      if (existing && existing.id !== emp.user.id) {
        throw new ConflictException('Username already in use.');
      }
    }

    if (data.fullName || data.email || data.phone || data.role || data.username) {
      await this.userRepo.update(emp.user.id, {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        username: data.username,
        role: data.role,
      });
    }

    const {
      fullName,
      email,
      phone,
      role,
      username,
      departmentId,
      branchId,
      shiftId,
      hireDate,
      ...employeeData
    } = data;

    if (departmentId !== undefined) (emp as any).department = departmentId ? { id: departmentId } : null;
    if (branchId !== undefined) (emp as any).branch = branchId ? { id: branchId } : null;
    if (shiftId !== undefined) (emp as any).shift = shiftId ? { id: shiftId } : null;
    if (hireDate !== undefined) emp.hireDate = hireDate ? new Date(hireDate) : null as any;
    if (data.status !== undefined) {
      if (emp.status !== data.status) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Close the current open status log
        const openLog = await this.statusLogRepo.findOne({
          where: { employee: { id: emp.id }, endDate: IsNull() },
        });
        if (openLog) {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          openLog.endDate = yesterday;
          await this.statusLogRepo.save(openLog);
        }

        // Open a new status log starting today
        await this.statusLogRepo.save(
          this.statusLogRepo.create({
            employee: { id: emp.id } as any,
            status: data.status,
            startDate: today,
            endDate: null,
          }),
        );

        emp.statusChangeDate = today;
      }
      emp.status = data.status as any;
    }
    Object.assign(emp, employeeData);

    await this.repo.save(emp);

    const updatedEmp = await this.findById(id);

    if (adminUser) {
      await this.auditService.log({
        user: adminUser,
        action: 'UPDATE_EMPLOYEE_PROFILE',
        module: 'EMPLOYEES',
        targetId: id,
        oldValues,
        newValues: {
          fullName: updatedEmp.user.fullName,
          phone: updatedEmp.user.phone,
          username: updatedEmp.user.username,
          role: updatedEmp.user.role,
          position: updatedEmp.position,
          status: (updatedEmp as any).status,
          shift: updatedEmp.shift?.name ?? null,
          branch: updatedEmp.branch?.name ?? null,
          department: updatedEmp.department?.name ?? null,
        },
      });
    }

    return updatedEmp;
  }

  async updateProfile(userId: string, data: {
    fullName?: string;
    email?: string;
    phone?: string;
    photoUrl?: string;
    username?: string;
    password?: string;
  }): Promise<Employee> {
    const employee = await this.findByUserId(userId);
    if (!employee) {
      throw new NotFoundException('Employee profile not found.');
    }

    if (data.username && data.username !== employee.user.username) {
      const existing = await this.users.findByUsername(data.username);
      if (existing && existing.id !== employee.user.id) {
        throw new ConflictException('Username already in use.');
      }
    }

    const userUpdate: any = {
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      username: data.username,
    };
    if (data.password) {
      userUpdate.passwordHash = await bcrypt.hash(data.password, 12);
    }

    Object.keys(userUpdate).forEach((key) => {
      if (userUpdate[key] === undefined) delete userUpdate[key];
    });

    if (Object.keys(userUpdate).length > 0) {
      await this.userRepo.update(employee.user.id, userUpdate);
    }
    if (data.photoUrl !== undefined) {
      await this.repo.update(employee.id, { photoUrl: data.photoUrl });
    }

    return this.findById(employee.id);
  }

  async resetPassword(id: string, adminPassword: string, adminUserPayload: { id: string }): Promise<{ pin: string }> {
    const adminUser = await this.users.findById(adminUserPayload.id);
    const isValidAdminPassword = await bcrypt.compare(adminPassword, adminUser.passwordHash);
    if (!isValidAdminPassword) {
      throw new BadRequestException('Invalid admin password. Action not authorized.');
    }

    const emp = await this.findById(id);
    
    // Generate 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set requiresPasswordChange so the user is forced to change it on their next login
    await this.userRepo.update(emp.user.id, { 
      resetPin: pin,
      requiresPasswordChange: true 
    } as any);

    await this.auditService.log({
      user: adminUser,
      action: 'REQUEST_PASSWORD_RESET',
      module: 'EMPLOYEES',
      targetId: id,
      oldValues: { requiresPasswordChange: false },
      newValues: { requiresPasswordChange: true },
    });

    return { pin };
  }

  async remove(id: string, adminUser?: User): Promise<void> {
    const emp = await this.findById(id);

    if (adminUser) {
      await this.auditService.log({
        user: adminUser,
        action: 'DELETE_EMPLOYEE',
        module: 'EMPLOYEES',
        targetId: id,
        oldValues: {
          fullName: emp.user.fullName,
          employeeCode: emp.employeeCode,
          username: emp.user.username,
          role: emp.user.role,
        },
        newValues: null,
      });
    }

    // Delete the user; the employee row cascades because
    // Employee.user has onDelete: 'CASCADE'.
    await this.userRepo.delete(emp.user.id);
  }

  async getStatusHistory(employeeId: string): Promise<EmployeeStatusLog[]> {
    return this.statusLogRepo.find({
      where: { employee: { id: employeeId } },
      order: { startDate: 'DESC' },
    });
  }
}
