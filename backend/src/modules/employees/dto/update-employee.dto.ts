import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsISO8601,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, EmployeeStatus } from '../../../common/enums';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'Kofi Mensah' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: 'kofi.mensah' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ example: '+233244123456' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'TK-0042' })
  @IsString()
  @IsOptional()
  employeeCode?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  @IsOptional()
  shiftId?: string;

  @ApiPropertyOptional({ example: 'Field Engineer' })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsISO8601()
  @IsOptional()
  hireDate?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;
}
