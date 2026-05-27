import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RecordAttendanceDto } from './record-attendance.dto';

export class SyncOfflineDto {
  @ApiProperty({ type: [RecordAttendanceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordAttendanceDto)
  records: RecordAttendanceDto[];
}
