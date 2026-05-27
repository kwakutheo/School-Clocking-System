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
  await ds.query("UPDATE users SET tenant_id='35363999-4849-41cc-9249-5ba30c3d1d00' WHERE username='prempeh.admin'");
  console.log('Successfully repaired prempeh.admin tenantId');
  process.exit(0);
});
