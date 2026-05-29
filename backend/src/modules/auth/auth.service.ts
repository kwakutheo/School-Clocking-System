import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { CompletePasswordResetDto } from './dto/complete-password-reset.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { User } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../../common/enums';
import * as nodemailer from 'nodemailer';
import { EmployeesService } from '../employees/employees.service';
import { TenantsService } from '../tenants/tenants.service';
import { tenantLocalStorage } from '../../common/tenant/tenant.context';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly employees: EmployeesService,
    private readonly tenantsService: TenantsService,
  ) {}

  // ── Validate credentials (used by LocalStrategy) ──────────────────────────
  async validateUser(
    identifier: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.users.findByIdentifier(identifier);
    if (!user) return null;

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) return null;

    // Enforce tenant boundary: standard school users must match the login portal's tenant slug context
    const activeTenantId = tenantLocalStorage.getStore();
    if (activeTenantId && user.tenantId !== activeTenantId) {
      throw new UnauthorizedException(
        'Access denied: You do not belong to this school dashboard.',
      );
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

    // Check employee status before allowing login
    const employee = await this.employees
      .findByUserId(user.id)
      .catch(() => null);
    if (employee && employee.status === 'inactive') {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact your HR administrator for assistance.',
      );
    }
    if (employee && employee.status === 'suspended') {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact your HR administrator for assistance.',
      );
    }

    return user;
  }

  // ── Login — returns access + refresh tokens ────────────────────────────────
  async login(user: User) {
    const payload = { sub: user.id, role: user.role, tenantId: user.tenantId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '8h'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    const publicUser = this.users.toPublic(user);

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

    const employee = await this.employees
      .findByUserId(user.id)
      .catch(() => null);

    if (employee && employee.status !== 'active') {
      throw new UnauthorizedException(
        `Account disabled or suspended. Status: ${employee.status}. Please contact HR.`,
      );
    }

    if (employee) {
      (publicUser as any).employeeId = employee.id;
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: publicUser,
    };
  }

  // ── Refresh Token ──────────────────────────────────────────────────────────
  async refresh(refreshToken: string) {
    try {
      // Verify the refresh token
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      // Find the user
      const user = await this.users.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found.');
      }

      // Re-issue tokens
      return this.login(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  // ── Register ───────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    if (!dto.username && !dto.email && !dto.phone) {
      throw new ConflictException('Username, email or phone is required.');
    }

    // Check for existing account.
    if (dto.username) {
      const existing = await this.users.findByUsername(dto.username);
      if (existing) throw new ConflictException('Username already in use.');
    }
    if (dto.email) {
      const existing = await this.users.findByIdentifier(dto.email);
      if (existing) throw new ConflictException('Email already in use.');
    }
    if (dto.phone) {
      const existing = await this.users.findByIdentifier(dto.phone);
      if (existing) throw new ConflictException('Phone number already in use.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.users.create({
      fullName: dto.fullName,
      username: dto.username,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: dto.role,
    });

    return this.login(user);
  }

  // ── Get current user ───────────────────────────────────────────────────────
  async me(user: User) {
    const publicUser = this.users.toPublic(user);
    const employee = await this.employees
      .findByUserId(user.id)
      .catch(() => null);
    if (employee) {
      (publicUser as any).employeeId = employee.id;
    }
    return publicUser;
  }

  // ── Request Password Reset ──────────────────────────────────────────────────
  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const user = await this.users.findByIdentifier(dto.email);

    // We only allow this for dashboard users.
    if (
      !user ||
      ![UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.SUPERVISOR].includes(
        user.role,
      )
    ) {
      // Return a successful response anyway to prevent email enumeration.
      return {
        message: 'If that email is registered, a reset link has been sent.',
      };
    }

    // Generate 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    // Update user in database
    await this.users.update(user.id, {
      resetPin: pin,
      requiresPasswordChange: true,
    });

    // Send email
    const hasSmtpConfig = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

    if (!hasSmtpConfig) {
      // For local development or when SMTP is not configured, log the PIN
      console.warn(
        '\n========================================================',
      );
      console.warn(`⚠️ SMTP credentials not configured in .env file!`);
      console.warn(`Email would have been sent to: ${user.email}`);
      console.warn(`Password Reset PIN is: ${pin}`);
      console.warn(
        '========================================================\n',
      );
    } else {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      try {
        await transporter.sendMail({
          from: `"TK Clocking" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: 'Password Reset Request',
          html: `
            <h3>Password Reset</h3>
            <p>Hello ${user.fullName},</p>
            <p>You requested a password reset. Your reset PIN is:</p>
            <h2 style="color: #4F46E5; letter-spacing: 2px;">${pin}</h2>
            <p>If you did not request this, please ignore this email.</p>
          `,
        });
      } catch (error) {
        console.error('Failed to send email:', error);
      }
    }

    return {
      message: 'If that email is registered, a reset link has been sent.',
    };
  }

  // ── Complete Password Reset ────────────────────────────────────────────────
  async completePasswordReset(dto: CompletePasswordResetDto) {
    const user = await this.users.findByUsername(dto.username);
    if (!user)
      throw new UnauthorizedException(
        'Username not found. Please check your username and try again.',
      );

    if (!user.requiresPasswordChange || user.resetPin !== dto.pin) {
      throw new UnauthorizedException('Invalid PIN or no reset requested.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.users.update(user.id, {
      passwordHash,
      resetPin: null,
      requiresPasswordChange: false,
    });

    await this.auditService.log({
      user: user,
      action: 'COMPLETE_PASSWORD_RESET',
      module: 'AUTH',
      targetId: user.id,
    });

    return { message: 'Password has been reset successfully.' };
  }

  async updateFcmToken(userId: string, token: string | null): Promise<void> {
    await this.users.updateFcmToken(userId, token);
  }
}
