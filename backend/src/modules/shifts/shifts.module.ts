import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from './shift.entity';
import { Employee } from '../employees/employee.entity';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { AcademicCalendarModule } from '../academic-calendar/academic-calendar.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shift, Employee]),
    AcademicCalendarModule,
    UsersModule,
  ],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
