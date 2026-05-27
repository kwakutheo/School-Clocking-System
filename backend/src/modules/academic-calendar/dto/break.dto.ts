import { IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBreakDto {
  @ApiProperty({ example: 'Mid-term break' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '2023-10-20' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2023-10-25' })
  @IsDateString()
  endDate: string;
}
