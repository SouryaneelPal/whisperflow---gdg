import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { Status } from '../src/domain/statusWorkflow';
import { api, createModerator, loginAs, submitReport } from './helpers';

let token: string;

beforeEach(async () => {
  await createModerator();
  token = await loginAs();
});

function changeStatus(id: string, body: object) {
  return api.patch(`/api/moderator/reports/${id}/status`).set('Authorization', `Bearer ${token}`).send(body);
}

function addNote(id: string, message: string) {
  return api.post(`/api/moderator/reports/${id}/updates`).set('Authorization', `Bearer ${token}`).send({ message });
}

async function reportIn(status: Status) {
  const report = await submitReport();
  if (status === 'SUBMITTED') return report;

  await changeStatus(report.id, { status: 'UNDER_REVIEW', message: 'Taking a look.' });
  if (status !== 'UNDER_REVIEW') await changeStatus(report.id, { status, message: 'Done.' });
  return report;
}

describe('PATCH /api/moderator/reports/:id/status', () => {
  it('moves a report from SUBMITTED to UNDER_REVIEW', async () => {
    const { id } = await reportIn('SUBMITTED');

    const res = await changeStatus(id, { status: 'UNDER_REVIEW', message: '  We are looking into this.  ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      report: { id, category: 'SECURITY', status: 'UNDER_REVIEW', updatedAt: expect.any(String) },
      update: { status: 'UNDER_REVIEW', message: 'We are looking into this.', createdAt: expect.any(String) },
    });
  });

  it('moves a report from UNDER_REVIEW to RESOLVED', async () => {
    const { id } = await reportIn('UNDER_REVIEW');

    const res = await changeStatus(id, { status: 'RESOLVED', message: 'The readers were replaced.' });

    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('RESOLVED');
  });

  it('moves a report from UNDER_REVIEW to DISMISSED', async () => {
    const { id } = await reportIn('UNDER_REVIEW');

    const res = await changeStatus(id, { status: 'DISMISSED', message: 'Could not be confirmed.' });

    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('DISMISSED');
  });

  it('rejects SUBMITTED straight to RESOLVED with 409', async () => {
    const { id } = await reportIn('SUBMITTED');

    const res = await changeStatus(id, { status: 'RESOLVED', message: 'Skipping review.' });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INVALID_STATUS_CHANGE',
      message: 'Cannot change a SUBMITTED report to RESOLVED. Allowed next: UNDER_REVIEW',
    });
  });

  it('rejects changing to the same status', async () => {
    const { id } = await reportIn('UNDER_REVIEW');

    const res = await changeStatus(id, { status: 'UNDER_REVIEW', message: 'Still looking.' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_CHANGE');
  });

  it('does not let a closed report change again', async () => {
    const { id } = await reportIn('RESOLVED');

    const res = await changeStatus(id, { status: 'UNDER_REVIEW', message: 'Reopening.' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CASE_CLOSED');
  });

  it('requires a message', async () => {
    const { id } = await reportIn('SUBMITTED');

    for (const body of [{ status: 'UNDER_REVIEW' }, { status: 'UNDER_REVIEW', message: '  a ' }]) {
      const res = await changeStatus(id, body);

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('message');
    }
  });

  it('returns 404 for an unknown report', async () => {
    const res = await changeStatus('nope', { status: 'UNDER_REVIEW', message: 'Taking a look.' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REPORT_NOT_FOUND');
  });

  it('lets exactly one of two simultaneous changes succeed', async () => {
    const { id } = await reportIn('SUBMITTED');

    const results = await Promise.all([
      changeStatus(id, { status: 'UNDER_REVIEW', message: 'First moderator.' }),
      changeStatus(id, { status: 'UNDER_REVIEW', message: 'Second moderator.' }),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await prisma.statusUpdate.count({ where: { reportId: id } })).toBe(2);
  });
});

describe('POST /api/moderator/reports/:id/updates', () => {
  it('adds a note to an open report without changing its status', async () => {
    const { id } = await reportIn('UNDER_REVIEW');

    const res = await addNote(id, 'We have spoken to facilities.');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      update: { status: 'UNDER_REVIEW', message: 'We have spoken to facilities.', createdAt: expect.any(String) },
    });
  });

  it('refuses a note on a closed report', async () => {
    const { id } = await reportIn('DISMISSED');

    const res = await addNote(id, 'One more thing.');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CASE_CLOSED');
  });
});

describe('reporter view', () => {
  it('shows the moderator updates to the reporter through the case code', async () => {
    const { id, caseCode } = await reportIn('SUBMITTED');
    await changeStatus(id, { status: 'UNDER_REVIEW', message: 'We are looking into this.' });
    await addNote(id, 'Facilities have been contacted.');

    const res = await api.get('/api/reports/status').set('X-Case-Code', caseCode);

    expect(res.body.status).toBe('UNDER_REVIEW');
    expect(res.body.updates.map((u: { message: string }) => u.message)).toEqual([
      'Report received',
      'We are looking into this.',
      'Facilities have been contacted.',
    ]);
  });
});
