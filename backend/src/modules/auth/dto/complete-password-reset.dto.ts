import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompletePasswordResetDto {
  @ApiProperty({ example: 'jdoe' })
  @IsString()
  username!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  pin!: string;

  @ApiProperty({ example: 'NewPassword123' })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
