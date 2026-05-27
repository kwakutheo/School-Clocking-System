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
  synchronize: true,
});

async function seed() {
  console.log('🔌 Connecting to local tk_clocking database...');
  await ds.initialize();
  console.log('✓ Connected successfully!');

  const userRepo = ds.getRepository('User');
  let platformOwner = await userRepo.findOne({ where: { username: 'owner.admin' } });
  
  if (!platformOwner) {
    console.log('🚀 Creating global Platform Owner user...');
    const hashedPassword = await bcrypt.hash('112233', 12);
    platformOwner = userRepo.create({
      username: 'owner.admin',
      fullName: 'Platform Owner',
      passwordHash: hashedPassword,
      role: 'super_admin',
      isActive: true,
      tenantId: null, // Global landlord
    });
    await userRepo.save(platformOwner);
    console.log('✓ Global Platform Owner created: username="owner.admin", password="112233"');
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
