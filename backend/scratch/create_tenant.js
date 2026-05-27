const { DataSource } = require('typeorm');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Define entities manually to bypass any path resolution issues
const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'tk_clocking',
  entities: [
    __dirname + '/../dist/modules/**/*.entity.js',
    __dirname + '/../dist/**/*.entity.js'
  ],
  synchronize: false,
});

async function run() {
  const args = process.argv.slice(2);
  
  if (args.length < 5) {
    console.log('\n❌ Missing arguments!');
    console.log('💡 Usage format:');
    console.log('   node scratch/create_tenant.js <TenantName> <Slug> <PrimaryColorHex> <AdminUsername> <AdminPassword>\n');
    console.log('📝 Example:');
    console.log('   node scratch/create_tenant.js "Accra Girls School" "accra-girls" "#ec4899" "girls.admin" "112233"\n');
    process.exit(1);
  }

  const [tenantName, slug, primaryColor, adminUsername, adminPassword] = args;

  console.log(`🔌 Connecting to local database...`);
  await ds.initialize();
  console.log('✓ Connected successfully!');

  const tenantRepo = ds.getRepository('Tenant');
  const userRepo = ds.getRepository('User');

  // 1. Verify slug uniqueness
  const existingTenant = await tenantRepo.findOne({ where: { slug } });
  if (existingTenant) {
    console.error(`❌ Error: A school with slug "${slug}" already exists!`);
    process.exit(1);
  }

  // 2. Verify username uniqueness
  const existingUser = await userRepo.findOne({ where: { username: adminUsername } });
  if (existingUser) {
    console.error(`❌ Error: A user with username "${adminUsername}" already exists!`);
    process.exit(1);
  }

  console.log(`🚀 Creating Tenant "${tenantName}" (slug: "${slug}", color: "${primaryColor}")...`);
  const tenant = tenantRepo.create({
    name: tenantName,
    slug: slug,
    primaryColor: primaryColor,
    isActive: true,
  });
  const savedTenant = await tenantRepo.save(tenant);
  console.log(`✓ Tenant successfully created! ID: ${savedTenant.id}`);

  console.log(`🔐 Hashing Admin password and creating Super Admin user...`);
  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  const adminUser = userRepo.create({
    fullName: `${tenantName} Admin`,
    username: adminUsername,
    passwordHash: hashedPassword,
    role: 'super_admin',
    isActive: true,
    tenantId: savedTenant.id,
  });
  await userRepo.save(adminUser);
  
  console.log(`✓ Admin user successfully provisioned:`);
  console.log(`  👉 Username: ${adminUsername}`);
  console.log(`  👉 Password: ${adminPassword}`);

  console.log('\n🎉 Onboarding successful! Accra Girls School is officially live in your SaaS sandbox!');
  console.log(`🖥️  You can view their customized white-labeled portal at:`);
  console.log(`👉 http://${slug}.localhost:3001\n`);

  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error onboarding tenant:', err);
  process.exit(1);
});
