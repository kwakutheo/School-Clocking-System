import { Controller, Get, Post, Patch, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HolidaysService } from './holidays.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UserRole } from '../../common/enums';
import { Holiday } from './holiday.entity';

@ApiTags('Holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly service: HolidaysService) {}

  @Get()
  @ApiOperation({ summary: 'List all holidays' })
  findAll() {
    return this.service.findAll();
  }

  @Get('current-year')
  @ApiOperation({ summary: 'List holidays for the current calendar year (includes all recurring holidays)' })
  findCurrentYear() {
    return this.service.findCurrentYear();
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('holidays.manage')
  @ApiOperation({ summary: 'Create a holiday' })
  create(@Body() data: Partial<Holiday>) {
    return this.service.create(data);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('holidays.manage')
  @ApiOperation({ summary: 'Update a holiday' })
  update(@Param('id') id: string, @Body() data: Partial<Holiday>) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('holidays.manage')
  @ApiOperation({ summary: 'Delete a holiday' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
