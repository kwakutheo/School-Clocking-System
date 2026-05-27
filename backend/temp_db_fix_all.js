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
  const tenants = await ds.query("SELECT id, slug FROM tenants");
  const accraId = tenants.find(t => t.slug === 'accra').id;
  const accraGirlsId = tenants.find(t => t.slug === 'accra-girls').id;
  const obomId = tenants.find(t => t.slug === 'obom').id;

  // Fix specific known super admins
  await ds.query(`UPDATE users SET tenant_id = '${accraGirlsId}' WHERE username = 'girls.admin'`);
  await ds.query(`UPDATE users SET tenant_id = '${obomId}' WHERE username = 'obom.admin'`);

  // Protect owner.admin
  // Everyone else who is NULL goes to accra
  await ds.query(`UPDATE users SET tenant_id = '${accraId}' WHERE tenant_id IS NULL AND username != 'owner.admin'`);

  // Fix all other entities to belong to accra
  await ds.query(`UPDATE branches SET tenant_id = '${accraId}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE departments SET tenant_id = '${accraId}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE shifts SET tenant_id = '${accraId}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE attendance_logs SET tenant_id = '${accraId}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE leave_requests SET tenant_id = '${accraId}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE employees SET tenant_id = '${accraId}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE employee_status_logs SET tenant_id = '${accraId}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE academic_terms SET tenant_id = '${accraId}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE term_breaks SET tenant_id = '${accraId}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE holidays SET tenant_id = '${accraId}' WHERE tenant_id IS NULL`);
  await ds.query(`UPDATE audit_logs SET tenant_id = '${accraId}' WHERE tenant_id IS NULL`);

  console.log('Successfully repaired all orphaned data!');
  process.exit(0);
});
