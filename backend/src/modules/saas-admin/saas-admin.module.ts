import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaasAdminController } from './saas-admin.controller';
import { SaasAdminService } from './saas-admin.service';
import { AttendanceSummaryJob } from './attendance-summary.job';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { Employee } from '../employees/employee.entity';
import { EmployeeStatusLog } from '../employees/employee-status-log.entity';
import { Branch } from '../branches/branch.entity';
import { Department } from '../departments/department.entity';
import { Shift } from '../shifts/shift.entity';
import { SystemBulletin } from './system-bulletin.entity';
import { Holiday } from '../holidays/holiday.entity';
import { AttendanceLog } from '../attendance/attendance-log.entity';
import { AttendanceDailySummary } from '../attendance/attendance-daily-summary.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      User,
      Employee,
      EmployeeStatusLog,
      Branch,
      Department,
      Shift,
      SystemBulletin,
      Holiday,
      AttendanceLog,
      AttendanceDailySummary,
    ]),
  ],
  controllers: [SaasAdminController],
  providers: [SaasAdminService, AttendanceSummaryJob],
  exports: [SaasAdminService, TypeOrmModule],
})
export class SaasAdminModule {}
