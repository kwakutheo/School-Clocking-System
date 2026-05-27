import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

import { User } from '../src/modules/users/user.entity';
import { Employee } from '../src/modules/employees/employee.entity';
import { Department } from '../src/modules/departments/department.entity';
import { Branch } from '../src/modules/branches/branch.entity';
import { Shift } from '../src/modules/shifts/shift.entity';
import { UserRole, EmployeeStatus } from '../src/common/enums';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'tk_clocking',
  entities: [User, Employee, Department, Branch, Shift],
  synchronize: false,
  logging: false,
});

async function restore() {
  await AppDataSource.initialize();
  console.log('🔧 Connected to database. Starting restore…\n');

  const userRepo = AppDataSource.getRepository(User);
  const employeeRepo = AppDataSource.getRepository(Employee);
  const deptRepo = AppDataSource.getRepository(Department);
  const branchRepo = AppDataSource.getRepository(Branch);
  const shiftRepo = AppDataSource.getRepository(Shift);

  const hash = (pw: string) => bcrypt.hash(pw, 12);

  // ── Departments (upsert) ────────────────────────────────────────────────────
  console.log('Restoring departments…');
  const deptNames = ['Operations', 'Finance & Accounts', 'Engineering'];
  for (const name of deptNames) {
    const existing = await deptRepo.findOne({ where: { name } });
    if (!existing) await deptRepo.save(deptRepo.create({ name }));
  }
  const departments = await deptRepo.find({ where: deptNames.map((name) => ({ name })) });
  const operations = departments.find((d) => d.name === 'Operations')!;
  const finance = departments.find((d) => d.name === 'Finance & Accounts')!;
  const engineering = departments.find((d) => d.name === 'Engineering')!;

  // ── Branches (upsert) ───────────────────────────────────────────────────────
  console.log('Restoring branches…');
  const branchData = [
    { name: 'Accra HQ', latitude: 5.6037, longitude: -0.187, allowedRadius: 100 },
    { name: 'Kumasi Office', latitude: 6.6885, longitude: -1.6244, allowedRadius: 100 },
  ];
  for (const b of branchData) {
    const existing = await branchRepo.findOne({ where: { name: b.name } });
    if (!existing) await branchRepo.save(branchRepo.create(b));
  }
  const branches = await branchRepo.find({ where: branchData.map((b) => ({ name: b.name })) });
  const accraHQ = branches.find((b) => b.name === 'Accra HQ')!;
  const kumasiOffice = branches.find((b) => b.name === 'Kumasi Office')!;

  // ── Shifts (upsert) ─────────────────────────────────────────────────────────
  console.log('Restoring shifts…');
  const shiftData = [
    { name: 'Morning Shift', startTime: '08:00', endTime: '17:00', graceMinutes: 15 },
    { name: 'Evening Shift', startTime: '14:00', endTime: '22:00', graceMinutes: 10 },
  ];
  for (const s of shiftData) {
    const existing = await shiftRepo.findOne({ where: { name: s.name } });
    if (!existing) await shiftRepo.save(shiftRepo.create(s));
  }

  // ── Users & Employees ───────────────────────────────────────────────────────
  console.log('Restoring users and employee profiles…');

  const usersData = [
    {
      fullName: 'Kwame Asante',
      email: 'kwame@tkclocking.dev',
      phone: '+233244000001',
      password: 'Admin@1234',
      role: UserRole.SUPER_ADMIN,
      employeeCode: 'TK-0001',
      department: operations,
      branch: accraHQ,
      position: 'System Administrator',
    },
    {
      fullName: 'Abena Mensah',
      email: 'abena@tkclocking.dev',
      phone: '+233244000002',
      password: 'HrAdmin@1234',
      role: UserRole.HR_ADMIN,
      employeeCode: 'TK-0002',
      department: finance,
      branch: accraHQ,
      position: 'HR Manager',
    },
    {
      fullName: 'Kofi Boateng',
      email: 'kofi@tkclocking.dev',
      phone: '+233244000003',
      password: 'Supervisor@1234',
      role: UserRole.SUPERVISOR,
      employeeCode: 'TK-0003',
      department: engineering,
      branch: accraHQ,
      position: 'Engineering Supervisor',
    },
    {
      fullName: 'Ama Owusu',
      email: 'ama@tkclocking.dev',
      phone: '+233244000004',
      password: 'Employee@1234',
      role: UserRole.EMPLOYEE,
      employeeCode: 'TK-0004',
      department: engineering,
      branch: accraHQ,
      position: 'Software Engineer',
    },
    {
      fullName: 'Yaw Darko',
      email: 'yaw@tkclocking.dev',
      phone: '+233244000005',
      password: 'Employee@1234',
      role: UserRole.EMPLOYEE,
      employeeCode: 'TK-0005',
      department: operations,
      branch: kumasiOffice,
      position: 'Operations Officer',
    },
  ];

  for (const data of usersData) {
    let user = await userRepo.findOne({ where: { email: data.email } });
    if (!user) {
      user = await userRepo.save(
        userRepo.create({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          passwordHash: await hash(data.password),
          role: data.role,
        }),
      );
      console.log(`  ✅ User created: ${data.fullName}`);
    } else {
      console.log(`  ⏭  User exists: ${data.fullName}`);
    }

    let employee = await employeeRepo.findOne({ where: { employeeCode: data.employeeCode } });
    if (!employee) {
      const newEmp = employeeRepo.create({
        employeeCode: data.employeeCode,
        department: data.department,
        branch: data.branch,
        position: data.position,
        hireDate: new Date('2024-01-01'),
        status: EmployeeStatus.ACTIVE,
      });
      newEmp.user = user;
      await employeeRepo.save(newEmp);
      console.log(`     ✅ Employee profile created`);
    } else {
      console.log(`     ⏭  Employee profile exists`);
    }
  }

  console.log('\n🎉 Restore completed!\n');
  console.log('─────────────────────────────────────────');
  console.log('Test credentials (username / password):');
  console.log('  Super Admin : asante      / Admin@1234');
  console.log('  HR Admin    : mensah      / HrAdmin@1234');
  console.log('  Supervisor  : boateng     / Supervisor@1234');
  console.log('  Employee    : owusu       / Employee@1234');
  console.log('  Employee    : darko       / Employee@1234');
  console.log('─────────────────────────────────────────\n');

  await AppDataSource.destroy();
}

restore().catch((err) => {
  console.error('❌ Restore failed:', err);
  process.exit(1);
});
