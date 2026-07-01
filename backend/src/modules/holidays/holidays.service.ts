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
      return this.repo.find({
        where: { tenantId: IsNull() },
        order: { date: 'ASC' },
      });
    }
    return this.repo.find({ where: { tenantId }, order: { date: 'ASC' } });
  }

  /**
   * Returns holidays relevant for the current calendar year:
   * - Recurring holidays (isRecurring = true) are always included (they apply every year).
   * - Non-recurring holidays are only included if their date falls in the current year.
   */
  async findCurrentYear(targetYear?: number): Promise<any[]> {
    const currentYear = targetYear ?? new Date().getFullYear();
    const all = await this.findAll(); // already tenant-scoped
    
    const activeHolidays = all.filter((h) => {
      if (h.isRecurring) return true;
      const year = parseInt(h.date.substring(0, 4), 10);
      return year === currentYear;
    });

    const computedHolidays = activeHolidays
      .map((h) => ({
        holiday: h,
        origDateStr: h.isRecurring
          ? `${currentYear}-${h.date.substring(5)}`
          : h.date,
      }))
      .sort((a, b) => a.origDateStr.localeCompare(b.origDateStr));

    const observedDates = new Map<string, Holiday>();
    const results: any[] = [];

    for (const item of computedHolidays) {
      let effDate = item.origDateStr;

      if (
        item.holiday.observedDate &&
        item.holiday.observedDate.substring(0, 4) === currentYear.toString()
      ) {
        effDate = item.holiday.observedDate;
      } else if (item.holiday.postponeIfWeekend || item.holiday.isRecurring) {
        const effDateObj = new Date(item.origDateStr);
        while (
          effDateObj.getUTCDay() === 0 ||
          effDateObj.getUTCDay() === 6 ||
          observedDates.has(effDateObj.toISOString().split('T')[0])
        ) {
          effDateObj.setUTCDate(effDateObj.getUTCDate() + 1);
        }
        effDate = effDateObj.toISOString().split('T')[0];
      }

      observedDates.set(effDate, item.holiday);
      results.push({
        ...item.holiday,
        effectiveDate: effDate,
        originalDateThisYear: item.origDateStr,
      });
    }

    return results;
  }

  async create(data: Partial<Holiday>): Promise<Holiday> {
    const holiday = this.repo.create(data);
    return this.repo.save(holiday);
  }

  async delete(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    // Delete using a conditional WHERE so we don't need to load the entity first.
    // This matches the unit tests which mock `repo.delete(...).mockResolvedValue({ affected })`.
    const whereCondition = tenantId
      ? { id, tenantId }
      : { id, tenantId: IsNull() as any };
    const result = await this.repo.delete(whereCondition);

    if (!result || !result.affected)
      throw new NotFoundException('Holiday not found');
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

  async getHolidayForDate(date: Date): Promise<{
    holiday: Holiday;
    isShifted: boolean;
    originalDate: string;
  } | null> {
    const dateStr = date.toISOString().split('T')[0];
    const year = parseInt(dateStr.substring(0, 4), 10);

    const holidays = await this.findAll();

    // Filter to holidays relevant for this year
    const activeHolidays = holidays.filter(
      (h) => h.isRecurring || h.date.substring(0, 4) === year.toString()
    );

    const computedHolidays = activeHolidays
      .map((h) => ({
        holiday: h,
        origDateStr: h.isRecurring
          ? `${year}-${h.date.substring(5)}`
          : h.date,
      }))
      .sort((a, b) => a.origDateStr.localeCompare(b.origDateStr));

    // Map: effectiveDate → { holiday, originalDate }
    const observedDates = new Map<string, { holiday: Holiday; originalDate: string }>();

    for (const item of computedHolidays) {
      let effDate = item.origDateStr;

      if (
        item.holiday.observedDate &&
        item.holiday.observedDate.substring(0, 4) === year.toString()
      ) {
        effDate = item.holiday.observedDate;
      } else if (item.holiday.postponeIfWeekend || item.holiday.isRecurring) {
        const effDateObj = new Date(item.origDateStr);
        while (
          effDateObj.getUTCDay() === 0 ||
          effDateObj.getUTCDay() === 6 ||
          observedDates.has(effDateObj.toISOString().split('T')[0])
        ) {
          effDateObj.setUTCDate(effDateObj.getUTCDate() + 1);
        }
        effDate = effDateObj.toISOString().split('T')[0];
      }

      observedDates.set(effDate, { holiday: item.holiday, originalDate: item.origDateStr });
    }

    const found = observedDates.get(dateStr);
    if (!found) return null;

    return {
      holiday: found.holiday,
      isShifted: found.originalDate !== dateStr,
      originalDate: found.originalDate,
    };
  }
}
