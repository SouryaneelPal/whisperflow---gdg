import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { suggestTriage } from '../src/services/triage.service';
import { api, createModerator, loginAs, submitReport } from './helpers';

type Fixture = { text: string; category: string; confidence: number; urgency: string; urgencyConfidence: number };

// Written by ml/train.py from scikit-learn's own predictions.
const fixtures: Fixture[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/triage-parity.json'), 'utf8'),
);

describe('triage model', () => {
  it('matches the scikit-learn predictions for the parity texts', () => {
    expect(fixtures).toHaveLength(8);

    for (const fixture of fixtures) {
      const result = suggestTriage(fixture.text);

      expect(result.suggestedCategory, fixture.text).toBe(fixture.category);
      expect(result.suggestedUrgency, fixture.text).toBe(fixture.urgency);
      expect(Math.abs(result.confidence - fixture.confidence), fixture.text).toBeLessThan(0.01);
      expect(Math.abs(result.urgencyConfidence - fixture.urgencyConfidence), fixture.text).toBeLessThan(0.01);
    }
  });

  it('names up to three terms from the text that pushed toward the suggested category', () => {
    const result = suggestTriage('The purchasing lead takes a cut from the vendor on every order.');

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
    const { id } = await submitReport({ description: 'Someone in purchasing takes kickbacks from a vendor.' });
    const auth = { Authorization: `Bearer ${token}` };

    const list = await api.get('/api/moderator/reports').set(auth);
    const detail = await api.get(`/api/moderator/reports/${id}`).set(auth);

    for (const triage of [list.body.data[0].triage, detail.body.triage]) {
      expect(triage).toEqual({
        suggestedCategory: expect.any(String),
        confidence: expect.any(Number),
        suggestedUrgency: expect.any(String),
        urgencyConfidence: expect.any(Number),
        topTerms: expect.any(Array),
      });
    }
  });

  it('never shows a suggestion to the reporter', async () => {
    const { caseCode } = await submitReport({ description: 'Someone in purchasing takes kickbacks from a vendor.' });

    const res = await api.get('/api/reports/status').set('X-Case-Code', caseCode);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['category', 'status', 'submittedAt', 'updates']);
    expect(res.text).not.toMatch(/triage|suggested|urgency|confidence|topTerms/i);
  });
});
