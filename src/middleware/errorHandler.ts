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
  return undefined;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const known = err instanceof AppError ? err : fromBodyParser(err);

  if (known) {
    res.status(known.status).json({ error: { code: known.code, message: known.message } });
    return;
  }

  // Never echo internal error details to the client.
  logger.error('Unhandled error', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
