import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AcademicCalendarService } from './academic-calendar.service';
import { AcademicTerm } from './term.entity';
import { TermBreak } from './term-break.entity';

describe('AcademicCalendarService', () => {
  let service: AcademicCalendarService;

  // Mock Repositories
  const mockTermRepo = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockBreakRepo = {
    delete: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcademicCalendarService,
        {
          provide: getRepositoryToken(AcademicTerm),
          useValue: mockTermRepo,
        },
        {
          provide: getRepositoryToken(TermBreak),
          useValue: mockBreakRepo,
        },
      ],
    }).compile();

    service = module.get<AcademicCalendarService>(AcademicCalendarService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findCurrentYearTerms', () => {
    it('Priority 1: should return terms for the academic year of the term spanning today', async () => {
      // Mock Priority 1 query: a term that spans today
      const spanningTerm = new AcademicTerm();
      spanningTerm.academicYear = '2025/2026';

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(spanningTerm),
      };
      mockTermRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Mock the final find query that fetches all terms for that year
      const mockTerms = [new AcademicTerm(), new AcademicTerm()];
      mockTermRepo.find.mockResolvedValue(mockTerms);

      const result = await service.findCurrentYearTerms();

      expect(mockTermRepo.createQueryBuilder).toHaveBeenCalledWith('term');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        ':today BETWEEN term.startDate AND term.endDate',
        expect.any(Object),
      );
      expect(mockTermRepo.find).toHaveBeenCalledWith({
        where: { academicYear: '2025/2026' },
        relations: ['breaks'],
        order: { startDate: 'ASC' },
      });
      expect(result).toEqual(mockTerms);
    });

    it('Priority 2: should fall back to most recently started active term if no term spans today', async () => {
      // Mock Priority 1 query failing (no term spans today)
      const mockPriority1QB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      // Mock Priority 2 query: find recent active term
      const recentTerm = new AcademicTerm();
      recentTerm.academicYear = '2024/2025';
      const mockPriority2QB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(recentTerm),
      };

      mockTermRepo.createQueryBuilder
        .mockReturnValueOnce(mockPriority1QB)
        .mockReturnValueOnce(mockPriority2QB);

      const mockTerms = [new AcademicTerm()];
      mockTermRepo.find.mockResolvedValue(mockTerms);

      const result = await service.findCurrentYearTerms();

      expect(mockTermRepo.find).toHaveBeenCalledWith({
        where: { academicYear: '2024/2025' },
        relations: ['breaks'],
        order: { startDate: 'ASC' },
      });
      expect(result).toEqual(mockTerms);
    });

    it('Priority 3: should fall back to computed calendar year if no active terms exist', async () => {
      // Mock Priority 1 and 2 failing
      const mockFailingQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      mockTermRepo.createQueryBuilder
        .mockReturnValueOnce(mockFailingQB) // Priority 1 fails
        .mockReturnValueOnce(mockFailingQB); // Priority 2 fails

      mockTermRepo.find.mockResolvedValue([]);

      await service.findCurrentYearTerms();

      // We expect the fallback year to be passed to find()
      // Since it's dynamic based on Date.now(), we just check it matches YYYY/YYYY format
      expect(mockTermRepo.find).toHaveBeenCalledWith({
        where: { academicYear: expect.stringMatching(/^\d{4}\/\d{4}$/) },
        relations: ['breaks'],
        order: { startDate: 'ASC' },
      });
    });
  });
});
