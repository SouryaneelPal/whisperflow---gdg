import { afterAll, beforeAll, beforeEach } from 'vitest';
import { prisma } from '../src/db';
import { server } from './helpers';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
});

beforeEach(async () => {
  await prisma.statusUpdate.deleteMany();
  await prisma.report.deleteMany();
  await prisma.moderator.deleteMany();
});

afterAll(async () => {
  server.close();
  await prisma.$disconnect();
});
