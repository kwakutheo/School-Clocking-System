import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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
import { PermissionsGuard } from './modules/auth/guards/permissions.guard';
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
        const dbPort = parseInt(config.get<string>('DB_PORT', '5432'), 10) || 5432;
        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: dbPort,
          username: config.get<string>('DB_USER', 'postgres'),
          password: config.get<string>('DB_PASS', 'postgres'),
          database: config.get<string>('DB_NAME', 'tk_clocking'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: nodeEnv !== 'production',
          logging: nodeEnv === 'development',
          // Enable SSL when DB_SSL=true (useful for Supabase / managed Postgres)
          ssl: config.get<string>('DB_SSL', 'false') === 'true' ? { rejectUnauthorized: false } : false,
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
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}
