const { DataSource } = require('typeorm');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Define entities manually to bypass any path resolution issues
const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'tk_clocking',
  entities: [
    __dirname + '/../dist/modules/**/*.entity.js',
    __dirname + '/../dist/**/*.entity.js'
  ],
  synchronize: true,
});

const DEFAULT_PERMISSIONS = {
  super_admin: [],
  hr_admin: [
    'employees.view',
    'employees.create',
    'employees.edit',
    'attendance.view',
    'attendance.view_live',
    'attendance.edit',
    'attendance.export',
    'calendar.view',
    'calendar.create',
    'calendar.edit',
    'shifts.manage',
    'departments.manage',
    'branches.manage',
    'holidays.manage'
  ],
  supervisor: [
    'employees.view',
    'attendance.view',
    'attendance.view_live',
    'calendar.view'
  ],
  employee: []
};

async function seed() {
  console.log('🔌 Connecting to local tk_clocking database...');
  await ds.initialize();
  console.log('✓ Connected successfully!');

  // 0. Seed Default Tenant
  const tenantRepo = ds.getRepository('Tenant');
  let tenant = await tenantRepo.findOne({ where: { slug: 'accra' } });
  if (!tenant) {
    console.log('🚀 Creating local default Tenant...');
    tenant = tenantRepo.create({
      slug: 'accra',
      name: 'Accra Academy',
      primaryColor: '#3b82f6',
    });
    await tenantRepo.save(tenant);
    console.log('✓ Default Tenant created: "Accra Academy" (slug: "accra")');
  } else {
    console.log('✓ Local default Tenant already exists.');
  }

  // Migration: Migrate existing records to the default tenant
  console.log('🔧 Migrating existing local records to default Tenant Accra Academy...');
  await ds.query(`UPDATE users SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE branches SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE departments SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE shifts SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE attendance_logs SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE leave_requests SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE employees SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE employee_status_logs SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE academic_terms SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE term_breaks SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE holidays SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE audit_logs SET tenant_id = '${tenant.id}' WHERE tenant_id IS NULL`);
  console.log('✓ Existing records successfully migrated!');

  // 1. Seed Super Admin User
  const userRepo = ds.getRepository('User');
  const existingUser = await userRepo.findOne({ where: { role: 'super_admin' } });
  
  if (!existingUser) {
    console.log('🚀 Creating local Super Admin user...');
    const hashedPassword = await bcrypt.hash('112233', 12);
    const superAdmin = userRepo.create({
      username: 'theo',
      fullName: 'Theophilus Kwaku',
      passwordHash: hashedPassword,
      role: 'super_admin',
      isActive: true,
    });
    await userRepo.save(superAdmin);
    console.log('✓ Super Admin created: username="theo", password="112233"');
  } else {
    console.log('✓ Local Super Admin user already exists.');
  }

  // 2. Seed Settings & Permissions
  const settingRepo = ds.getRepository('Setting');
  let setting = await settingRepo.findOne({ where: { key: 'role_permissions' } });
  if (!setting) {
    console.log('🚀 Seeding local role permissions matrix...');
    setting = settingRepo.create({
      key: 'role_permissions',
      value: JSON.stringify(DEFAULT_PERMISSIONS),
    });
    await settingRepo.save(setting);
    console.log('✓ Seeding complete!');
  } else {
    console.log('✓ Local permissions matrix already exists.');
  }

  console.log('\n🎉 Local Database successfully seeded! You can now log into http://localhost:3001 using:');
  console.log('👉 Username: theo');
  console.log('👉 Password: 112233\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error seeding local database:', err);
  process.exit(1);
});
