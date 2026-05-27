import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { Holiday } from './holiday.entity';

describe('HolidaysService', () => {
  let service: HolidaysService;

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HolidaysService,
        { provide: getRepositoryToken(Holiday), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<HolidaysService>(HolidaysService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── findCurrentYear ────────────────────────────────────────────────────────

  describe('findCurrentYear', () => {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const nextYear = currentYear + 1;

    const buildHoliday = (date: string, isRecurring: boolean): Holiday => {
      const h = new Holiday();
      h.date = date;
      h.isRecurring = isRecurring;
      return h;
    };

    it('should always include recurring holidays regardless of year', async () => {
      const recurringOldDate = buildHoliday(`${lastYear}-12-25`, true);  // Christmas in past year
      const recurringNextDate = buildHoliday(`${nextYear}-01-01`, true); // New Year in future year
      mockRepo.find.mockResolvedValue([recurringOldDate, recurringNextDate]);

      const result = await service.findCurrentYear();

      expect(result).toHaveLength(2);
      expect(result).toContain(recurringOldDate);
      expect(result).toContain(recurringNextDate);
    });

    it('should include non-recurring holidays only from the current year', async () => {
      const currentYearHoliday = buildHoliday(`${currentYear}-06-15`, false);
      const lastYearHoliday = buildHoliday(`${lastYear}-06-15`, false);
      const nextYearHoliday = buildHoliday(`${nextYear}-06-15`, false);
      mockRepo.find.mockResolvedValue([lastYearHoliday, currentYearHoliday, nextYearHoliday]);

      const result = await service.findCurrentYear();

      expect(result).toHaveLength(1);
      expect(result).toContain(currentYearHoliday);
      expect(result).not.toContain(lastYearHoliday);
      expect(result).not.toContain(nextYearHoliday);
    });

    it('should return a mix of recurring (any year) and non-recurring (current year only)', async () => {
      const recurring = buildHoliday(`${lastYear}-12-25`, true);
      const currentOneOff = buildHoliday(`${currentYear}-03-06`, false);
      const oldOneOff = buildHoliday(`${lastYear}-03-06`, false);
      mockRepo.find.mockResolvedValue([recurring, currentOneOff, oldOneOff]);

      const result = await service.findCurrentYear();

      expect(result).toHaveLength(2); // recurring + currentOneOff
      expect(result).toContain(recurring);
      expect(result).toContain(currentOneOff);
      expect(result).not.toContain(oldOneOff);
    });

    it('should return empty array if there are no holidays', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await service.findCurrentYear();
      expect(result).toHaveLength(0);
    });
  });

  // ── getHolidayForDate ──────────────────────────────────────────────────────

  describe('getHolidayForDate', () => {
    it('should match a non-recurring holiday on the exact date', async () => {
      const h = new Holiday();
      h.date = '2026-05-27';
      h.isRecurring = false;
      mockRepo.find.mockResolvedValue([h]);

      const result = await service.getHolidayForDate(new Date('2026-05-27'));
      expect(result).toBe(h);
    });

    it('should match a recurring holiday by month-day regardless of year', async () => {
      const h = new Holiday();
      h.date = '2020-12-25'; // Stored in 2020 but recurring
      h.isRecurring = true;
      mockRepo.find.mockResolvedValue([h]);

      const result = await service.getHolidayForDate(new Date('2026-12-25'));
      expect(result).toBe(h);
    });

    it('should return null if no holiday matches the date', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await service.getHolidayForDate(new Date('2026-07-01'));
      expect(result).toBeNull();
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should throw NotFoundException if holiday does not exist', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.delete('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should resolve without error if delete is successful', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.delete('valid-id')).resolves.toBeUndefined();
    });
  });
});
