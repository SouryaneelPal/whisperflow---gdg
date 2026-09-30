import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';
import { prisma } from '../src/db';
import { generateCaseCode } from '../src/services/caseCode.service';

const report = {
  category: 'SECURITY',
  description: 'The server room door has been left unlocked all week.',
  evidenceUrl: 'https://example.com/photo.jpg',
};

function submit(body: object) {
  return request(app).post('/api/reports').send(body);
}

describe('POST /api/reports', () => {
  it('creates a report and returns a case code', async () => {
    const res = await submit(report);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      caseCode: expect.any(String),
      status: 'SUBMITTED',
      message: 'Save this case code. It cannot be recovered.',
    });
  });

  it('rejects an unknown category', async () => {
    const res = await submit({ ...report, category: 'GOSSIP' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([{ field: 'category', message: expect.any(String) }]);
  });

  it('rejects a description shorter than 10 characters after trimming', async () => {
    const res = await submit({ ...report, description: '   too short   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'description', message: 'Must be at least 10 characters' }]);
  });

  it('rejects an evidence URL that is not http or https', async () => {
    for (const evidenceUrl of ['ftp://example.com/file.pdf', 'javascript:alert(1)', 'not a url']) {
      const res = await submit({ ...report, evidenceUrl });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([{ field: 'evidenceUrl', message: 'Must be a valid http or https URL' }]);
    }
  });

  it('rejects unknown fields', async () => {
    const res = await submit({ ...report, email: 'someone@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'email', message: 'Unknown field' }]);
    expect(await prisma.report.count()).toBe(0);
  });

  it('stores only the hash of the case code', async () => {
    const res = await submit(report);
    const raw = res.body.caseCode.replace(/^WD-/, '').replaceAll('-', '');

    const rows = await prisma.report.findMany({ include: { updates: true } });

    expect(rows).toHaveLength(1);
    expect(rows[0].caseCodeHash).toBe(crypto.createHash('sha256').update(raw).digest('hex'));
    expect(JSON.stringify(rows)).not.toContain(raw);
  });
});

describe('case codes', () => {
  it('match the WD-XXXXX-XXXXX-XXXXX-XXXXX format without look-alike characters', async () => {
    const res = await submit(report);

    expect(res.body.caseCode).toMatch(/^WD(-[2-9A-HJKMNP-Z]{5}){4}$/);
  });

  it('are unique across many generations', () => {
    const codes = new Set(Array.from({ length: 10000 }, generateCaseCode));

    expect(codes.size).toBe(10000);
  });
});
