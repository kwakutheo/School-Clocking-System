import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UserRole } from '../../common/enums';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

@ApiTags('Shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  @Get()
  @ApiOperation({ summary: 'List all shifts' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get shift details' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Create a shift' })
  create(@Body() body: CreateShiftDto) { return this.service.create(body); }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Update a shift' })
  update(@Param('id') id: string, @Body() body: UpdateShiftDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('shifts.manage')
  @ApiOperation({ summary: 'Delete a shift' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
