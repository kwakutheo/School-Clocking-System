import { IsString, IsNotEmpty, IsDateString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTermDto {
  @ApiProperty({ example: 'Term 1' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '2023/2024' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ example: '2023-09-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2023-12-15' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTermDto extends CreateTermDto {}
