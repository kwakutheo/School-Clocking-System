import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MinLength,
  IsEnum,
  IsISO8601,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Kofi Mensah' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'kofi.mensah' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: 'TK-0042' })
  @IsString()
  @IsOptional()
  employeeCode?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  @IsNotEmpty()
  shiftId: string;

  @ApiPropertyOptional({ example: 'Field Engineer' })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsISO8601()
  @IsOptional()
  hireDate?: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.EMPLOYEE })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
