import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from './shift.entity';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { AcademicCalendarModule } from '../academic-calendar/academic-calendar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shift]),
    AcademicCalendarModule,
  ],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
