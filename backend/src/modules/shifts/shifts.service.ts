import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Shift } from './shift.entity';
import { Employee } from '../employees/employee.entity';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { getCurrentTenantId } from '../../common/tenant/tenant-filter.helper';
import { UsersService } from '../users/users.service';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private readonly repo: Repository<Shift>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly usersService: UsersService,
  ) {}

  findAll(): Promise<Shift[]> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      // SaaS super-admin: return all shifts across all tenants (used by SaaS admin panel only)
      return this.repo.find();
    }
    return this.repo.find({ where: { tenantId } });
  }

  async findOne(id: string): Promise<Shift> {
    const tenantId = getCurrentTenantId();
    const shift = tenantId
      ? await this.repo.findOne({ where: { id, tenantId } })
      : await this.repo.findOne({ where: { id } });

    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  create(data: CreateShiftDto): Promise<Shift> {
    const shift = this.repo.create(data);
    return this.repo.save(shift);
  }

  async update(id: string, data: UpdateShiftDto): Promise<Shift> {
    // findOne already enforces tenant scope — will throw 404 if not owned
    await this.findOne(id);
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  /**
   * Returns how many employees are currently assigned to a given shift.
   * Used by the frontend to warn admins before deletion.
   */
  async checkUsage(id: string): Promise<{ count: number; names: string[] }> {
    await this.findOne(id); // enforce tenant scope / 404
    const employees = await this.employeeRepo.find({
      where: { shift: { id } } as any,
      relations: ['user'],
    });
    return {
      count: employees.length,
      names: employees.map(
        (e) => e.user?.fullName ?? e.employeeCode,
      ),
    };
  }

  /**
   * Delete a shift.
   * - If the shift is not assigned to anyone, deletes immediately.
   * - If it IS assigned to employees, the caller must supply the admin's
   *   password to confirm. Throws 401 if the password is wrong.
   */
  async remove(
    id: string,
    adminUserId: string,
    confirmPassword?: string,
  ): Promise<void> {
    await this.findOne(id); // enforce tenant scope / 404

    const { count } = await this.checkUsage(id);

    if (count > 0) {
      if (!confirmPassword) {
        throw new BadRequestException({
          code: 'SHIFT_IN_USE',
          message: `This shift is assigned to ${count} staff mamber(s). Provide your password to confirm deletion.`,
          count,
        });
      }

      // Verify the acting admin's password.
      const adminUser = await this.usersService.findById(adminUserId);
      const passwordMatches = await bcrypt.compare(
        confirmPassword,
        adminUser.passwordHash,
      );
      if (!passwordMatches) {
        throw new BadRequestException('Incorrect password.');
      }
    }

    await this.repo.delete(id);
  }
}
