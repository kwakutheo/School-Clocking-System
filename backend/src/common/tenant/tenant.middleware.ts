import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantLocalStorage } from './tenant.context';
import { TenantsService } from '../../modules/tenants/tenants.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantsService: TenantsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 0. Bypass CORS preflight requests
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    let tenantId: string | null = null;
    let hasResolved = false;

    // 1. Try to extract from JWT authorization token
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded: any = jwt.decode(token);
        if (decoded) {
          if (decoded.role === 'super_admin' && !decoded.tenantId) {
            // ONLY Global SaaS Super Admin has role 'super_admin' AND no tenantId
            tenantId = null;
            hasResolved = true;

            // Check if super_admin is impersonating/viewing a specific tenant
            const impersonatedTenantId = req.headers['x-tenant-id'] as string;
            if (impersonatedTenantId) {
              tenantId = impersonatedTenantId;
            } else {
              const impersonatedSlug = req.headers['x-tenant-slug'] as string;
              if (impersonatedSlug) {
                try {
                  const tenant = await this.tenantsService.findBySlug(impersonatedSlug);
                  tenantId = tenant.id;
                } catch (e) {
                  // Ignored
                }
              }
            }
          } else if (decoded.hasOwnProperty('tenantId')) {
            tenantId = decoded.tenantId;
            hasResolved = true;
          }
        }
      } catch (e) {
        // Ignored
      }
    }

    // 2. Fall back to custom headers
    if (!hasResolved) {
      const headerTenantId = req.headers['x-tenant-id'] as string;
      if (headerTenantId) {
        tenantId = headerTenantId;
        hasResolved = true;
      } else {
        const headerSlug = req.headers['x-tenant-slug'] as string;
        if (headerSlug) {
          try {
            const tenant = await this.tenantsService.findBySlug(headerSlug);
            tenantId = tenant.id;
            hasResolved = true;
          } catch (e) {
            // Ignored
          }
        }
      }
    }

    // 2.5 Bypass local dev default sandbox for global endpoints
    const isGlobalRoute = req.originalUrl.includes('/saas-admin') || 
                          (req.originalUrl.includes('/auth/login') && !tenantId) ||
                          req.originalUrl.includes('/api/docs') ||
                          req.originalUrl.includes('/health');
    if (isGlobalRoute) {
      tenantId = null;
      hasResolved = true;
    }

    // 3. Strict Tenant Resolution Check (Fail-Fast)
    if (!hasResolved && !isGlobalRoute && req.originalUrl.includes('/api/v1')) {
      throw new BadRequestException('School tenant context could not be resolved. Please specify a valid tenant context.');
    }

    console.log(`🔌 [Tenant Middleware] Active request URL: ${req.originalUrl} | Bound Tenant ID: ${tenantId}`);

    // 4. Run request synchronously inside AsyncLocalStorage context
    tenantLocalStorage.run(tenantId, () => {
      next();
    });
  }
}
