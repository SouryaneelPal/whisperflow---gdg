import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../src/db';
import { BCRYPT_COST } from '../src/services/moderator.service';

async function main() {
  const username = process.env.SEED_MODERATOR_USERNAME?.trim().toLowerCase();
  const password = process.env.SEED_MODERATOR_PASSWORD;

  if (!username || !password) {
    throw new Error('Set SEED_MODERATOR_USERNAME and SEED_MODERATOR_PASSWORD in .env');
  }
  if (password.length < 12) {
    throw new Error('SEED_MODERATOR_PASSWORD must be at least 12 characters');
  }

  const existing = await prisma.moderator.findUnique({ where: { username } });
  if (existing) {
    console.log('moderator already exists');
    return;
  }

  await prisma.moderator.create({ data: { username, passwordHash: await bcrypt.hash(password, BCRYPT_COST) } });
  console.log(`moderator created: ${username}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
