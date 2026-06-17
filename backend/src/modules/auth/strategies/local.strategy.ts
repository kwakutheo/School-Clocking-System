import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from '../../users/user.entity';
import { Request } from 'express';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly auth: AuthService) {
    // passport-local expects 'username' by default; we rename to 'identifier'.
    // passReqToCallback gives us access to the full request (including body.context).
    super({ usernameField: 'identifier', passReqToCallback: true });
  }

  async validate(
    req: Request,
    identifier: string,
    password: string,
  ): Promise<User> {
    // 'context' is sent by web dashboards as 'central_dashboard'.
    // Mobile app logins do not send this field, so it will be undefined.
    const context = req.body?.context as string | undefined;
    const user = await this.auth.validateUser(identifier, password, context);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    return user;
  }
}
