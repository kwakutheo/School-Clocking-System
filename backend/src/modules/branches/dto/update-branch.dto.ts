import {
  IsString,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: 'Accra HQ' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 5.6037 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: -0.1870 })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: 300 })
  @IsNumber()
  @IsOptional()
  allowedRadius?: number;
}
