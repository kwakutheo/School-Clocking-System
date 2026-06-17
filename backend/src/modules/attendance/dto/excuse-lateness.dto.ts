import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExcuseLatenessDto {
  @ApiProperty({
    description: 'Reason for excusing the lateness',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
