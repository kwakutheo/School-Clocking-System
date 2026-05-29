/**
 * Bulk seed: 1000 schools, 15 employees each
 *
 * Role breakdown per school:
 *   2 × super_admin, 2 × hr_admin, 2 × supervisor, 9 × employee
 *
 * Usernames:  surname_N  (e.g. mensah_1, asante_1) — globally unique
 * Password:   123456  (bcrypt-hashed once and reused)
 *
 * Run:  npx ts-node -r tsconfig-paths/register src/seed-large.ts
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { Tenant } from './modules/tenants/tenant.entity';
import { User } from './modules/users/user.entity';
import { Employee } from './modules/employees/employee.entity';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

// ── 15 Ghanaian surnames — one per employee slot ─────────────────────────
const SURNAMES = [
  'Mensah',
  'Asante', // super_admin × 2
  'Boateng',
  'Darko', // hr_admin × 2
  'Owusu',
  'Amponsah', // supervisor × 2
  'Agyei',
  'Ntim',
  'Adomako',
  'Frimpong',
  'Osei', // employee × 9
  'Kwarteng',
  'Antwi',
  'Acheampong',
  'Opoku',
];

const ROLES = [
  'super_admin',
  'super_admin',
  'hr_admin',
  'hr_admin',
  'supervisor',
  'supervisor',
  'employee',
  'employee',
  'employee',
  'employee',
  'employee',
  'employee',
  'employee',
  'employee',
  'employee',
];

const TOTAL_SCHOOLS = 1000;
const BATCH_SIZE = 50; // schools per DB transaction

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const dataSource = app.get(DataSource);

  // Hash once → reuse for every record (saves ~60 s of bcrypt CPU)
  console.log('Hashing shared password …');
  const passwordHash = await bcrypt.hash('123456', 10);
  console.log('Done. Starting seed …\n');

  const totalBatches = Math.ceil(TOTAL_SCHOOLS / BATCH_SIZE);

  for (let b = 0; b < totalBatches; b++) {
    const start = b * BATCH_SIZE + 1;
    const end = Math.min(start + BATCH_SIZE - 1, TOTAL_SCHOOLS);
    console.log(`Batch ${b + 1}/${totalBatches}: schools ${start}–${end}`);

    // Use camelCase property names — TypeORM entity-mapped insert
    const tenantRows: Partial<Tenant>[] = [];
    const userRows: Partial<User>[] = [];
    const employeeRows: Partial<Employee>[] = [];
    const statusLogRows: any[] = [];

    for (let n = start; n <= end; n++) {
      const tenantId = randomUUID();

      tenantRows.push({
        id: tenantId,
        slug: `school-${n}`,
        name: `School ${n}`,
        initials: `S${n}`,
        isActive: true,
        primaryColor: '#3b82f6',
      });

      for (let pos = 0; pos < 15; pos++) {
        const surname = SURNAMES[pos];
        const role = ROLES[pos] as any;
        const userId = randomUUID();
        const employeeId = randomUUID();
        const username = `${surname.toLowerCase()}_${n}`;
        const empCode = `S${n}/2501/${String(pos + 1).padStart(3, '0')}`;

        userRows.push({
          id: userId,
          tenantId: tenantId,
          fullName: surname,
          username: username,
          passwordHash: passwordHash,
          role: role,
          isActive: true,
          requiresPasswordChange: false,
        });

        // employees use a FK to user — set via the relation property
        employeeRows.push({
          id: employeeId,
          tenantId: tenantId,
          user: { id: userId } as any,
          employeeCode: empCode,
          status: 'active' as any,
        });

        // status log — keep as plain values for raw SQL below
        statusLogRows.push([
          randomUUID(), // id
          employeeId, // employee_id
          'active', // status
          new Date().toISOString().split('T')[0], // start_date (DATE)
        ]);
      }
    }

    // ── Persist the batch atomically ────────────────────────────────────────
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await qr.manager
        .createQueryBuilder()
        .insert()
        .into(Tenant)
        .values(tenantRows)
        .execute();

      await qr.manager
        .createQueryBuilder()
        .insert()
        .into(User)
        .values(userRows)
        .execute();

      await qr.manager
        .createQueryBuilder()
        .insert()
        .into(Employee)
        .values(employeeRows)
        .execute();

      // status logs — use raw SQL because QueryBuilder mis-handles DATE columns
      // statusLogRows is: [ [id, employee_id, status, start_date], ... ]
      const logPlaceholders = statusLogRows
        .map(
          (_, i) =>
            `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`,
        )
        .join(', ');
      const logParams = statusLogRows.flat();
      await qr.query(
        `INSERT INTO employee_status_logs (id, employee_id, status, start_date) VALUES ${logPlaceholders}`,
        logParams,
      );

      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      console.error(
        `\nBatch ${b + 1} FAILED — rolled back.\n`,
        err.message ?? err,
      );
      await qr.release();
      await app.close();
      process.exit(1);
    } finally {
      await qr.release();
    }
  }

  console.log(
    `\n✅  Seeded ${TOTAL_SCHOOLS} schools × 15 employees = ${TOTAL_SCHOOLS * 15} total employees.`,
  );
  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
