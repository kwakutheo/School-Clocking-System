import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { TenantsService } from '../../tenants/tenants.service';

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
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'MISSING_JWT_SECRET',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
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
