import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({ example: 'Accra HQ' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 5.6037 })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ example: -0.1870 })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty({ example: 300 })
  @IsNumber()
  @IsNotEmpty()
  allowedRadius: number;
}
