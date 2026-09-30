import app from './app';
import { env } from './config/env';
import { prisma } from './db';
import { logger } from './utils/logger';

const server = app.listen(env.PORT, () => {
  logger.info(`WhistleDrop listening on port ${env.PORT}`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
