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

function getLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

async function main() {
  await ds.initialize();
  const userRepo = ds.getRepository(User);

  const users = await userRepo.find();
  const updated: { id: string; fullName: string; username: string }[] = [];
  const existingUsernames = new Set(users.map((u) => u.username).filter(Boolean));

  for (const user of users) {
    if (user.username) {
      console.log(`Skipping ${user.fullName} — already has username: ${user.username}`);
      continue;
    }

    let lastName = getLastName(user.fullName);
    let username = lastName;
    let suffix = 1;

    while (existingUsernames.has(username)) {
      suffix++;
      username = `${lastName}${suffix}`;
    }

    user.username = username;
    await userRepo.save(user);
    existingUsernames.add(username);
    updated.push({ id: user.id, fullName: user.fullName, username });
    console.log(`Updated: ${user.fullName} → ${username}`);
  }

  console.log(`\nDone. Updated ${updated.length} user(s).`);
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
