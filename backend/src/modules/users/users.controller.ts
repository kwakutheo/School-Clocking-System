import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('check-username')
  @ApiOperation({
    summary: 'Check if a username is available, get suggestions if taken',
  })
  async checkUsername(
    @Query('username') username: string,
    @Query('fullName') fullName?: string,
  ) {
    if (!username) {
      return { available: false };
    }
    return this.usersService.checkUsernameAvailability(username, fullName);
  }

  @Post(':id/unlock')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @ApiOperation({
    summary: 'Unlock an employee account that has been rate-limited',
  })
  @ApiResponse({ status: 200, description: 'Account successfully unlocked' })
  async unlockUser(@Param('id') id: string) {
    const user = await this.usersService.unlockUser(id);
    return {
      message: 'Account successfully unlocked.',
      user: this.usersService.toPublic(user),
    };
  }
}
