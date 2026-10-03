import { CATEGORIES, URGENCIES } from '../domain/statusWorkflow';
import model from '../ml/model.json';

// Inference for the models trained by ml/train.py. Every step mirrors scikit-learn's
// TfidfVectorizer and LogisticRegression.predict_proba, so results match the Python
// side (checked by tests/triage.test.ts). Suggestions are computed on read and never stored.

type Head = { classes: string[]; coef: number[][]; intercept: number[] };

// A model trained on other labels would suggest values the rest of the API does not know.
function checkLabels(head: Head, expected: readonly string[]) {
  const same = head.classes.length === expected.length && expected.every((label) => head.classes.includes(label));
  if (!same) throw new Error('src/ml/model.json labels do not match the API constants; rerun ml/train.py');
}

checkLabels(model.category, CATEGORIES);
checkLabels(model.urgency, URGENCIES);

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

function predict(head: Head, x: Map<number, number>) {
  const scores = head.intercept.map((bias, k) => {
    let score = bias;
    for (const [index, w] of x) score += w * head.coef[k][index];
    return score;
  });

  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const total = exps.reduce((sum, e) => sum + e, 0);
  const best = scores.indexOf(max);

  return { index: best, label: head.classes[best], probability: exps[best] / total };
}

function topTerms(x: Map<number, number>, coef: number[]) {
  return [...x]
    .map(([index, w]) => ({ term: model.vocabulary[index], push: w * coef[index] }))
    .filter((t) => t.push > 0)
    .sort((a, b) => b.push - a.push)
    .slice(0, 3)
    .map((t) => t.term);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function suggestTriage(text: string) {
  const x = vectorize(text);
  const category = predict(model.category, x);
  const urgency = predict(model.urgency, x);

  return {
    suggestedCategory: category.label,
    confidence: round(category.probability),
    suggestedUrgency: urgency.label,
    urgencyConfidence: round(urgency.probability),
    topTerms: topTerms(x, model.category.coef[category.index]),
  };
}
