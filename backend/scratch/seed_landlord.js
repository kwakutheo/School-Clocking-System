const { DataSource } = require('typeorm');
const bcrypt = require('bcrypt');
require('dotenv').config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'tk_clocking',
  entities: [
    __dirname + '/../dist/**/*.entity.js'
  ],
  synchronize: false,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function seed() {
  const adminUsername = process.env.LANDLORD_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.LANDLORD_ADMIN_PASSWORD || 'admin123';
  const adminFullName = process.env.LANDLORD_ADMIN_FULL_NAME || 'Platform Admin';

  console.log('🔌 Connecting to tk_clocking database...');
  await ds.initialize();
  console.log('✓ Connected successfully!');

  const userRepo = ds.getRepository('User');
  let platformOwner = await userRepo.findOne({ where: { username: adminUsername } });
  
  if (!platformOwner) {
    console.log('🚀 Creating global Platform Owner user...');
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    platformOwner = userRepo.create({
      username: adminUsername,
      fullName: adminFullName,
      passwordHash: hashedPassword,
      role: 'super_admin',
      isActive: true,
      tenantId: null, // Global landlord
    });
    await userRepo.save(platformOwner);
    console.log(`✓ Global Platform Owner created: username="${adminUsername}"`);
  } else {
    console.log('✓ Global Platform Owner user already exists.');
  }

  console.log('🎉 Seeding completed successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error seeding landlord:', err);
  process.exit(1);
});
