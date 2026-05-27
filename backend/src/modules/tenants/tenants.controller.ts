import { Controller, Get, Param, Put, UseGuards, Req, Body, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { Tenant } from './tenant.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('brand/:slug')
  @ApiOperation({ summary: 'Get white-labeled tenant branding by subdomain slug' })
  async getBranding(@Param('slug') slug: string): Promise<Tenant> {
    return this.tenantsService.findBySlug(slug);
  }

  @Put('branding')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update active school branding (admin self-service)' })
  async updateMyBranding(
    @Req() req: any,
    @Body() body: { name?: string; primaryColor?: string; logoUrl?: string; initials?: string },
  ) {
    const role = req.user.role;
    if (role !== 'super_admin' && role !== 'hr_admin') {
      throw new ForbiddenException('Only school administrators can update branding.');
    }
    const tenantId = req.user.tenantId;
    return this.tenantsService.updateBranding(tenantId, body);
  }
}
