import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { DATABASE_URL: 'file:./test.db' },
    globalSetup: './tests/globalSetup.ts',
    setupFiles: ['./tests/setup.ts'],
    // All test files share one SQLite database, so they must not run at the same time.
    fileParallelism: false,
  },
});
