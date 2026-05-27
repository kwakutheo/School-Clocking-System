const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module');
const { EmployeesService } = require('../dist/src/modules/employees/employees.service');
const { TenantsService } = require('../dist/src/modules/tenants/tenants.service');
const { tenantLocalStorage } = require('../dist/src/common/tenant/tenant.context');
const { DataSource } = require('typeorm');

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const employeesService = app.get(EmployeesService);
  const tenantsService = app.get(TenantsService);
  const ds = app.get(DataSource);

  const schools = [
    { slug: 'prempeh', initials: 'PR', name: 'Prempeh College' },
    { slug: 'accra-girls', initials: 'AG', name: 'Accra Girls School' },
    { slug: 'obom', initials: 'OB', name: 'Obom Presby Basic School' }
  ];

  const profiles = [
    { surname: 'Owusu', role: 'super_admin' },
    { surname: 'Appiah', role: 'super_admin' },
    { surname: 'Mensah', role: 'hr_admin' },
    { surname: 'Frimpong', role: 'hr_admin' },
    { surname: 'Boateng', role: 'supervisor' },
    { surname: 'Osei', role: 'supervisor' },
    { surname: 'Gyamfi', role: 'employee' },
    { surname: 'Amoah', role: 'employee' },
    { surname: 'Sarpong', role: 'employee' },
    { surname: 'Boadu', role: 'employee' },
    { surname: 'Kusi', role: 'employee' },
    { surname: 'Asante', role: 'employee' },
    { surname: 'Donkor', role: 'employee' },
    { surname: 'Acheampong', role: 'employee' },
    { surname: 'Yeboah', role: 'employee' }
  ];

  for (const s of schools) {
    try {
      const tenant = await tenantsService.findBySlug(s.slug);
      
      // Clean up previous run if any
      await ds.query(`DELETE FROM users WHERE tenant_id = '${tenant.id}' AND role != 'super_admin'`); // Wait, we seeded super_admins too! 
      // Actually let's just delete ALL users in this tenant except the main admin account (e.g. prempeh.admin).
      await ds.query(`DELETE FROM users WHERE tenant_id = '${tenant.id}' AND username NOT LIKE '%.admin'`);
      
      // Update the initials first so the employee code uses them
      await tenantsService.updateBranding(tenant.id, { initials: s.initials });
      console.log(`\n--- Seeding ${s.name} (${s.initials}) ---`);

      // We MUST run the creation inside the tenant context so `tenantLocalStorage.getStore()` works!
      await tenantLocalStorage.run(tenant.id, async () => {
        let i = 1;
        for (const p of profiles) {
          try {
            // Make username unique across system
            const username = `${s.initials.toLowerCase()}_${p.surname.toLowerCase()}`;
            const employee = await employeesService.createEmployeeWithUser({
              fullName: `${p.surname} Staff`,
              username: username,
              password: '123456',
              role: p.role,
              position: p.role.replace('_', ' ').toUpperCase(),
            });
            console.log(`[${i}/15] Created ${employee.employeeCode} - ${username} (${p.role})`);
            i++;
          } catch (err) {
            console.log(`Failed to create ${p.surname}: ${err.message}`);
          }
        }
      });
    } catch (err) {
      console.error(`Error processing school ${s.slug}: ${err.message}`);
    }
  }

  await app.close();
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
