import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import head from '../src/ml/embedding-head.json';
import model from '../src/ml/model.json';
import { classifyEmbedding, startEmbeddings, suggestTriage } from '../src/services/triage.service';
import { logger } from '../src/utils/logger';
import { api, createModerator, loginAs, submitReport } from './helpers';

type Fixture = { text: string; topCategory: string; confidence: number; suggestedCategory: string | null };
type EmbeddingFixture = { vector: number[]; topCategory: string; confidence: number; suggestedCategory: string | null };

// Both written by ml/train.py from scikit-learn's own predictions.
const fixtures: Fixture[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/triage-parity.json'), 'utf8'),
);
const embeddingFixtures: EmbeddingFixture[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/embedding-parity.json'), 'utf8'),
);

const neverReady = () => new Promise<never>(() => {});

describe('TF-IDF model', () => {
  it('matches the scikit-learn predictions for the parity texts', async () => {
    expect(fixtures).toHaveLength(8);

    for (const fixture of fixtures) {
      const result = await suggestTriage(fixture.text);

      expect(result.suggestedCategory, fixture.text).toBe(fixture.suggestedCategory);
      expect(Math.abs(result.confidence - fixture.confidence), fixture.text).toBeLessThan(0.01);
    }
  });

  it('covers suggestions on both sides of the threshold in the parity texts', () => {
    expect(fixtures.some((f) => f.suggestedCategory === null)).toBe(true);
    expect(fixtures.some((f) => f.suggestedCategory !== null)).toBe(true);
  });

  it('withholds the category below the confidence threshold but keeps the evidence', async () => {
    const text = 'A minor typo on the notice board, already fixed.';
    const result = await suggestTriage(text);

    expect(result.confidence).toBeLessThan(model.threshold);
    expect(result).toEqual({
      model: 'tfidf',
      suggestedCategory: null,
      reason: 'low confidence',
      confidence: expect.any(Number),
      topTerms: expect.any(Array),
    });
    expect(result.topTerms.length).toBeGreaterThan(0);
  });

  it('names up to three terms from the text that pushed toward the top category', async () => {
    const result = await suggestTriage('The purchasing lead takes a cut from the vendor on every order.');

    expect(result.suggestedCategory).toBe('CORRUPTION');
    expect(result.reason).toBeNull();
    expect(result.topTerms.length).toBeGreaterThan(0);
    expect(result.topTerms.length).toBeLessThanOrEqual(3);
    for (const term of result.topTerms) {
      expect('the purchasing lead takes a cut from the vendor on every order').toContain(term);
    }
  });

  it('returns no top terms for text with no known words', async () => {
    expect((await suggestTriage('zzqx')).topTerms).toEqual([]);
  });
});

describe('embedding head', () => {
  it('matches the scikit-learn predictions for the parity vectors', () => {
    expect(embeddingFixtures).toHaveLength(8);

    for (const [i, fixture] of embeddingFixtures.entries()) {
      const result = classifyEmbedding(fixture.vector);

      expect(result.suggestedCategory, `vector ${i}`).toBe(fixture.suggestedCategory);
      expect(Math.abs(result.confidence - fixture.confidence), `vector ${i}`).toBeLessThan(0.01);
    }
  });

  it('labels its suggestions as embeddings without top terms', () => {
    const result = classifyEmbedding(embeddingFixtures[0].vector);

    expect(result.model).toBe('embeddings');
    expect(result.topTerms).toEqual([]);
    expect(result.confidence).toBeGreaterThanOrEqual(head.threshold);
  });
});

describe('choosing a model', () => {
  const vector = () => embeddingFixtures[0].vector;

  afterEach(() => {
    startEmbeddings(neverReady);
    vi.restoreAllMocks();
  });

  it('uses TF-IDF while the embedding model is still loading', async () => {
    startEmbeddings(neverReady);

    expect((await suggestTriage('The vendor pays the purchasing lead.')).model).toBe('tfidf');
  });

  it('falls back to TF-IDF when the embedding model fails to load', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await startEmbeddings(() => Promise.reject(new Error('model files missing')));

    expect((await suggestTriage('The vendor pays the purchasing lead.')).model).toBe('tfidf');
    expect(warn).toHaveBeenCalledWith('Triage model: tfidf (embedding model unavailable: model files missing)');
  });

  it('uses embeddings once the model is ready', async () => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});

    await startEmbeddings(async () => async () => vector());

    expect(await suggestTriage('any text')).toEqual(classifyEmbedding(vector()));
  });

  it('falls back to TF-IDF for one report if embedding it fails, without logging its text', async () => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await startEmbeddings(async () => async (text) => {
      throw new TypeError(`cannot embed ${text}`);
    });

    const result = await suggestTriage('Secret report text');

    expect(result.model).toBe('tfidf');
    expect(warn).toHaveBeenCalledWith('Embedding failed, using TF-IDF: TypeError');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Secret report text');
  });
});

describe('triage in responses', () => {
  let token: string;

  beforeEach(async () => {
    await createModerator();
    token = await loginAs();
  });

  afterEach(() => {
    startEmbeddings(neverReady);
    vi.restoreAllMocks();
  });

  it('adds a TF-IDF suggestion to the moderator list and detail views by default in tests', async () => {
    const { id } = await submitReport({ description: 'My manager mocks my accent in every meeting and the team laughs along.' });
    const auth = { Authorization: `Bearer ${token}` };

    const list = await api.get('/api/moderator/reports').set(auth);
    const detail = await api.get(`/api/moderator/reports/${id}`).set(auth);

    for (const triage of [list.body.data[0].triage, detail.body.triage]) {
      expect(triage).toEqual({
        model: 'tfidf',
        suggestedCategory: 'HARASSMENT',
        reason: null,
        confidence: expect.any(Number),
        topTerms: expect.any(Array),
      });
    }
  });

  it('reports which model made the suggestion once embeddings are ready', async () => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    await startEmbeddings(async () => async () => embeddingFixtures[1].vector);
    const { id } = await submitReport();

    const res = await api.get(`/api/moderator/reports/${id}`).set('Authorization', `Bearer ${token}`);

    expect(res.body.triage).toEqual({ ...classifyEmbedding(embeddingFixtures[1].vector), topTerms: [] });
    expect(res.body.triage.model).toBe('embeddings');
  });

  it('returns no category with a reason when the model is unsure', async () => {
    const { id } = await submitReport({ description: 'Something happened that should be looked at.' });

    const res = await api.get(`/api/moderator/reports/${id}`).set('Authorization', `Bearer ${token}`);

    expect(res.body.triage).toMatchObject({ model: 'tfidf', suggestedCategory: null, reason: 'low confidence' });
    expect(res.body.triage.confidence).toBeLessThan(model.threshold);
  });

  it('never shows a suggestion to the reporter', async () => {
    const { caseCode } = await submitReport({ description: 'Someone in purchasing takes kickbacks from a vendor.' });

    const res = await api.get('/api/reports/status').set('X-Case-Code', caseCode);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['category', 'status', 'submittedAt', 'updates']);
    expect(res.text).not.toMatch(/triage|suggested|confidence|topTerms|low confidence|tfidf|embeddings/i);
  });
});
