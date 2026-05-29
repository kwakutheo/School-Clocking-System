import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull } from 'typeorm';
import { AcademicTerm } from './term.entity';
import { TermBreak } from './term-break.entity';
import { getCurrentTenantId } from '../../common/tenant/tenant-filter.helper';

@Injectable()
export class AcademicCalendarService {
  constructor(
    @InjectRepository(AcademicTerm)
    private readonly termRepo: Repository<AcademicTerm>,
    @InjectRepository(TermBreak)
    private readonly breakRepo: Repository<TermBreak>,
  ) {}

  async autoSeedTenantTerms(tenantId: string): Promise<void> {
    // 1. Check if the tenant already has any terms (using count to keep it extremely fast)
    const localTermsCount = await this.termRepo.count({ where: { tenantId } });
    if (localTermsCount > 0) return;

    // 2. Fetch all global/national template terms (where tenantId is NULL)
    // We bypass the active tenant scope context to fetch the global template terms.
    const globalTerms = await this.termRepo
      .createQueryBuilder('term')
      .leftJoinAndSelect('term.breaks', 'breaks')
      .where('term.tenantId IS NULL')
      .getMany();

    if (globalTerms.length === 0) return;

    console.log(
      `🌱 [Academic Calendar] Auto-seeding ${globalTerms.length} global term templates to tenant: ${tenantId}`,
    );

    // 3. Clone each term and its breaks to the local tenant
    for (const gTerm of globalTerms) {
      const localTerm = this.termRepo.create({
        name: gTerm.name,
        academicYear: gTerm.academicYear,
        startDate: gTerm.startDate,
        endDate: gTerm.endDate,
        isActive: gTerm.isActive,
        tenantId: tenantId,
      });
      const savedTerm = await this.termRepo.save(localTerm);

      if (gTerm.breaks && gTerm.breaks.length > 0) {
        for (const gBreak of gTerm.breaks) {
          const localBreak = this.breakRepo.create({
            name: gBreak.name,
            startDate: gBreak.startDate,
            endDate: gBreak.endDate,
            term: savedTerm,
            tenantId: tenantId,
          });
          await this.breakRepo.save(localBreak);
        }
      }
    }
  }

  async findAllTerms(): Promise<AcademicTerm[]> {
    const tenantId = getCurrentTenantId();
    if (tenantId) {
      await this.autoSeedTenantTerms(tenantId);
      return this.termRepo.find({
        where: { tenantId },
        relations: ['breaks'],
        order: { startDate: 'DESC' },
      });
    } else {
      // Super Admin (SaaS central control templates)
      // Retrieve only global templates where tenantId is NULL to prevent showing school-specific terms
      return this.termRepo.find({
        where: { tenantId: IsNull() },
        relations: ['breaks'],
        order: { startDate: 'DESC' },
      });
    }
  }

  /**
   * Returns terms for the current academic year.
   * Detection priority:
   * 1. Find the term whose date range contains TODAY → use its academicYear.
   * 2. Fall back: find the most-recently-started active term before today.
   * 3. Last resort: compute academic year from calendar (Sep–Aug boundary).
   */
  async findCurrentYearTerms(): Promise<AcademicTerm[]> {
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tenantId = getCurrentTenantId();

    // Priority 1: term that spans today's date
    const spanningTerm = await this.termRepo
      .createQueryBuilder('term')
      .where(':today BETWEEN term.startDate AND term.endDate', {
        today: todayStr,
      })
      .andWhere('term.tenantId = :tenantId', { tenantId })
      .orderBy('term.startDate', 'ASC')
      .getOne();

    let targetYear: string | null = spanningTerm?.academicYear ?? null;

    if (!targetYear) {
      // Priority 2: most-recently-started active term before or on today
      const recentTerm = await this.termRepo
        .createQueryBuilder('term')
        .where('term.startDate <= :today', { today: todayStr })
        .andWhere('term.isActive = true')
        .andWhere('term.tenantId = :tenantId', { tenantId })
        .orderBy('term.startDate', 'DESC')
        .getOne();
      targetYear = recentTerm?.academicYear ?? null;
    }

    if (!targetYear) {
      // Priority 3: compute from calendar — academic year starts in September
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      const startYear = month >= 9 ? now.getFullYear() : now.getFullYear() - 1;
      targetYear = `${startYear}/${startYear + 1}`;
    }

    const where: any = tenantId
      ? { academicYear: targetYear, tenantId }
      : { academicYear: targetYear };

    return this.termRepo.find({
      where,
      relations: ['breaks'],
      order: { startDate: 'ASC' },
    });
  }

  async findOneTerm(id: string): Promise<AcademicTerm> {
    const tenantId = getCurrentTenantId();
    const where: any = tenantId ? { id, tenantId } : { id };
    const term = await this.termRepo.findOne({
      where,
      relations: ['breaks'],
    });
    if (!term) throw new NotFoundException('Term not found');
    return term;
  }

  async createTerm(data: Partial<AcademicTerm>): Promise<AcademicTerm> {
    const term = this.termRepo.create(data);
    return this.termRepo.save(term);
  }

  async updateTerm(
    id: string,
    data: Partial<AcademicTerm>,
  ): Promise<AcademicTerm> {
    const tenantId = getCurrentTenantId();
    const where: any = tenantId ? { id, tenantId } : { id };
    const term = await this.termRepo.findOne({ where });
    if (!term) throw new NotFoundException('Term not found');
    Object.assign(term, data);
    return this.termRepo.save(term);
  }

  async deleteTerm(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    const where: any = tenantId ? { id, tenantId } : { id };
    const term = await this.termRepo.findOne({ where });
    if (!term) throw new NotFoundException('Term not found');
    await this.termRepo.remove(term);
  }

  async createBreak(
    termId: string,
    data: Partial<TermBreak>,
  ): Promise<TermBreak> {
    const tenantId = getCurrentTenantId();
    const where: any = tenantId ? { id: termId, tenantId } : { id: termId };
    const term = await this.termRepo.findOne({ where });
    if (!term) throw new NotFoundException('Term not found');
    const breakItem = this.breakRepo.create({ ...data, term });
    return this.breakRepo.save(breakItem);
  }

  async deleteBreak(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    const where: any = tenantId ? { id, tenantId } : { id };
    const breakItem = await this.breakRepo.findOne({ where });
    if (!breakItem) throw new NotFoundException('Break not found');
    await this.breakRepo.remove(breakItem);
  }

  async findGlobalTemplates(): Promise<AcademicTerm[]> {
    return this.termRepo.manager.find(AcademicTerm, {
      where: { tenantId: IsNull() },
      relations: ['breaks'],
      order: { startDate: 'DESC' },
    });
  }

  async cloneTemplate(
    academicYear: string,
    overwrite?: boolean,
  ): Promise<AcademicTerm[]> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new BadRequestException(
        'Cannot clone templates in a global SaaS context.',
      );
    }

    // 1. Check if the tenant already has any terms for this academic year
    const existingTerms = await this.termRepo.find({
      where: { tenantId, academicYear },
    });

    if (existingTerms.length > 0) {
      if (!overwrite) {
        throw new BadRequestException('EXISTING_CALENDAR');
      }

      // If overwrite is requested, atomically remove all existing terms and their breaks
      console.log(
        `♻️ [Academic Calendar] Overwriting existing academic year terms for tenant ${tenantId} | Year: ${academicYear}`,
      );
      await this.termRepo.remove(existingTerms);
    }

    // 2. Fetch the global templates for this academic year (where tenantId is NULL)
    // We bypass active tenant context using a manager query
    const globalTerms = await this.termRepo.manager.find(AcademicTerm, {
      where: { tenantId: IsNull(), academicYear },
      relations: ['breaks'],
    });

    if (globalTerms.length === 0) {
      throw new NotFoundException(
        `No global master template was found for the ${academicYear} academic year.`,
      );
    }

    const clonedTerms: AcademicTerm[] = [];

    // 3. Clone each term and its breaks
    for (const gTerm of globalTerms) {
      const localTerm = this.termRepo.create({
        name: gTerm.name,
        academicYear: gTerm.academicYear,
        startDate: gTerm.startDate,
        endDate: gTerm.endDate,
        isActive: gTerm.isActive,
        tenantId,
      });
      const savedTerm = await this.termRepo.save(localTerm);

      if (gTerm.breaks && gTerm.breaks.length > 0) {
        for (const gBreak of gTerm.breaks) {
          const localBreak = this.breakRepo.create({
            name: gBreak.name,
            startDate: gBreak.startDate,
            endDate: gBreak.endDate,
            term: savedTerm,
            tenantId,
          });
          await this.breakRepo.save(localBreak);
        }
      }
      clonedTerms.push(savedTerm);
    }

    return clonedTerms;
  }

  async getTermForDate(date: Date): Promise<AcademicTerm | null> {
    const dateStr = date.toISOString().split('T')[0];
    const tenantId = getCurrentTenantId();
    return this.termRepo
      .createQueryBuilder('term')
      .leftJoinAndSelect('term.breaks', 'breaks')
      .where(':dateStr BETWEEN term.startDate AND term.endDate', { dateStr })
      .andWhere('term.tenantId = :tenantId', { tenantId })
      .getOne();
  }

  async isBreak(date: Date): Promise<string | null> {
    const dateStr = date.toISOString().split('T')[0];
    const tenantId = getCurrentTenantId();
    const breakItem = await this.breakRepo
      .createQueryBuilder('break')
      .where(':dateStr BETWEEN break.startDate AND break.endDate', { dateStr })
      .andWhere('break.tenantId = :tenantId', { tenantId })
      .getOne();
    return breakItem ? breakItem.name : null;
  }
}
