import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().min(1).default('1h'),
  PORT: z.coerce.number().int().positive().default(3000),
  SUBMIT_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(30),
  TRACK_LIMIT_PER_15_MIN: z.coerce.number().int().positive().default(30),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
