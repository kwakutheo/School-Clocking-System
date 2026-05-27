import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UserRole } from '../../common/enums';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all departments' })
  findAll() { return this.service.findAll(); }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('departments.manage')
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto) { return this.service.create(dto.name); }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('departments.manage')
  @ApiOperation({ summary: 'Update a department' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) { return this.service.update(id, dto.name!); }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('departments.manage')
  @ApiOperation({ summary: 'Delete a department' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
