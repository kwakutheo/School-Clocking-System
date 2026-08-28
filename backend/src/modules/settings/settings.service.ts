import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './setting.entity';
import { getCurrentTenantId } from '../../common/tenant/tenant-filter.helper';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
  ) {}

  async get(key: string): Promise<string | null> {
    const tenantId = getCurrentTenantId();
    if (tenantId) {
      const scopedKey = `${tenantId}:${key}`;
      const scopedRow = await this.repo.findOne({ where: { key: scopedKey } });
      if (scopedRow) return scopedRow.value;
    }

    // Fallback to global row if scoped key doesn't exist (e.g. for new tenants inheriting defaults)
    const globalRow = await this.repo.findOne({ where: { key } });
    return globalRow?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    const finalKey = tenantId ? `${tenantId}:${key}` : key;
    await this.repo.upsert({ key: finalKey, value }, ['key']);
  }
}
