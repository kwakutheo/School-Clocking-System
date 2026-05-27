/**
 * Update all branch geofence radii to 300 meters.
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/update-branch-radius.ts
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

import { Branch } from '../src/modules/branches/branch.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'tk_clocking',
  entities: [Branch],
  synchronize: false,
  logging: false,
});

async function updateRadius() {
  await AppDataSource.initialize();
  console.log('Connected to database.\n');

  const branchRepo = AppDataSource.getRepository(Branch);

  const branches = await branchRepo.find();
  console.log(`Found ${branches.length} branch(es). Updating radius to 300m...\n`);

  for (const branch of branches) {
    branch.allowedRadius = 300;
    await branchRepo.save(branch);
    console.log(`  ✅ ${branch.name} → radius: 300m`);
  }

  console.log('\n🎉 All branches updated successfully!');
  await AppDataSource.destroy();
}

updateRadius().catch((err) => {
  console.error('❌ Update failed:', err);
  process.exit(1);
});
