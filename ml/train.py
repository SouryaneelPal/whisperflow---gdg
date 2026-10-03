"""Train the moderator triage models and export them for the TypeScript service.

Run from the repo root with the local venv:
    ml/.venv/bin/python ml/train.py
"""

import csv
import json
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent.parent
DATASET = ROOT / "ml" / "dataset.csv"
METRICS = ROOT / "ml" / "metrics.md"
MODEL = ROOT / "src" / "ml" / "model.json"
PARITY = ROOT / "tests" / "fixtures" / "triage-parity.json"
RANDOM_STATE = 42

# Fixed texts whose predictions the TypeScript port must reproduce. The last two cover
# a text with no known words and accented characters.
PARITY_TEXTS = [
    "Someone keeps forwarding confidential client files to a personal email address.",
    "My manager mocks my accent in every meeting and the team laughs along.",
    "The purchasing lead takes a cut from the vendor on every order.",
    "Backups have failed for two weeks and nobody checks the alerts.",
    "The stairs near the loading dock have no railing and someone will fall.",
    "A minor typo on the notice board, already fixed.",
    "Hello there.",
    "Le café du bureau est très sale, the canteen food made people sick.",
]


def load():
    with DATASET.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    texts = [row["text"] for row in rows]
    return texts, [row["category"] for row in rows], [row["urgency"] for row in rows]


def make_vectorizer():
    # These settings are what the TypeScript tokenizer reproduces; change both together.
    return TfidfVectorizer(lowercase=True, ngram_range=(1, 2), token_pattern=r"\b\w\w+\b")


def make_model():
    return LogisticRegression(max_iter=2000)


def report(name, y_true, y_pred, labels):
    matrix = confusion_matrix(y_true, y_pred, labels=labels)
    header = "| actual \\ predicted | " + " | ".join(labels) + " |"
    divider = "|" + "---|" * (len(labels) + 1)
    rows = [f"| {label} | " + " | ".join(str(n) for n in row) + " |" for label, row in zip(labels, matrix)]

    text = "\n".join([
        f"## {name}",
        "",
        f"Accuracy: {accuracy_score(y_true, y_pred):.3f}",
        "",
        "```",
        classification_report(y_true, y_pred, labels=labels, zero_division=0).rstrip(),
        "```",
        "",
        header,
        divider,
        *rows,
        "",
    ])
    print(text)
    return text


def evaluate(texts, categories, urgencies):
    # Stratify on both labels so every category/urgency pair shows up in the test set.
    strata = [f"{c}/{u}" for c, u in zip(categories, urgencies)]
    train_idx, test_idx = train_test_split(
        list(range(len(texts))), test_size=0.2, stratify=strata, random_state=RANDOM_STATE
    )

    vectorizer = make_vectorizer()
    x_train = vectorizer.fit_transform([texts[i] for i in train_idx])
    x_test = vectorizer.transform([texts[i] for i in test_idx])

    sections = []
    for name, labels in [("Category", categories), ("Urgency", urgencies)]:
        model = make_model().fit(x_train, [labels[i] for i in train_idx])
        y_true = [labels[i] for i in test_idx]
        sections.append(report(name, y_true, model.predict(x_test), sorted(set(labels))))

    intro = (
        "# Triage model metrics\n\n"
        f"Held-out evaluation: stratified 80/20 split, random_state={RANDOM_STATE}, "
        f"{len(train_idx)} training and {len(test_idx)} test reports. "
        "The exported model is retrained on all reports afterwards.\n\n"
    )
    METRICS.write_text(intro + "\n".join(sections), encoding="utf-8")


def export_head(model):
    # The TypeScript side applies a softmax over every class, which is what scikit-learn
    # does for multinomial logistic regression with three or more classes.
    assert len(model.classes_) > 2
    return {
        "classes": [str(c) for c in model.classes_],
        "coef": model.coef_.tolist(),
        "intercept": model.intercept_.tolist(),
    }


def export(texts, categories, urgencies):
    vectorizer = make_vectorizer()
    x = vectorizer.fit_transform(texts)
    category_model = make_model().fit(x, categories)
    urgency_model = make_model().fit(x, urgencies)

    MODEL.parent.mkdir(parents=True, exist_ok=True)
    MODEL.write_text(json.dumps({
        "vocabulary": vectorizer.get_feature_names_out().tolist(),
        "idf": vectorizer.idf_.tolist(),
        "category": export_head(category_model),
        "urgency": export_head(urgency_model),
    }), encoding="utf-8")

    x_parity = vectorizer.transform(PARITY_TEXTS)
    fixtures = []
    for text, category_probs, urgency_probs in zip(
        PARITY_TEXTS, category_model.predict_proba(x_parity), urgency_model.predict_proba(x_parity)
    ):
        c, u = category_probs.argmax(), urgency_probs.argmax()
        fixtures.append({
            "text": text,
            "category": str(category_model.classes_[c]),
            "confidence": float(category_probs[c]),
            "urgency": str(urgency_model.classes_[u]),
            "urgencyConfidence": float(urgency_probs[u]),
        })

    PARITY.parent.mkdir(parents=True, exist_ok=True)
    PARITY.write_text(json.dumps(fixtures, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {MODEL.relative_to(ROOT)} ({len(vectorizer.vocabulary_)} terms) and {PARITY.relative_to(ROOT)}")


def main():
    texts, categories, urgencies = load()
    evaluate(texts, categories, urgencies)
    export(texts, categories, urgencies)


if __name__ == "__main__":
    main()
