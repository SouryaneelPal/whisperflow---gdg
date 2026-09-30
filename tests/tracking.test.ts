import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';
import { formatCaseCode, generateCaseCode } from '../src/services/caseCode.service';

const report = {
  category: 'HARASSMENT',
  description: 'A manager keeps making comments about my appearance.',
};

async function submit() {
  const res = await request(app).post('/api/reports').send(report);
  return res.body.caseCode as string;
}

function track(caseCode?: string) {
  const req = request(app).get('/api/reports/status');
  return caseCode === undefined ? req : req.set('X-Case-Code', caseCode);
}

describe('GET /api/reports/status', () => {
  it('tracks a report with its case code', async () => {
    const caseCode = await submit();

    const res = await track(caseCode);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      category: 'HARASSMENT',
      status: 'SUBMITTED',
      submittedAt: expect.any(String),
      updates: [{ status: 'SUBMITTED', message: 'Report received', createdAt: expect.any(String) }],
    });
  });

  it('accepts a case code typed in lowercase without the prefix or dashes', async () => {
    const caseCode = await submit();
    const typed = `  ${caseCode.replace(/^WD-/, '').replaceAll('-', '').toLowerCase()} `;

    const res = await track(typed);

    expect(res.status).toBe(200);
  });

  it('returns 400 without the X-Case-Code header', async () => {
    const res = await track();

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_CASE_CODE');
  });

  it('returns an identical 404 for malformed and unknown codes', async () => {
    await submit();

    const malformed = await track('not-a-code');
    const unknown = await track(formatCaseCode(generateCaseCode()));

    expect(malformed.status).toBe(404);
    expect(malformed.body.error.code).toBe('CASE_NOT_FOUND');
    expect(unknown.status).toBe(malformed.status);
    expect(unknown.body).toEqual(malformed.body);
  });

  it('does not return the report id, description or hash', async () => {
    const caseCode = await submit();

    const res = await track(caseCode);
    const body = JSON.stringify(res.body);

    expect(Object.keys(res.body).sort()).toEqual(['category', 'status', 'submittedAt', 'updates']);
    expect(body).not.toContain(report.description);
    expect(body).not.toMatch(/[0-9a-f]{64}/);
    expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});
