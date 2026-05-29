import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('check-username')
  @ApiOperation({ summary: 'Check if a username is available, get suggestions if taken' })
  async checkUsername(
    @Query('username') username: string,
    @Query('fullName') fullName?: string,
  ) {
    if (!username) {
      return { available: false };
    }
    return this.usersService.checkUsernameAvailability(username, fullName);
  }
}
