import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { BranchesModule } from './modules/branches/branches.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { AuditModule } from './modules/audit/audit.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { AcademicCalendarModule } from './modules/academic-calendar/academic-calendar.module';
import { SettingsModule } from './modules/settings/settings.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { SaasAdminModule } from './modules/saas-admin/saas-admin.module';
import { APP_GUARD } from '@nestjs/core';
import { ReadonlyImpersonationGuard } from './modules/auth/guards/readonly-impersonation.guard';
import { TenantSubscriber } from './common/tenant/tenant.subscriber';
import { TenantMiddleware } from './common/tenant/tenant.middleware';

@Module({
  imports: [
    // ── Config ────────────────────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Rate limiting ─────────────────────────────────────────────────────────
    // TTL is in seconds for @nestjs/throttler — use 60s window with 60 requests
    ThrottlerModule.forRoot({ ttl: 60, limit: 60 } as any),

    // ── Database ──────────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV', 'development');
        const dbPort =
          parseInt(config.get<string>('DB_PORT', '5432'), 10) || 5432;
        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: dbPort,
          username: config.get<string>('DB_USER', 'postgres'),
          password: config.get<string>('DB_PASS', 'postgres'),
          database: config.get<string>('DB_NAME', 'tk_clocking'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          // FIRST-DEPLOY: synchronize=true so TypeORM auto-creates all tables on
          // the empty Supabase DB. Disable this (set to false) after the first
          // successful deploy and re-deploy, or tables will be re-synced on every
          // restart (safe but slow).
          synchronize: true,
          logging: nodeEnv === 'development',
          // Fail fast on bad DB config — 3 retries × 3 s = ~9 s then crash with a
          // clear error rather than blocking the port for 15+ minutes on Render.
          retryAttempts: 3,
          retryDelay: 3000,
          // Enable SSL when DB_SSL=true (useful for Supabase / managed Postgres)
          ssl:
            config.get<string>('DB_SSL', 'false') === 'true'
              ? { rejectUnauthorized: false }
              : false,
        };
      },
    }),

    // ── Redis Cache & Queue ───────────────────────────────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (!redisUrl) {
          console.warn('REDIS_URL is not set. Bull Queue may fail to connect.');
          return { redis: { host: 'localhost', port: 6379 } };
        }
        return { redis: redisUrl };
      },
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (!redisUrl) {
          console.warn('REDIS_URL is not set. CacheManager falling back to in-memory.');
          return { ttl: 60 };
        }
        const { redisStore } = await import('cache-manager-redis-yet');
        return {
          store: await redisStore({ url: redisUrl }),
          ttl: 60000, // default 60s
        };
      },
    }),

    // ── Feature modules ───────────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    EmployeesModule,
    AttendanceModule,
    BranchesModule,
    DepartmentsModule,
    ShiftsModule,
    AuditModule,
    HolidaysModule,
    AcademicCalendarModule,
    SettingsModule,
    LeavesModule,
    NotificationsModule,
    TenantsModule,
    SaasAdminModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    TenantSubscriber,
    {
      provide: APP_GUARD,
      useClass: ReadonlyImpersonationGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
