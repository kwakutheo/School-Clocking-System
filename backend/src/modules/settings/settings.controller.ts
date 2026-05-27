import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UserRole } from '../../common/enums';

const PERMISSIONS_KEY = 'role_permissions';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'Get role permissions matrix (all authenticated users)' })
  async getPermissions() {
    const raw = await this.service.get(PERMISSIONS_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  @Patch('permissions')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Update role permissions matrix' })
  async updatePermissions(@Body() body: Record<string, string[]>) {
    await this.service.set(PERMISSIONS_KEY, JSON.stringify(body));
    return { message: 'Permissions updated successfully' };
  }
}
