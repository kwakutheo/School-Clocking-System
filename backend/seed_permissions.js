const { DataSource } = require('typeorm');
const { Setting } = require('./dist/modules/settings/setting.entity');
require('dotenv').config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'tk_clocking',
  entities: [Setting],
  synchronize: false,
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
  await ds.initialize();
  console.log('DB connected');
  const repo = ds.getRepository(Setting);
  let setting = await repo.findOne({ where: { key: 'role_permissions' } });
  if (!setting) {
    setting = repo.create({ key: 'role_permissions', value: JSON.stringify(DEFAULT_PERMISSIONS) });
  } else {
    setting.value = JSON.stringify(DEFAULT_PERMISSIONS);
  }
  await repo.save(setting);
  console.log('Successfully seeded permissions matrix!');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
