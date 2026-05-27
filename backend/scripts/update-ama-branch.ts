import { DataSource } from 'typeorm';

const ds = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'tk_clocking',
  entities: [],
  synchronize: false,
});

async function main() {
  await ds.initialize();

  const branchResult = await ds.query(
    `INSERT INTO branches (id, name, latitude, longitude, allowed_radius)
     VALUES (gen_random_uuid(), 'Otwetiri', 5.975498, -0.188543, 100)
     ON CONFLICT (name) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
     RETURNING id, name;`
  );

  const branchId = branchResult[0].id;
  console.log('Branch:', branchResult[0].name, '-', branchId);

  await ds.query(
    `UPDATE employees SET branch_id = $1 WHERE employee_code = 'TK-0004';`,
    [branchId]
  );

  console.log('Updated Ama Owusu (TK-0004) → Otwetiri');
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
