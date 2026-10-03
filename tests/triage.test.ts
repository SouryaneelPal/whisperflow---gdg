import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import model from '../src/ml/model.json';
import { suggestTriage } from '../src/services/triage.service';
import { api, createModerator, loginAs, submitReport } from './helpers';

type Fixture = { text: string; topCategory: string; confidence: number; suggestedCategory: string | null };

// Written by ml/train.py from scikit-learn's own predictions.
const fixtures: Fixture[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/triage-parity.json'), 'utf8'),
);

describe('triage model', () => {
  it('matches the scikit-learn predictions for the parity texts', () => {
    expect(fixtures).toHaveLength(8);

    for (const fixture of fixtures) {
      const result = suggestTriage(fixture.text);

      expect(result.suggestedCategory, fixture.text).toBe(fixture.suggestedCategory);
      expect(Math.abs(result.confidence - fixture.confidence), fixture.text).toBeLessThan(0.01);
    }
  });

  it('covers suggestions on both sides of the threshold in the parity texts', () => {
    expect(fixtures.some((f) => f.suggestedCategory === null)).toBe(true);
    expect(fixtures.some((f) => f.suggestedCategory !== null)).toBe(true);
  });

  it('withholds the category below the confidence threshold but keeps the evidence', () => {
    const text = 'A minor typo on the notice board, already fixed.';
    const result = suggestTriage(text);

    expect(result.confidence).toBeLessThan(model.threshold);
    expect(result).toEqual({
      suggestedCategory: null,
      reason: 'low confidence',
      confidence: expect.any(Number),
      topTerms: expect.any(Array),
    });
    expect(result.topTerms.length).toBeGreaterThan(0);
  });

  it('names up to three terms from the text that pushed toward the top category', () => {
    const result = suggestTriage('The purchasing lead takes a cut from the vendor on every order.');

    expect(result.suggestedCategory).toBe('CORRUPTION');
    expect(result.reason).toBeNull();
    expect(result.topTerms.length).toBeGreaterThan(0);
    expect(result.topTerms.length).toBeLessThanOrEqual(3);
    for (const term of result.topTerms) {
      expect('the purchasing lead takes a cut from the vendor on every order').toContain(term);
    }
  });

  it('returns no top terms for text with no known words', () => {
    expect(suggestTriage('zzqx').topTerms).toEqual([]);
  });
});

describe('triage in responses', () => {
  let token: string;

  beforeEach(async () => {
    await createModerator();
    token = await loginAs();
  });

  it('adds a suggestion to the moderator list and detail views', async () => {
    const { id } = await submitReport({ description: 'My manager mocks my accent in every meeting and the team laughs along.' });
    const auth = { Authorization: `Bearer ${token}` };

    const list = await api.get('/api/moderator/reports').set(auth);
    const detail = await api.get(`/api/moderator/reports/${id}`).set(auth);

    for (const triage of [list.body.data[0].triage, detail.body.triage]) {
      expect(triage).toEqual({
        suggestedCategory: 'HARASSMENT',
        reason: null,
        confidence: expect.any(Number),
        topTerms: expect.any(Array),
      });
    }
  });

  it('returns no category with a reason when the model is unsure', async () => {
    const { id } = await submitReport({ description: 'Something happened that should be looked at.' });

    const res = await api.get(`/api/moderator/reports/${id}`).set('Authorization', `Bearer ${token}`);

    expect(res.body.triage).toMatchObject({ suggestedCategory: null, reason: 'low confidence' });
    expect(res.body.triage.confidence).toBeLessThan(model.threshold);
  });

  it('never shows a suggestion to the reporter', async () => {
    const { caseCode } = await submitReport({ description: 'Someone in purchasing takes kickbacks from a vendor.' });

    const res = await api.get('/api/reports/status').set('X-Case-Code', caseCode);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['category', 'status', 'submittedAt', 'updates']);
    expect(res.text).not.toMatch(/triage|suggested|confidence|topTerms|low confidence/i);
  });
});
