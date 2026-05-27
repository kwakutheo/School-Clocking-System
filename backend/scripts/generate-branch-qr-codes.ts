/**
 * Generate QR codes for all branches that don't have one.
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/generate-branch-qr-codes.ts
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

async function generateQrCodes() {
  await AppDataSource.initialize();
  console.log('Connected to database.\n');

  const branchRepo = AppDataSource.getRepository(Branch);

  const branches = await branchRepo.find();
  console.log(`Found ${branches.length} branch(es).\n`);

  for (const branch of branches) {
    if (!branch.qrCode) {
      branch.qrCode = require('crypto').randomBytes(16).toString('hex');
      branch.qrCodeUpdatedAt = new Date();
      await branchRepo.save(branch);
      console.log(`  ✅ ${branch.name} → QR generated`);
    } else {
      console.log(`  ⏭  ${branch.name} → already has QR`);
    }
  }

  console.log('\n🎉 QR code generation complete!');
  await AppDataSource.destroy();
}

generateQrCodes().catch((err) => {
  console.error('❌ Generation failed:', err);
  process.exit(1);
});
