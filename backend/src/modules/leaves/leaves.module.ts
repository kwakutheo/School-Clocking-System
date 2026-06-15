import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequest } from './leave-request.entity';
import { Employee } from '../employees/employee.entity';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcademicCalendarModule } from '../academic-calendar/academic-calendar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveRequest, Employee]),
    NotificationsModule,
    AcademicCalendarModule,
  ],
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
