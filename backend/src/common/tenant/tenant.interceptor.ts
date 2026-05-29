import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantLocalStorage } from './tenant.context';
import { TenantsService } from '../../modules/tenants/tenants.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantsService: TenantsService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    let tenantId = request.user?.tenantId;
    const isGlobalSuperAdmin =
      request.user?.role === 'super_admin' && !request.user?.tenantId;

    // If not in user context and not global super admin, try reading headers
    if (!tenantId && !isGlobalSuperAdmin) {
      const headerTenantId = request.headers['x-tenant-id'];
      if (headerTenantId) {
        tenantId = headerTenantId;
      } else {
        const headerSlug = request.headers['x-tenant-slug'];
        if (headerSlug) {
          try {
            const tenant = await this.tenantsService.findBySlug(headerSlug);
            tenantId = tenant.id;
          } catch (e) {
            // Ignore error here and let guards/controllers handle it
          }
        }
      }
    }

    return new Observable((subscriber) => {
      tenantLocalStorage.run(tenantId, () => {
        next.handle().subscribe({
          next: (val) => subscriber.next(val),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
