import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { Employee } from './employee.entity';
import { EmployeeStatusLog } from './employee-status-log.entity';
import { User } from '../users/user.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'List employees (paginated, filterable)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiQuery({ name: 'roles', required: false, type: String })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('roles') roles?: string,
  ) {
    return this.service.findAll({
      page,
      limit,
      search,
      status,
      branchId,
      roles,
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current employee profile' })
  async getMe(@CurrentUser() user: { id: string }): Promise<Employee> {
    const emp = await this.service.findByUserId(user.id);
    if (!emp) throw new Error('Employee profile not found.');
    return emp;
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Get employee by ID' })
  findOne(@Param('id') id: string): Promise<Employee> {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('employees.create')
  @ApiOperation({ summary: 'Register new employee' })
  register(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() adminUser: User,
  ): Promise<Employee> {
    return this.service.createEmployeeWithUser(dto, adminUser);
  }

  @Post('me/photo')
  @ApiOperation({ summary: 'Upload or replace own profile photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(), // file goes into buffer — no disk writes
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Only JPEG, PNG, WEBP, or GIF images are allowed.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadPhoto(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Employee> {
    if (!file) {
      throw new BadRequestException('No file uploaded. Include a "photo" field.');
    }

    // Look up the employee to get their stable ID for the filename
    const employee = await this.service.findByUserId(user.id);
    if (!employee) {
      throw new BadRequestException('Employee profile not found.');
    }

    // ── Upload to Supabase Storage via REST API (no SDK / no WebSocket) ──────
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new BadRequestException(
        'Server storage is not configured. Contact your administrator.',
      );
    }

    const BUCKET = 'profile-photos';
    const ext = extname(file.originalname) || '.jpg';
    // Use employee.id as filename so re-uploads always overwrite the old photo
    const storagePath = `${employee.id}${ext}`;
    const storageBase = `${supabaseUrl}/storage/v1`;
    const authHeaders = {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    };

    // Ensure the bucket exists (409 Conflict is fine — it already exists)
    await fetch(`${storageBase}/bucket`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: BUCKET,
        name: BUCKET,
        public: true,
      }),
    });

    // Upload the file buffer directly (upsert=true overwrites existing).
    // Wrap Buffer in Uint8Array so TypeScript is happy with fetch's BodyInit type.
    const uploadRes = await fetch(
      `${storageBase}/object/${BUCKET}/${storagePath}`,
      {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': file.mimetype,
          'x-upsert': 'true',
        },
        body: new Uint8Array(file.buffer),
      },
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new BadRequestException(`Failed to upload photo: ${err}`);
    }

    // Build the permanent public CDN URL
    const photoUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;

    return this.service.updateProfile(user.id, { photoUrl });
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (self-service)' })
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProfileDto,
  ): Promise<Employee> {
    return this.service.updateProfile(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('employees.edit')
  @ApiOperation({ summary: 'Update employee details' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Request() req: any,
  ): Promise<Employee> {
    return this.service.update(id, dto, req.user);
  }

  @Post(':id/reset-password')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('employees.reset_password')
  @ApiOperation({ summary: 'Request employee password reset' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() adminUser: User,
  ): Promise<{ pin: string }> {
    return this.service.resetPassword(id, dto.adminPassword, adminUser);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('employees.delete')
  @ApiOperation({ summary: 'Delete employee' })
  remove(
    @Param('id') id: string,
    @CurrentUser() adminUser: User,
  ): Promise<void> {
    return this.service.remove(id, adminUser);
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Get current employee status history' })
  async getMyHistory(
    @CurrentUser() user: { id: string },
  ): Promise<EmployeeStatusLog[]> {
    const emp = await this.service.findByUserId(user.id);
    if (!emp) throw new Error('Employee profile not found.');
    return this.service.getStatusHistory(emp.id);
  }

  @Patch(':id/dashboard-access')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Block or restore dashboard access for HR/Supervisor',
  })
  setDashboardAccess(
    @Param('id') id: string,
    @Body() body: { blocked: boolean; reason?: string; adminPassword: string },
    @CurrentUser() adminUser: User,
  ): Promise<void> {
    return this.service.setDashboardBlock(
      id,
      body.blocked,
      body.reason,
      body.adminPassword,
      adminUser,
    );
  }

  @Get(':id/history')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('employees.view')
  @ApiOperation({ summary: 'Get employee status history by ID' })
  getHistory(@Param('id') id: string): Promise<EmployeeStatusLog[]> {
    return this.service.getStatusHistory(id);
  }
}
