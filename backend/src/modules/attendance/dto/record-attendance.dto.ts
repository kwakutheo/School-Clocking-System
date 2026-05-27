import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceType } from '../../../common/enums';

export class RecordAttendanceDto {
  @ApiProperty({ enum: AttendanceType })
  @IsEnum(AttendanceType)
  type: AttendanceType;

  @ApiPropertyOptional({ description: 'ISO8601 timestamp (for offline sync)' })
  @IsDateString()
  @IsOptional()
  timestamp?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'True when submitted from offline queue' })
  @IsBoolean()
  @IsOptional()
  isOfflineSync?: boolean;

  @ApiPropertyOptional({ description: 'True to confirm an early clock-out' })
  @IsBoolean()
  @IsOptional()
  forceEarlyOut?: boolean;
}
