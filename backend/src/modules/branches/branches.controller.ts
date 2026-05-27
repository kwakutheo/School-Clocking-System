import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { Branch } from './branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { RegenerateQrDto } from './dto/regenerate-qr.dto';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Get()
  @ApiOperation({ summary: 'List all branches' })
  findAll(): Promise<Branch[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a branch by ID' })
  findOne(@Param('id') id: string): Promise<Branch> {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('branches.manage')
  @ApiOperation({ summary: 'Create a branch' })
  create(@Body() dto: CreateBranchDto): Promise<Branch> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('branches.manage')
  @ApiOperation({ summary: 'Update a branch' })
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto): Promise<Branch> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('branches.manage')
  @ApiOperation({ summary: 'Delete a branch' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Post(':id/qr-code')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('branches.manage')
  @ApiOperation({ summary: 'Regenerate QR code for a branch' })
  regenerateQr(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RegenerateQrDto,
  ): Promise<Branch> {
    return this.service.generateQrCode(id, user.id, dto.password);
  }

  @Get(':id/qr-code')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('branches.manage')
  @ApiOperation({ summary: 'Get current QR code for a branch' })
  async getQr(@Param('id') id: string): Promise<{ qrCode: string | null }> {
    const branch = await this.service.findById(id);
    return { qrCode: branch.qrCode };
  }
}
