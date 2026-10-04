"""Train and evaluate the Random Forest competency-risk classifier.

Generates a synthetic, deterministic dataset (or loads a real CSV when
``TRAINING_DATASET`` is set), applies the labelling priority cascade, splits it
**70 / 15 / 15** into train / validation / test (the manuscript's split), trains a
``RandomForestClassifier`` using the canonical ``COMPETENCIES`` column ordering,
reports held-out metrics, and persists the fitted model to
``backend/ml/models/rf_model.joblib``.

Run with::

    python -m backend.ml.train
"""
from __future__ import annotations

import csv
import json
import os
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split

from .catalog import COMPETENCIES

N_SAMPLES = 600
RANDOM_STATE = 42
# Manuscript split: 70% train, 15% validation, 15% test.
TRAIN_FRAC = 0.70
VAL_FRAC = 0.15
TEST_FRAC = 0.15

CRITICAL_GAP = "Critical Gap"
NEEDS_IMPROVEMENT = "Needs Improvement"
MEETS_EXPECTATIONS = "Meets Expectations"

MODEL_PATH: Path = Path(__file__).resolve().parent / "models" / "rf_model.joblib"
METRICS_PATH: Path = Path(__file__).resolve().parent / "models" / "metrics.json"

# Optional path to a real dataset (CSV with one column per competency).
DATASET_PATH = os.getenv("TRAINING_DATASET")


def _label_row(scores: np.ndarray) -> str:
    """Apply the airtight labelling priority cascade to one score row."""
    overall_mean = float(np.mean(scores))
    std_dev = float(np.std(scores))
    quality_of_work = float(scores[COMPETENCIES.index("quality_of_work")])
    task_completion = float(scores[COMPETENCIES.index("task_completion")])

    if overall_mean < 2.5 or min(quality_of_work, task_completion) < 2.0:
        return CRITICAL_GAP
    if overall_mean < 3.5 or float(np.min(scores)) < 3.0 or std_dev > 1.0:
        return NEEDS_IMPROVEMENT
    return MEETS_EXPECTATIONS


def build_dataset(
    n_samples: int = N_SAMPLES,
    seed: int = RANDOM_STATE,
) -> tuple[np.ndarray, np.ndarray]:
    """Generate ``n_samples`` bounded feature rows and their cascade labels.

    Columns are assembled strictly in ``COMPETENCIES`` order and every value is
    bounded to the rubric range ``[1.0, 5.0]``.
    """
    rng = np.random.default_rng(seed)
    columns = {name: rng.uniform(1.0, 5.0, size=n_samples) for name in COMPETENCIES}
    features = np.column_stack([columns[name] for name in COMPETENCIES])
    features = np.clip(features, 1.0, 5.0)
    labels = np.asarray([_label_row(row) for row in features])
    return features, labels


def load_dataset() -> tuple[np.ndarray, np.ndarray]:
    """Load a real CSV dataset when ``TRAINING_DATASET`` is set, else synthetic.

    The CSV must contain one column per competency (values in [1.0, 5.0]).
    Labels are derived with the same priority cascade.
    """
    if DATASET_PATH:
        path = Path(DATASET_PATH)
        if path.exists():
            with path.open(newline="", encoding="utf-8") as handle:
                reader = csv.DictReader(handle)
                fieldnames = reader.fieldnames or []
                missing = [column for column in COMPETENCIES if column not in fieldnames]
                if missing:
                    raise ValueError(
                        f"Dataset missing required competency columns: {missing}"
                    )
                rows = [[float(row[column]) for column in COMPETENCIES] for row in reader]
            features = np.asarray(rows, dtype=float)
            labels = np.asarray([_label_row(row) for row in features])
            return features, labels
        print(f"TRAINING_DATASET set to {path} but not found; using synthetic data.")
    return build_dataset()


def split_dataset(
    features: np.ndarray,
    labels: np.ndarray,
    seed: int = RANDOM_STATE,
):
    """Stratified 70 / 15 / 15 train / validation / test split."""
    x_train, x_temp, y_train, y_temp = train_test_split(
        features,
        labels,
        test_size=(VAL_FRAC + TEST_FRAC),
        random_state=seed,
        stratify=labels,
    )
    x_val, x_test, y_val, y_test = train_test_split(
        x_temp,
        y_temp,
        test_size=TEST_FRAC / (VAL_FRAC + TEST_FRAC),
        random_state=seed,
        stratify=y_temp,
    )
    return x_train, x_val, x_test, y_train, y_val, y_test


def _metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """Held-out metrics for one split."""
    labels = sorted(set(y_true) | set(y_pred))
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision_macro": round(
            float(precision_score(y_true, y_pred, average="macro", zero_division=0)), 4
        ),
        "recall_macro": round(
            float(recall_score(y_true, y_pred, average="macro", zero_division=0)), 4
        ),
        "f1_macro": round(
            float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4
        ),
        "f1_weighted": round(
            float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4
        ),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
        "labels": labels,
        "classification_report": classification_report(
            y_true, y_pred, labels=labels, zero_division=0
        ),
    }


def train_model() -> tuple[RandomForestClassifier, dict]:
    """Train, evaluate (validation + test), and persist the classifier.

    Returns:
        A tuple of the fitted model and a metrics dict with ``validation`` and
        ``test`` entries, plus the split sizes.
    """
    features, labels = load_dataset()
    x_train, x_val, x_test, y_train, y_val, y_test = split_dataset(features, labels)

    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=6,
        random_state=RANDOM_STATE,
        # The competency cascade yields far fewer "Meets Expectations" rows than
        # gap rows; balanced class weights stop the model from ignoring the
        # minority class (which otherwise scores ~0 F1).
        class_weight="balanced",
    )
    model.fit(x_train, y_train)

    metrics = {
        "split": {
            "train": int(len(x_train)),
            "validation": int(len(x_val)),
            "test": int(len(x_test)),
            "fractions": {"train": TRAIN_FRAC, "validation": VAL_FRAC, "test": TEST_FRAC},
        },
        "validation": _metrics(y_val, model.predict(x_val)),
        "test": _metrics(y_test, model.predict(x_test)),
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    return model, metrics


def main() -> None:
    """Entrypoint: train the model and print held-out metrics."""
    features, labels = load_dataset()
    unique, counts = np.unique(labels, return_counts=True)
    distribution = ", ".join(f"{label}={count}" for label, count in zip(unique, counts))

    _, metrics = train_model()

    print(f"Dataset: {features.shape[0]} rows x {features.shape[1]} competencies")
    print(f"Label distribution: {distribution}")
    print(f"Model saved to: {MODEL_PATH}")
    print(f"Metrics saved to: {METRICS_PATH}")
    print(
        "Split: "
        f"train={metrics['split']['train']} "
        f"validation={metrics['split']['validation']} "
        f"test={metrics['split']['test']}"
    )
    for split in ("validation", "test"):
        m = metrics[split]
        print(
            f"{split.capitalize()} — accuracy={m['accuracy']:.4f} "
            f"precision(macro)={m['precision_macro']:.4f} "
            f"recall(macro)={m['recall_macro']:.4f} "
            f"f1(macro)={m['f1_macro']:.4f} f1(weighted)={m['f1_weighted']:.4f}"
        )
        print(f"{split.capitalize()} confusion matrix (labels={m['labels']}):")
        for row in m["confusion_matrix"]:
            print(f"  {row}")
        print(f"{split.capitalize()} classification report:")
        print(m["classification_report"])


if __name__ == "__main__":
    main()
