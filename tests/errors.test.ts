import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/db';
import { api, createModerator, loginAs, submitReport } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

const report = { category: 'OTHER', description: 'Expense claims are being approved twice.' };

describe('unexpected errors', () => {
  it('return a generic 500 without a stack or internal details', async () => {
    const printed: unknown[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => printed.push(args));
    vi.spyOn(prisma.report, 'create').mockRejectedValue(new Error('SQLITE_IOERR at /var/data/wd.db'));

    const res = await api.post('/api/reports').send(report);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    expect(res.text).not.toMatch(/SQLITE|wd\.db|at /);
    expect(JSON.stringify(printed)).toContain('Error: SQLITE_IOERR at /var/data/wd.db');
    expect(JSON.stringify(printed)).not.toContain('Expense claims');
    expect(JSON.stringify(printed)).not.toContain('errors.test.ts');
  });
});

describe('known Prisma errors', () => {
  let token: string;
  let id: string;

  beforeEach(async () => {
    await createModerator();
    token = await loginAs();
    ({ id } = await submitReport());
  });

  function failWith(code: string) {
    const error = new Prisma.PrismaClientKnownRequestError('Invalid invocation', { code, clientVersion: 'test' });
    vi.spyOn(prisma, '$transaction').mockRejectedValue(error);
  }

  function changeStatus() {
    return api
      .patch(`/api/moderator/reports/${id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'UNDER_REVIEW', message: 'Taking a look.' });
  }

  it('treat a moderator deleted mid-request as unauthorized', async () => {
    failWith('P2003');

    const res = await changeStatus();

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('turn a transaction that could not start into 503', async () => {
    failWith('P2028');

    const res = await changeStatus();

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('BUSY');
  });
});

describe('bad request bodies', () => {
  it('rejects a body over the size limit with 413', async () => {
    const res = await api.post('/api/reports').send({ ...report, description: 'x'.repeat(200_000) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await api.post('/api/reports').set('Content-Type', 'application/json').send('{"category": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects a body that is not JSON with 400', async () => {
    const res = await api.post('/api/reports').set('Content-Type', 'text/plain').send('category=OTHER');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty body with 400', async () => {
    const res = await api.post('/api/reports').set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unsupported charset with 415', async () => {
    const res = await api
      .post('/api/reports')
      .set('Content-Type', 'application/json; charset=klingon')
      .send(JSON.stringify(report));

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_ENCODING');
  });
});
