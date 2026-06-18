import {
  IsString,
  IsEnum,
  IsOptional,
  IsISO8601,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceType } from '../../../common/enums';

export class QrClockDto {
  @IsString()
  qrCode: string;

  @IsEnum(AttendanceType)
  type: AttendanceType;

  @IsOptional()
  @IsISO8601()
  timestamp?: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  forceEarlyOut?: boolean;

  @ApiPropertyOptional({ description: 'Unique device identifier for restriction checks' })
  @IsString()
  @IsOptional()
  deviceId?: string;
}
