import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { SettingsService } from '../../settings/settings.service';
import { UserRole } from '../../../common/enums';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private settingsService: SettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      return false;
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const rawPermissions = await this.settingsService.get('role_permissions');
    let matrix = {};
    try {
      matrix = rawPermissions ? JSON.parse(rawPermissions) : {};
    } catch (error) {
      console.error('Failed to parse role_permissions settings JSON:', error);
    }

    // Check if the user's role has ALL the required permissions
    const userPermissions: string[] = matrix[user.role] || [];
    const hasPermission = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    return true;
  }
}
