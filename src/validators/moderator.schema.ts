import { z } from 'zod';
import { STATUSES } from '../domain/statusWorkflow';
import { categorySchema } from './report.schema';

const statusSchema = z.enum(STATUSES, { error: `Must be one of ${STATUSES.join(', ')}` });

const messageSchema = z
  .string({ error: 'Must be a string' })
  .trim()
  .min(3, 'Must be at least 3 characters')
  .max(500, 'Must be at most 500 characters');

export const loginSchema = z.strictObject({
  username: z.string({ error: 'Must be a string' }).trim().toLowerCase().min(1, 'Required').max(64, 'Must be at most 64 characters'),
  password: z.string({ error: 'Must be a string' }).min(1, 'Required').max(128, 'Must be at most 128 characters'),
});

export const listQuerySchema = z.strictObject({
  category: categorySchema.optional(),
  status: statusSchema.optional(),
  q: z.string().trim().max(100, 'Must be at most 100 characters').optional(),
  page: z.coerce.number().int().min(1, 'Must be 1 or more').default(1),
  limit: z.coerce.number().int().min(1, 'Must be 1 or more').max(100, 'Must be at most 100').default(20),
});

export const statusChangeSchema = z.strictObject({ status: statusSchema, message: messageSchema });

export const noteSchema = z.strictObject({ message: messageSchema });

export type ListQuery = z.infer<typeof listQuerySchema>;
