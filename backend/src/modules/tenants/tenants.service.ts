import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug "${slug}" not found`);
    }
    return tenant;
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }
    return tenant;
  }

  async create(name: string, slug: string): Promise<Tenant> {
    const tenant = this.tenantRepository.create({ name, slug });
    return this.tenantRepository.save(tenant);
  }

  async updateBranding(
    id: string,
    data: {
      name?: string;
      primaryColor?: string;
      logoUrl?: string;
      initials?: string;
    },
  ): Promise<Tenant> {
    const tenant = await this.findById(id);
    if (data.name) tenant.name = data.name;
    if (data.primaryColor) tenant.primaryColor = data.primaryColor;
    if (data.logoUrl !== undefined) tenant.logoUrl = data.logoUrl || null;
    if (data.initials !== undefined)
      tenant.initials = data.initials ? data.initials.toUpperCase() : null;
    return this.tenantRepository.save(tenant);
  }
}
