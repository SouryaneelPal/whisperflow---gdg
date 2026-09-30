import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'Route not found'));
}

// express.json() reports bad bodies with a `type` field rather than an AppError.
function fromBodyParser(err: unknown) {
  const type = (err as { type?: unknown } | null)?.type;
  if (type === 'entity.parse.failed') return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  if (type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  if (type === 'encoding.unsupported' || type === 'charset.unsupported') {
    return new AppError(415, 'UNSUPPORTED_ENCODING', 'Request body encoding is not supported');
  }
  return undefined;
}

function fromPrisma(err: unknown) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return undefined;

  // Reports are never deleted, so the only foreign key that can fail is StatusUpdate.moderatorId:
  // the moderator was removed after the auth check but before their update was saved.
  if (err.code === 'P2003') return new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  // SQLite allows one writer at a time; under load a transaction can fail to start in time.
  if (err.code === 'P2028' || err.code === 'P2034') {
    return new AppError(503, 'BUSY', 'The server is busy, try again in a moment');
  }
  return undefined;
}

// Only the name and message are logged: never the request, its headers or its body. Prisma
// messages can quote query arguments (report content), so for Prisma errors only the code is kept.
function describe(err: unknown) {
  if (!(err instanceof Error)) return 'non-Error value thrown';
  if (err instanceof Prisma.PrismaClientKnownRequestError) return `${err.name} ${err.code}`;
  if (err.name.startsWith('PrismaClient')) return err.name;
  return `${err.name}: ${err.message}`;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const known = err instanceof AppError ? err : (fromBodyParser(err) ?? fromPrisma(err));

  if (known) {
    const { code, message, details } = known;
    res.status(known.status).json({ error: { code, message, details } });
    return;
  }

  logger.error(`Unhandled error: ${describe(err)}`);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
