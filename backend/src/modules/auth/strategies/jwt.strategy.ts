import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { TenantsService } from '../../tenants/tenants.service';
import { EmployeesService } from '../../employees/employees.service';

export interface JwtPayload {
  sub: string; // user.id
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly employees: EmployeesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'MISSING_JWT_SECRET',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.users.findById(payload.sub);

    // isActive is set to false when a SaaS admin archives an employee —
    // this is the real-time session invalidation gate for already-logged-in users.
    if (!user || !user.isActive) {
      // Check if the account was specifically archived (not just deactivated at school level)
      // so the mobile app can show a targeted "removed from system" message.
      if (user) {
        const employee = await this.employees
          .findByUserIdIncludingArchived(user.id)
          .catch(() => null);
        if (employee?.isArchived) {
          throw new UnauthorizedException(
            'ACCOUNT_ARCHIVED: Your account has been permanently removed from this system by the platform administrator.',
          );
        }
      }
      throw new UnauthorizedException('Session is no longer valid.');
    }

    // Check if school subscription is active (suspended check)
    if (user.tenantId) {
      const tenant = await this.tenantsService
        .findById(user.tenantId)
        .catch(() => null);
      if (tenant && !tenant.isActive) {
        throw new UnauthorizedException(
          'Your school subscription is suspended. Please contact the platform administrator.',
        );
      }
    }

    return user; // attached to req.user
  }
}
