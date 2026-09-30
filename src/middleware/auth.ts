import { NextFunction, Request, Response } from 'express';
import { findModerator, verifyToken } from '../services/moderator.service';
import { AppError } from '../utils/AppError';

export async function requireModerator(req: Request, res: Response, next: NextFunction) {
  const token = req.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  const moderatorId = token ? verifyToken(token) : null;

  // Checked on every request so a removed moderator loses access immediately,
  // not when their token expires.
  const moderator = moderatorId ? await findModerator(moderatorId) : null;
  if (!moderator) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');

  res.locals.moderatorId = moderator.id;
  next();
}
