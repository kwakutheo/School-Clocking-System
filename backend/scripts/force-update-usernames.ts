import { DataSource } from 'typeorm';
import { User } from '../src/modules/users/user.entity';

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'tk_clocking',
  entities: [User],
  synchronize: false,
  logging: false,
});

const TARGETS = [
  { fullName: 'Abena Mensah', username: 'mensah' },
  { fullName: 'Ama Owusu', username: 'owusu' },
  { fullName: 'Yaw Darko', username: 'darko' },
];

async function main() {
  await ds.initialize();
  const userRepo = ds.getRepository(User);

  const allUsers = await userRepo.find();
  const existingUsernames = new Set(allUsers.map((u) => u.username).filter(Boolean));

  for (const target of TARGETS) {
    const user = allUsers.find((u) => u.fullName === target.fullName);
    if (!user) {
      console.log(`User not found: ${target.fullName}`);
      continue;
    }

    let username = target.username;
    let suffix = 1;
    while (existingUsernames.has(username) && username !== user.username) {
      suffix++;
      username = `${target.username}${suffix}`;
    }

    user.username = username;
    await userRepo.save(user);
    existingUsernames.add(username);
    console.log(`Updated: ${target.fullName} → ${username}`);
  }

  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
