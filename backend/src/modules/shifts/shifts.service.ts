import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from './shift.entity';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { getCurrentTenantId } from '../../common/tenant/tenant-filter.helper';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private readonly repo: Repository<Shift>,
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

  async remove(id: string): Promise<void> {
    // findOne already enforces tenant scope — will throw 404 if not owned
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
