import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceType } from '../../../common/enums';

export class AdminManualClockDto {
  /** The Employee ID (not User ID) of the target employee. */
  @ApiProperty({ description: 'Employee ID of the target employee' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ enum: AttendanceType, description: 'CLOCK_IN or CLOCK_OUT' })
  @IsEnum(AttendanceType)
  type: AttendanceType;

  /** Optional: defaults to now. Allows backdating (e.g. "he arrived at 08:05"). */
  @ApiPropertyOptional({ description: 'ISO8601 timestamp — defaults to now if omitted' })
  @IsDateString()
  @IsOptional()
  timestamp?: string;

  /** Required reason for the audit trail. */
  @ApiProperty({ description: 'Reason for the manual override (shown in audit log)' })
  @IsString()
  @IsNotEmpty()
  note: string;
}
