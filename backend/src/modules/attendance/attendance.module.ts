import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceLog } from './attendance-log.entity';
import { AttendanceDailySummary } from './attendance-daily-summary.entity';
import { Employee } from '../employees/employee.entity';
import { EmployeeStatusLog } from '../employees/employee-status-log.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceReportService } from './attendance-report.service';
import { AttendanceExportService } from './attendance-export.service';
import { AttendanceController } from './attendance.controller';
import { EmployeesModule } from '../employees/employees.module';
import { BranchesModule } from '../branches/branches.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { AcademicCalendarModule } from '../academic-calendar/academic-calendar.module';
import { AuditModule } from '../audit/audit.module';
import { LeavesModule } from '../leaves/leaves.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceLog,
      AttendanceDailySummary,
      Employee,
      EmployeeStatusLog,
    ]),
    EmployeesModule,
    BranchesModule,
    HolidaysModule,
    AcademicCalendarModule,
    AuditModule,
    LeavesModule,
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AttendanceReportService,
    AttendanceExportService,
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}
