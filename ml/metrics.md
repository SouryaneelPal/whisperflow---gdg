# Triage model metrics

## Reproducing the model

```
python3 -m venv ml/.venv
ml/.venv/bin/pip install -r ml/requirements.txt
ml/.venv/bin/python ml/train.py
```

This rewrites this file, `src/ml/model.json` and `tests/fixtures/triage-parity.json`.

## Setup

- 300 hand-written reports, 5 categories.
- TF-IDF (unigrams and bigrams, lowercase, token pattern `\b\w\w+\b`) and multinomial logistic regression.
- Stratified 5-fold cross-validation on the full dataset, `random_state=42`.
  Scores are mean ± standard deviation across folds; confusion matrices are summed across folds.
- The shipped model is retrained on all reports after evaluation.

## Category

| model | accuracy | macro F1 |
|---|---|---|
| majority-class baseline | 0.200 ± 0.000 | 0.067 ± 0.000 |
| TF-IDF, min_df=1 | 0.557 ± 0.044 | 0.558 ± 0.042 |
| TF-IDF, min_df=2 | 0.540 ± 0.072 | 0.539 ± 0.074 |

**Kept: min_df=1.** min_df=2 is kept only if its cross-validated macro F1 is not lower than min_df=1.

Summed confusion matrix (min_df=1):

| actual \ predicted | CORRUPTION | HARASSMENT | OTHER | SECURITY | TECHNICAL |
|---|---|---|---|---|---|
| CORRUPTION | 38 | 3 | 9 | 9 | 1 |
| HARASSMENT | 3 | 45 | 4 | 7 | 1 |
| OTHER | 11 | 5 | 26 | 11 | 7 |
| SECURITY | 8 | 5 | 9 | 29 | 9 |
| TECHNICAL | 7 | 0 | 8 | 16 | 29 |

## Confidence threshold

Measured on the out-of-fold predictions above only. A report gets a suggestion when the
top-class probability is at least the threshold; below it the API returns no category.

| threshold | reports with a suggestion | share | accuracy on those |
|---|---|---|---|
| 0.200 | 300 | 100% | 0.557 |
| 0.225 | 273 | 91% | 0.579 |
| 0.250 | 186 | 62% | 0.624 |
| 0.275 | 113 | 38% | 0.699 |
| 0.300 (chosen) | 72 | 24% | 0.792 |
| 0.325 | 53 | 18% | 0.868 |
| 0.350 | 33 | 11% | 0.909 |
| 0.375 | 25 | 8% | 0.880 |
| 0.400 | 19 | 6% | 0.895 |
| 0.425 | 14 | 5% | 0.857 |
| 0.450 | 10 | 3% | 0.800 |
| 0.475 | 8 | 3% | 0.750 |
| 0.500 | 6 | 2% | 1.000 |

**Chosen: 0.300.** It is the lowest threshold where suggestions are right at least
75% of the time with at least 30 reports measured. At this
threshold 24% of reports get a suggestion and 79.2% of those are right,
against 55.7% when every report gets one. The other reports still show
the probability and top terms, so moderators can see why no category was suggested.

Probabilities from the shipped model can run slightly higher than in cross-validation,
because it is trained on all 300 reports instead of four fifths of them.

## Urgency (tried and rejected)

| model | accuracy | macro F1 |
|---|---|---|
| always MEDIUM (majority-class baseline) | 0.410 ± 0.008 | 0.194 ± 0.003 |
| TF-IDF, min_df=1 | 0.420 ± 0.041 | 0.320 ± 0.034 |

| actual \ predicted | HIGH | LOW | MEDIUM |
|---|---|---|---|
| HIGH | 52 | 0 | 58 |
| LOW | 18 | 1 | 48 |
| MEDIUM | 48 | 2 | 73 |

Urgency is still in `dataset.csv` and evaluated here, but it is not exported or shown to
moderators. It does not beat always answering MEDIUM by a useful margin, and it almost never
predicts LOW correctly. Urgency depends on cues such as "right now", "today" or "already fixed"
that a bag-of-words model cannot learn from 300 short reports, and a wrong urgency
could make a moderator deprioritise a serious report.

## Export

`src/ml/model.json`: 4402 terms, 607 KB.
