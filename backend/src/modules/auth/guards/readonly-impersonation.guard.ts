import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class ReadonlyImpersonationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, headers } = request;

    // Mutating methods
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isMutating) {
      return true;
    }

    // Allow auth and saas-admin endpoints to be mutated by Super Admins
    const isSaaSOrAuth =
      originalUrl.includes('/saas-admin') || originalUrl.includes('/auth');
    if (isSaaSOrAuth) {
      return true;
    }

    // Check if there is an active impersonation context (header x-tenant-id or x-tenant-slug)
    const hasImpersonationHeader = !!(
      headers['x-tenant-id'] || headers['x-tenant-slug']
    );
    if (!hasImpersonationHeader) {
      return true;
    }

    // Decode JWT to check if the user is a super admin
    const authHeader = headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded: any = jwt.decode(token);
        if (decoded && decoded.role === 'super_admin' && !decoded.tenantId) {
          // A super_admin impersonating a tenant cannot perform mutating requests
          throw new ForbiddenException(
            'This portal is in view-only mode for Super Admins. Modifications are disabled.',
          );
        }
      } catch (e) {
        // Ignore decoding errors and let JwtAuthGuard handle it
      }
    }

    return true;
  }
}
