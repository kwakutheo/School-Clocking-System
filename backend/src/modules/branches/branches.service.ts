import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Branch } from './branch.entity';
import { Employee } from '../employees/employee.entity';
import { AttendanceLog } from '../attendance/attendance-log.entity';
import { UsersService } from '../users/users.service';
import { getCurrentTenantId } from '../../common/tenant/tenant-filter.helper';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly repo: Repository<Branch>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(AttendanceLog)
    private readonly attendanceRepo: Repository<AttendanceLog>,
    private readonly users: UsersService,
  ) {}

  findAll(): Promise<Branch[]> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      return this.repo.find({ order: { name: 'ASC' } });
    }
    return this.repo.find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<Branch> {
    const tenantId = getCurrentTenantId();
    const branch = tenantId
      ? await this.repo.findOne({ where: { id, tenantId } })
      : await this.repo.findOne({ where: { id } });

    if (!branch) throw new NotFoundException('Branch not found.');
    return branch;
  }

  async findByQrCode(qrCode: string): Promise<Branch | null> {
    const tenantId = getCurrentTenantId();
    // QR code lookups during clock-in must be scoped to the tenant so an employee
    // from School A cannot scan a QR code belonging to School B.
    if (tenantId) {
      return this.repo.findOne({ where: { qrCode, tenantId } });
    }
    return this.repo.findOne({ where: { qrCode } });
  }

  create(data: Partial<Branch>): Promise<Branch> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Branch>): Promise<Branch> {
    // findById already enforces tenant scope — will 404 if not owned
    await this.findById(id);
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    // findById already enforces tenant scope — will 404 if not owned
    await this.findById(id);

    // Unlink employees
    await this.employeeRepo
      .createQueryBuilder()
      .update()
      .set({ branch: null as any })
      .where('branch_id = :id', { id })
      .execute();

    // Unlink attendance logs
    await this.attendanceRepo
      .createQueryBuilder()
      .update()
      .set({ branch: null as any })
      .where('branch_id = :id', { id })
      .execute();

    await this.repo.delete(id);
  }

  async generateQrCode(
    id: string,
    userId: string,
    password: string,
  ): Promise<Branch> {
    const user = await this.users.findById(userId);
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new BadRequestException(
        'Incorrect password. QR code was not regenerated.',
      );
    }

    // findById enforces tenant scope — admin cannot regenerate QR for another school's branch
    const branch = await this.findById(id);
    branch.qrCode = randomBytes(16).toString('hex');
    branch.qrCodeUpdatedAt = new Date();
    return this.repo.save(branch);
  }
}
