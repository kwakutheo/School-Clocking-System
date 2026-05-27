import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './department.entity';
import { Employee } from '../employees/employee.entity';
import { getCurrentTenantId } from '../../common/tenant/tenant-filter.helper';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly repo: Repository<Department>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  findAll(): Promise<Department[]> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      return this.repo.find({ order: { name: 'ASC' } });
    }
    return this.repo.find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  create(name: string): Promise<Department> {
    return this.repo.save(this.repo.create({ name }));
  }

  async update(id: string, name: string): Promise<Department> {
    const tenantId = getCurrentTenantId();
    const dept = tenantId
      ? await this.repo.findOne({ where: { id, tenantId } })
      : await this.repo.findOne({ where: { id } });

    if (!dept) throw new NotFoundException('Department not found.');
    dept.name = name;
    return this.repo.save(dept);
  }

  async remove(id: string): Promise<void> {
    // Guard: only allow deleting a department that belongs to this tenant
    const tenantId = getCurrentTenantId();
    const dept = tenantId
      ? await this.repo.findOne({ where: { id, tenantId } })
      : await this.repo.findOne({ where: { id } });

    if (!dept) throw new NotFoundException('Department not found.');

    await this.employeeRepo
      .createQueryBuilder()
      .update()
      .set({ department: null as any })
      .where('department_id = :id', { id })
      .execute();
    await this.repo.delete(id);
  }
}
