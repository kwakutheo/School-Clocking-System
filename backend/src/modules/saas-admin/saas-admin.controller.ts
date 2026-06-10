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

  /** Verifies that the requester is a platform-level admin, not a tenant admin. */
  private verifyGlobalAdmin(
    req: any,
    roles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.HR_ADMIN,
      UserRole.SUPERVISOR,
    ],
  ) {
    const user = req.user as User;
    if (!user || user.tenantId !== null || !roles.includes(user.role)) {
      throw new ForbiddenException(
        'Central dashboard credentials are required to access this system resource.',
      );
    }
  }

  private verifyGlobalSuperAdmin(req: any) {
    this.verifyGlobalAdmin(req, [UserRole.SUPER_ADMIN]);
  }

  @Get('admin-users')
  @ApiOperation({ summary: 'List central dashboard admin accounts' })
  async getGlobalAdmins(
    @Req() req: any,
    @Query('showArchived') showArchived?: string,
  ) {
    this.verifyGlobalSuperAdmin(req);
    return this.adminService.findGlobalAdmins(showArchived === 'true');
  }

  @Post('admin-users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a central dashboard admin account' })
  async createGlobalAdmin(
    @Req() req: any,
    @Body()
    body: {
      fullName: string;
      username: string;
      password: string;
      role: UserRole;
      email?: string;
      phone?: string;
    },
  ) {
    this.verifyGlobalSuperAdmin(req);
    return this.adminService.createGlobalAdmin(body, req.user as User);
  }

  @Put('admin-users/:id')
  @ApiOperation({ summary: 'Update a central dashboard admin account' })
  async updateGlobalAdmin(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      fullName?: string;
      username?: string;
      email?: string | null;
      phone?: string | null;
      role?: UserRole;
      isActive?: boolean;
      password?: string;
    },
  ) {
    this.verifyGlobalSuperAdmin(req);
    return this.adminService.updateGlobalAdmin(id, body, req.user as User);
  }

  @Delete('admin-users/:id')
  @ApiOperation({ summary: 'Archive a central dashboard admin account' })
  async deleteGlobalAdmin(@Req() req: any, @Param('id') id: string) {
    this.verifyGlobalSuperAdmin(req);
    await this.adminService.deleteGlobalAdmin(id, req.user as User);
    return { success: true, message: 'Admin account archived.' };
  }

  @Post('admin-users/:id/restore')
  @ApiOperation({ summary: 'Restore an archived central dashboard admin account' })
  async restoreGlobalAdmin(@Req() req: any, @Param('id') id: string) {
    this.verifyGlobalSuperAdmin(req);
    await this.adminService.restoreGlobalAdmin(id, req.user as User);
    return { success: true, message: 'Admin account restored.' };
  }

  @Post('admin-users/:id/reset-password')
  @ApiOperation({ summary: 'Generate a password reset PIN/link for an admin' })
  async triggerPasswordReset(@Req() req: any, @Param('id') id: string) {
    this.verifyGlobalSuperAdmin(req);
    return this.adminService.triggerPasswordReset(id, req.user as User);
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
    @Query('academicYear') academicYear?: string,
    @Query('termName') termName?: string,
    @Query('includeAll') includeAll?: string,
  ) {
    this.verifyGlobalAdmin(req);
    const { results, total } = await this.adminService.findAllTenants(
      timeframe,
      search,
      limit,
      offset,
      sort,
      cohort,
      academicYear,
      termName,
      includeAll === 'true',
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
      initials?: string;
      adminUsername: string;
      adminPasswordHash: string;
    },
  ) {
    this.verifyGlobalSuperAdmin(req);
    return this.adminService.onboardTenant(body);
  }

  @Get('tenants/check-unique')
  @ApiOperation({ summary: 'Check tenant subdomain slug and initials for uniqueness/conflicts' })
  async checkTenantUnique(
    @Req() req: any,
    @Query('slug') slug?: string,
    @Query('initials') initials?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    this.verifyGlobalAdmin(req);
    // Normalize inputs at the controller boundary for clarity
    const normalized = {
      slug: slug ? this.normalizeSlug(slug) : undefined,
      initials: initials ? this.normalizeInitials(initials) : undefined,
      excludeId,
    };
    return this.adminService.checkTenantUnique(normalized);
  }

  // Controller-level helpers mirror the service normalizers but avoid importing them.
  private normalizeSlug(v: string) {
    return v.toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  }

  private normalizeInitials(v: string) {
    return v.toString().trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
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
      initials?: string;
      logoUrl?: string;
      customDomain?: string;
    },
  ) {
    this.verifyGlobalSuperAdmin(req);
    return this.adminService.updateTenantBranding(id, body);
  }

  @Put('tenants/:id/status')
  @ApiOperation({ summary: 'Suspend or activate a school subscription' })
  async toggleTenantStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    this.verifyGlobalSuperAdmin(req);
    return this.adminService.toggleTenantStatus(id, body.isActive);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Fetch system-wide billing, MRR and health statistics',
  })
  async getStats(
    @Req() req: any, 
    @Query('timeframe') timeframe?: string,
    @Query('academicYear') academicYear?: string,
    @Query('termName') termName?: string,
  ) {
    this.verifyGlobalAdmin(req);
    return this.adminService.getSystemStats(timeframe, academicYear, termName);
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
    @Query('academicYear') academicYear?: string,
    @Query('termName') termName?: string,
  ) {
    this.verifyGlobalAdmin(req);
    return this.adminService.getEmployeeRankings(
      timeframe ?? '30d',
      sort ?? 'best',
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      search,
      school,
      academicYear,
      termName,
    );
  }

  @Delete('tenants/:id')
  @ApiOperation({
    summary: 'Permanently remove a school tenant and all associated data',
  })
  async deleteTenant(@Req() req: any, @Param('id') id: string) {
    this.verifyGlobalSuperAdmin(req);
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
    this.verifyGlobalAdmin(req, [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN]);
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
    this.verifyGlobalAdmin(req, [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN]);
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
    this.verifyGlobalAdmin(req, [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN]);
    return this.adminService.updateBulletin(id, body);
  }

  @Delete('bulletins/:id')
  @ApiOperation({ summary: 'Permanently remove a platform announcement' })
  async deleteBulletin(@Req() req: any, @Param('id') id: string) {
    this.verifyGlobalSuperAdmin(req);
    await this.adminService.deleteBulletin(id);
    return { success: true, message: 'Bulletin removed successfully.' };
  }

  // ── Global Employee Registry ────────────────────────────────────────────────

  @Get('employees')
  @ApiOperation({ summary: 'Fetch all employees across all tenants' })
  async getAllEmployees(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('schoolId') schoolId?: string,
    @Query('status') status?: string,
    @Query('isArchived') isArchived?: string,
  ) {
    this.verifyGlobalAdmin(req);
    // Parse comma-separated status values: e.g. "ACTIVE,SUSPENDED" or "INACTIVE"
    const statuses = status ? status.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const isArchivedBool = isArchived === 'true' ? true : isArchived === 'false' ? false : undefined;
    const result = await this.adminService.getAllGlobalEmployees(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      search,
      schoolId,
      statuses,
      isArchivedBool,
    );
    res.setHeader('x-total-count', result.total.toString());
    res.setHeader('Access-Control-Expose-Headers', 'x-total-count');
    return result;
  }

  @Put('employees/:id/status')
  @ApiOperation({ summary: 'Toggle an employee status globally (Suspend/Reactivate)' })
  async updateGlobalEmployeeStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    this.verifyGlobalSuperAdmin(req);
    return this.adminService.updateGlobalEmployeeStatus(id, body.status);
  }

  @Post('employees/:id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive (soft-delete) an employee with Super Admin password confirmation' })
  async archiveGlobalEmployee(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { password: string },
  ) {
    this.verifyGlobalSuperAdmin(req);
    if (!body.password) {
      throw new ForbiddenException('Password confirmation is required to archive an employee.');
    }
    await this.adminService.archiveGlobalEmployee(id, req.user as User, body.password);
    return { success: true, message: 'Employee archived successfully.' };
  }
}
