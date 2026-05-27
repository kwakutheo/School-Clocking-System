const { DataSource } = require('typeorm');
const bcrypt = require('bcrypt');

const ds = new DataSource({
  type: 'postgres',
  host: 'dpg-d802fgu7r5hc73b85qcg-a.frankfurt-postgres.render.com',
  port: 5432,
  username: 'theo',
  password: 'Tbxtx3at4yicnVKPZksGEdTCLSn92GC5',
  database: 'tk_clocking',
  ssl: { rejectUnauthorized: false },
  entities: [__dirname + '/dist/**/*.entity.js'],
  synchronize: true, // This will create the tables if they don't exist
});

async function run() {
  await ds.initialize();
  console.log('Database initialized.');

  // Check if superadmin exists
  const userRepo = ds.getRepository('User');
  const existing = await userRepo.findOne({ where: { role: 'super_admin' } });
  
  if (!existing) {
    const hashedPassword = await bcrypt.hash('112233', 12);
    const superAdmin = userRepo.create({
      username: 'theo', // The user entity uses 'username'
      fullName: 'Theophilus Kwaku', // The user entity uses 'fullName'
      passwordHash: hashedPassword, // The user entity uses 'passwordHash'
      role: 'super_admin',
    });
    await userRepo.save(superAdmin);
    console.log('Seeded Super Admin user: theo / 112233');
  } else {
    console.log('Superadmin already exists. Updating credentials to theo / 112233 just in case...');
    existing.username = 'theo';
    existing.passwordHash = await bcrypt.hash('112233', 12);
    await userRepo.save(existing);
    console.log('Updated Super Admin user credentials.');
  }

  process.exit(0);
}

run().catch(console.error);
