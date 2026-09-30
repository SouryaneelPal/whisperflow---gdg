import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

// Counters live only in the process memory (the default MemoryStore) and expire with their
// window. They are never written to the database or logged, so no record of who contacted
// the service outlives the window.
function limiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    // draft-8 adds a pk= partition key to RateLimit-Policy that is derived from the client IP.
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    // Every Supertest request comes from the same loopback address, so the suite would trip
    // the limits; rate limiting is switched off under Vitest only.
    skip: () => env.NODE_ENV === 'test',
    handler: (_req, _res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests, try again later'));
    },
  });
}

export const submitLimiter = limiter(60 * 60 * 1000, env.SUBMIT_LIMIT_PER_HOUR);
export const trackLimiter = limiter(15 * 60 * 1000, env.TRACK_LIMIT_PER_15_MIN);
export const loginLimiter = limiter(15 * 60 * 1000, 5);
