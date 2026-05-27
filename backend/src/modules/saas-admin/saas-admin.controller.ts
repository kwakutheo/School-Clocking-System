import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SaasAdminService } from './saas-admin.service';
import { UserRole } from '../../common/enums';
import { User } from '../users/user.entity';
import { SystemBulletin, BulletinType } from './system-bulletin.entity';

@ApiTags('SaaS Developer Console')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('saas-admin')
export class SaasAdminController {
  constructor(private readonly adminService: SaasAdminService) {}

  /** Verifies that the requester is the system owner (developer) who has a null tenantId. */
  private verifyDeveloperCredentials(req: any) {
    const user = req.user as User;
    if (!user || user.role !== UserRole.SUPER_ADMIN || user.tenantId !== null) {
      throw new ForbiddenException(
        'Developer console credentials are required to access this system resource.',
      );
    }
  }

  @Get('tenants')
  @ApiOperation({
    summary: 'List all onboarded schools with active seat counts',
  })
  async getTenants(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Query('timeframe') timeframe?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sort') sort?: string,
    @Query('cohort') cohort?: string,
  ) {
    this.verifyDeveloperCredentials(req);
    const { results, total } = await this.adminService.findAllTenants(
      timeframe,
      search,
      limit,
      offset,
      sort,
      cohort,
    );
    res.setHeader('x-total-count', total.toString());
    res.setHeader('Access-Control-Expose-Headers', 'x-total-count');
    return results;
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Dynamically onboard a new school subdomain' })
  async onboardTenant(
    @Req() req: any,
    @Body()
    body: {
      name: string;
      slug: string;
      primaryColor?: string;
      adminUsername: string;
      adminPasswordHash: string;
    },
  ) {
    this.verifyDeveloperCredentials(req);
    return this.adminService.onboardTenant(body);
  }

  @Put('tenants/:id')
  @ApiOperation({
    summary:
      'Update a school name, subdomain slug, custom domain, and brand aesthetics',
  })
  async updateTenantBranding(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      slug?: string;
      primaryColor?: string;
      logoUrl?: string;
      customDomain?: string;
    },
  ) {
    this.verifyDeveloperCredentials(req);
    return this.adminService.updateTenantBranding(id, body);
  }

  @Put('tenants/:id/status')
  @ApiOperation({ summary: 'Suspend or activate a school subscription' })
  async toggleTenantStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    this.verifyDeveloperCredentials(req);
    return this.adminService.toggleTenantStatus(id, body.isActive);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Fetch system-wide billing, MRR and health statistics',
  })
  async getStats(@Req() req: any, @Query('timeframe') timeframe?: string) {
    this.verifyDeveloperCredentials(req);
    return this.adminService.getSystemStats(timeframe);
  }

  @Get('rankings/employees')
  @ApiOperation({
    summary:
      'Fetch composite individual employee performance rankings across all schools',
  })
  async getEmployeeRankings(
    @Req() req: any,
    @Query('timeframe') timeframe?: string,
    @Query('sort') sort?: 'best' | 'worst',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('school') school?: string,
  ) {
    this.verifyDeveloperCredentials(req);
    return this.adminService.getEmployeeRankings(
      timeframe ?? '30d',
      sort ?? 'best',
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      search,
      school,
    );
  }

  @Delete('tenants/:id')
  @ApiOperation({
    summary: 'Permanently remove a school tenant and all associated data',
  })
  async deleteTenant(@Req() req: any, @Param('id') id: string) {
    this.verifyDeveloperCredentials(req);
    await this.adminService.deleteTenant(id);
    return {
      success: true,
      message: 'School tenant and all associated data removed permanently.',
    };
  }

  // ── Bulletins / System CRM Operations ───────────────────────────────────────

  @Get('bulletins/active')
  @ApiOperation({
    summary:
      'Get all active system announcements (accessible by any logged-in tenant user)',
  })
  async getActiveBulletins(@Req() req: any) {
    // Pass the requesting user's tenantId so global vs. targeted filtering is enforced.
    // A null tenantId (SaaS super admin) receives all active bulletins.
    const tenantId = (req.user as User)?.tenantId ?? null;
    return this.adminService.findActiveBulletins(tenantId);
  }

  @Get('bulletins')
  @ApiOperation({
    summary: 'Audit all platform announcements (active and inactive)',
  })
  async getAllBulletins(@Req() req: any) {
    this.verifyDeveloperCredentials(req);
    return this.adminService.findAllBulletins();
  }

  @Post('bulletins')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish a new platform bulletin' })
  async publishBulletin(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      content: string;
      type: BulletinType;
      targetTenantIds?: string[];
    },
  ) {
    this.verifyDeveloperCredentials(req);
    return this.adminService.createBulletin(body);
  }

  @Put('bulletins/:id')
  @ApiOperation({
    summary: 'Edit or toggle active state of a platform bulletin',
  })
  async updateBulletin(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      content?: string;
      type?: BulletinType;
      isActive?: boolean;
    },
  ) {
    this.verifyDeveloperCredentials(req);
    return this.adminService.updateBulletin(id, body);
  }

  @Delete('bulletins/:id')
  @ApiOperation({ summary: 'Permanently remove a platform announcement' })
  async deleteBulletin(@Req() req: any, @Param('id') id: string) {
    this.verifyDeveloperCredentials(req);
    await this.adminService.deleteBulletin(id);
    return { success: true, message: 'Bulletin removed successfully.' };
  }
}
