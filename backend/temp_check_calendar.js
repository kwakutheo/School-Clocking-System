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
  const terms = await ds.query('SELECT id, name, "academicYear", tenant_id FROM academic_terms WHERE tenant_id IS NULL');
  console.table(terms);
  
  const counts = await ds.query('SELECT "academicYear", COUNT(*) as count FROM academic_terms WHERE tenant_id IS NULL GROUP BY "academicYear"');
  console.table(counts);

  const tenants = await ds.query("SELECT id, name, slug FROM tenants");
  console.table(tenants);

  process.exit(0);
});
