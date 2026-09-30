import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/db';

beforeEach(async () => {
  await prisma.statusUpdate.deleteMany();
  await prisma.report.deleteMany();
  await prisma.moderator.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
