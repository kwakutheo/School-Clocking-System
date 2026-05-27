import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';
import { User } from '../users/user.entity';
import { getCurrentTenantId } from '../../common/tenant/tenant-filter.helper';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(data: {
    user: User;
    action: string;
    module: string;
    targetId?: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    const auditLog = this.auditRepo.create(data);
    return this.auditRepo.save(auditLog);
  }

  async findAll(): Promise<AuditLog[]> {
    const tenantId = getCurrentTenantId();
    const where = tenantId ? { tenantId } : {};
    return this.auditRepo.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 200, // Limit to recent 200 logs
    });
  }

  async findByModule(module: string): Promise<AuditLog[]> {
    const tenantId = getCurrentTenantId();
    const where: any = { module };
    if (tenantId) where.tenantId = tenantId;

    return this.auditRepo.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }
}
