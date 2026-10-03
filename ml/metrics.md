# Triage model metrics

Held-out evaluation: stratified 80/20 split, random_state=42, 240 training and 60 test reports. The exported model is retrained on all reports afterwards.

## Category

Accuracy: 0.583

```
              precision    recall  f1-score   support

  CORRUPTION       0.58      0.85      0.69        13
  HARASSMENT       0.83      0.91      0.87        11
       OTHER       0.56      0.42      0.48        12
    SECURITY       0.36      0.33      0.35        12
   TECHNICAL       0.56      0.42      0.48        12

    accuracy                           0.58        60
   macro avg       0.58      0.58      0.57        60
weighted avg       0.57      0.58      0.57        60
```

| actual \ predicted | CORRUPTION | HARASSMENT | OTHER | SECURITY | TECHNICAL |
|---|---|---|---|---|---|
| CORRUPTION | 11 | 0 | 1 | 1 | 0 |
| HARASSMENT | 0 | 10 | 0 | 1 | 0 |
| OTHER | 2 | 2 | 5 | 2 | 1 |
| SECURITY | 4 | 0 | 1 | 4 | 3 |
| TECHNICAL | 2 | 0 | 2 | 3 | 5 |

## Urgency

Accuracy: 0.333

```
              precision    recall  f1-score   support

        HIGH       0.35      0.32      0.33        22
         LOW       0.00      0.00      0.00        13
      MEDIUM       0.34      0.52      0.41        25

    accuracy                           0.33        60
   macro avg       0.23      0.28      0.25        60
weighted avg       0.27      0.33      0.29        60
```

| actual \ predicted | HIGH | LOW | MEDIUM |
|---|---|---|---|
| HIGH | 7 | 0 | 15 |
| LOW | 3 | 0 | 10 |
| MEDIUM | 10 | 2 | 13 |
