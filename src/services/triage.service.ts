import { CATEGORIES } from '../domain/statusWorkflow';
import model from '../ml/model.json';

// Inference for the model trained by ml/train.py. Every step mirrors scikit-learn's
// TfidfVectorizer and LogisticRegression.predict_proba, so results match the Python
// side (checked by tests/triage.test.ts). Suggestions are computed on read and never stored.

// A model trained on other labels would suggest values the rest of the API does not know.
const sameLabels =
  model.classes.length === CATEGORIES.length && CATEGORIES.every((label) => model.classes.includes(label));
if (!sameLabels) throw new Error('src/ml/model.json labels do not match CATEGORIES; rerun ml/train.py');

const vocabulary = new Map(model.vocabulary.map((term, index) => [term, index]));

// scikit-learn lowercases, then takes runs of two or more word characters (\b\w\w+\b).
function tokenize(text: string) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
  return words.filter((word) => [...word].length >= 2);
}

function vectorize(text: string) {
  const tokens = tokenize(text);
  const bigrams = tokens.slice(1).map((token, i) => `${tokens[i]} ${token}`);
  const weights = new Map<number, number>();

  for (const term of [...tokens, ...bigrams]) {
    const index = vocabulary.get(term);
    if (index !== undefined) weights.set(index, (weights.get(index) ?? 0) + 1);
  }

  for (const [index, count] of weights) weights.set(index, count * model.idf[index]);

  const norm = Math.sqrt([...weights.values()].reduce((sum, w) => sum + w * w, 0));
  if (norm > 0) {
    for (const [index, w] of weights) weights.set(index, w / norm);
  }

  return weights;
}

function predict(x: Map<number, number>) {
  const scores = model.intercept.map((bias, k) => {
    let score = bias;
    for (const [index, w] of x) score += w * model.coef[k][index];
    return score;
  });

  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const total = exps.reduce((sum, e) => sum + e, 0);
  const best = scores.indexOf(max);

  return { index: best, label: model.classes[best], probability: exps[best] / total };
}

function topTerms(x: Map<number, number>, coef: number[]) {
  return [...x]
    .map(([index, w]) => ({ term: model.vocabulary[index], push: w * coef[index] }))
    .filter((t) => t.push > 0)
    .sort((a, b) => b.push - a.push)
    .slice(0, 3)
    .map((t) => t.term);
}

// Below the threshold chosen in ml/metrics.md the top category is wrong too often to show.
export function suggestTriage(text: string) {
  const x = vectorize(text);
  const top = predict(x);
  const confident = top.probability >= model.threshold;

  return {
    suggestedCategory: confident ? top.label : null,
    reason: confident ? null : 'low confidence',
    confidence: Math.round(top.probability * 1000) / 1000,
    topTerms: topTerms(x, model.coef[top.index]),
  };
}
