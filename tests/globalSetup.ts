import { execSync } from 'node:child_process';
import fs from 'node:fs';
import type { TestProject } from 'vitest/node';

export default function setup(project: TestProject) {
  // SQLite paths resolve relative to the schema, so file:./test.db lives in prisma/.
  // Starting from a fresh file keeps the schema in sync without a destructive reset.
  fs.rmSync('prisma/test.db', { force: true });

  execSync('npx prisma db push --skip-generate', {
    env: { ...process.env, ...project.config.env },
    stdio: 'ignore',
  });
}
