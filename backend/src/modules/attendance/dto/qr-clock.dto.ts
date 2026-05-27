import { IsString, IsEnum, IsOptional, IsISO8601, IsNumber } from 'class-validator';
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
}
