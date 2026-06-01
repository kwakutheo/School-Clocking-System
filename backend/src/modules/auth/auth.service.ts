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

    if (activeTenantId) {
      // Subdomain login: User must belong to this specific tenant
      if (user.tenantId !== activeTenantId) {
        throw new UnauthorizedException(
          'Access denied: You do not belong to this school dashboard.',
        );
      }
    } else {
      // Main domain login: Only global/SaaS admins (tenantId === null) are allowed
      if (user.tenantId !== null) {
        throw new UnauthorizedException(
          'Access denied: Please log in through your specific school portal.',
        );
      }
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

    await this.users.update(user.id, { lastLoginAt: new Date() } as any);

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
    const hashedPin = await bcrypt.hash(pin, SALT_ROUNDS);
    
    // Expires in 15 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Update user in database and send email inside the user's tenant context so
    // any tenant-aware side-effects (audit logs, triggers) are properly
    // associated with the correct tenant.
    await new Promise<void>((resolve, reject) => {
      tenantLocalStorage.run(user.tenantId, async () => {
        try {
          await this.users.update(user.id, {
            resetPin: hashedPin,
            resetPinExpiresAt: expiresAt,
            resetPinAttempts: 0,
            requiresPasswordChange: true,
          });

          // Send email
          const hasSmtpConfig = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

          if (!hasSmtpConfig) {
            // For local development or when SMTP is not configured, log the PIN
            console.warn('\n========================================================');
            console.warn(`\u26A0\uFE0F SMTP credentials not configured in .env file!`);
            console.warn(`Email would have been sent to: ${user.email}`);
            console.warn(`Password Reset PIN is: ${pin}`);
            console.warn('========================================================\n');
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
                to: dto.email,
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

          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });

    return {
      message: 'If that email is registered, a reset link has been sent.',
    };
  }

  // ── Complete Password Reset ────────────────────────────────────────────────
  async completePasswordReset(dto: CompletePasswordResetDto) {
    const user = await this.users.findByUsername(dto.username);
    const genericErrorMessage = 'Invalid username or PIN, or reset not requested.';

    if (!user) {
      // Simulate bcrypt delay to prevent timing attacks for username enumeration
      await bcrypt.compare(dto.pin, '$2b$12$invalidhashinvalidhashinvalidhashinvalidhashinvalidhas');
      throw new UnauthorizedException(genericErrorMessage);
    }

    // Execute password update inside the user's tenant context so the change
    // and audit log are associated with the correct tenant and do not affect
    // other tenants.
    return await new Promise<any>((resolve, reject) => {
      tenantLocalStorage.run(user.tenantId, async () => {
        try {
          if (!user.requiresPasswordChange || !user.resetPin || !user.resetPinExpiresAt) {
            reject(new UnauthorizedException(genericErrorMessage));
            return;
          }

          if (new Date() > user.resetPinExpiresAt) {
            // Expired PIN, clean up
            await this.users.update(user.id, {
              resetPin: null,
              resetPinExpiresAt: null,
              resetPinAttempts: 0,
              requiresPasswordChange: false,
            });
            reject(new UnauthorizedException('PIN has expired. Please request a new one.'));
            return;
          }

          if (user.resetPinAttempts >= 3) {
            // Max attempts reached, clean up
            await this.users.update(user.id, {
              resetPin: null,
              resetPinExpiresAt: null,
              resetPinAttempts: 0,
              requiresPasswordChange: false,
            });
            reject(new UnauthorizedException('Maximum attempts exceeded. Please request a new PIN.'));
            return;
          }

          const isValidPin = await bcrypt.compare(dto.pin, user.resetPin);
          if (!isValidPin) {
            await this.users.update(user.id, {
              resetPinAttempts: user.resetPinAttempts + 1,
            });
            reject(new UnauthorizedException(genericErrorMessage));
            return;
          }

          const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
          await this.users.update(user.id, {
            passwordHash,
            resetPin: null,
            resetPinExpiresAt: null,
            resetPinAttempts: 0,
            requiresPasswordChange: false,
          });

          await this.auditService.log({
            user: user,
            action: 'COMPLETE_PASSWORD_RESET',
            module: 'AUTH',
            targetId: user.id,
          });

          resolve({ message: 'Password has been reset successfully.' });
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  async updateFcmToken(userId: string, token: string | null): Promise<void> {
    await this.users.updateFcmToken(userId, token);
  }
}
