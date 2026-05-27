const { DataSource } = require('typeorm');
const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'tk_clocking'
});
ds.initialize().then(async () => {
  const users = await ds.query("SELECT id, username, role, full_name FROM users WHERE tenant_id IS NULL");
  const employees = await ds.query("SELECT id, employee_code FROM employees WHERE tenant_id IS NULL");
  const branches = await ds.query("SELECT id, name FROM branches WHERE tenant_id IS NULL");
  const departments = await ds.query("SELECT id, name FROM departments WHERE tenant_id IS NULL");
  
  console.log('--- USERS WITH NULL TENANT ---');
  console.table(users);
  
  console.log('--- EMPLOYEES WITH NULL TENANT ---');
  console.table(employees);
  
  console.log('--- BRANCHES WITH NULL TENANT ---');
  console.table(branches);
  
  console.log('--- DEPARTMENTS WITH NULL TENANT ---');
  console.table(departments);
  
  const tenants = await ds.query("SELECT id, slug, name FROM tenants");
  console.log('--- AVAILABLE TENANTS ---');
  console.table(tenants);
  
  process.exit(0);
});
