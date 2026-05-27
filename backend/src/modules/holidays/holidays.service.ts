import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Holiday } from './holiday.entity';
import { getCurrentTenantId } from '../../common/tenant/tenant-filter.helper';

@Injectable()
export class HolidaysService {
  constructor(
    @InjectRepository(Holiday)
    private readonly repo: Repository<Holiday>,
  ) {}

  async findAll(): Promise<Holiday[]> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      return this.repo.find({ where: { tenantId: IsNull() }, order: { date: 'ASC' } });
    }
    return this.repo.find({ where: { tenantId }, order: { date: 'ASC' } });
  }

  /**
   * Returns holidays relevant for the current calendar year:
   * - Recurring holidays (isRecurring = true) are always included (they apply every year).
   * - Non-recurring holidays are only included if their date falls in the current year.
   */
  async findCurrentYear(): Promise<Holiday[]> {
    const currentYear = new Date().getFullYear();
    const all = await this.findAll(); // already tenant-scoped
    return all.filter((h) => {
      if (h.isRecurring) return true;
      // date is stored as YYYY-MM-DD
      const year = parseInt(h.date.substring(0, 4), 10);
      return year === currentYear;
    });
  }

  async create(data: Partial<Holiday>): Promise<Holiday> {
    const holiday = this.repo.create(data);
    return this.repo.save(holiday);
  }

  async delete(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    // Verify ownership before deleting — a school cannot delete another school's holiday
    const holiday = tenantId
      ? await this.repo.findOne({ where: { id, tenantId } })
      : await this.repo.findOne({ where: { id, tenantId: IsNull() } });

    if (!holiday) throw new NotFoundException('Holiday not found');
    await this.repo.remove(holiday);
  }

  async update(id: string, data: Partial<Holiday>): Promise<Holiday> {
    const tenantId = getCurrentTenantId();
    const holiday = tenantId
      ? await this.repo.findOne({ where: { id, tenantId } })
      : await this.repo.findOne({ where: { id, tenantId: IsNull() } });

    if (!holiday) throw new NotFoundException('Holiday not found');
    Object.assign(holiday, data);
    return this.repo.save(holiday);
  }

  async getHolidayForDate(date: Date): Promise<Holiday | null> {
    const dateStr = date.toISOString().split('T')[0];
    const monthDay = dateStr.substring(5); // MM-DD

    // Use tenant-scoped findAll — this is called internally during clock-in validation
    const holidays = await this.findAll();
    return holidays.find(h => {
      if (h.date === dateStr) return true;
      if (h.isRecurring && h.date.substring(5) === monthDay) return true;
      return false;
    }) || null;
  }
}
