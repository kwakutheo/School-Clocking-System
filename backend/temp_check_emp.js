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
  const emp = await ds.query("SELECT tenant_id, COUNT(*) as count FROM employees GROUP BY tenant_id");
  const tenants = await ds.query("SELECT id, slug FROM tenants");
  console.log(emp);
  console.log(tenants);
  process.exit(0);
});
