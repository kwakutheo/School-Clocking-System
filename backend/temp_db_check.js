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
  const user = await ds.query("SELECT id, username, tenant_id FROM users WHERE username='prempeh.admin'");
  const tenant = await ds.query("SELECT id, slug FROM tenants WHERE slug='prempeh'");
  console.log('User:', user[0]);
  console.log('Tenant:', tenant[0]);
  process.exit(0);
});
