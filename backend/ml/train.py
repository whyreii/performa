"""Train the Random Forest competency-risk classifier.

Generates a synthetic, deterministic dataset, applies the labelling priority
cascade, trains a ``RandomForestClassifier`` using the canonical
``COMPETENCIES`` column ordering, and persists the fitted model to
``backend/ml/models/rf_model.joblib``.

Run with::

    python -m backend.ml.train
"""
from __future__ import annotations

import csv
import os
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

from .catalog import COMPETENCIES

N_SAMPLES = 600
RANDOM_STATE = 42
TEST_SIZE = 0.2

CRITICAL_GAP = "Critical Gap"
NEEDS_IMPROVEMENT = "Needs Improvement"
MEETS_EXPECTATIONS = "Meets Expectations"

MODEL_PATH: Path = Path(__file__).resolve().parent / "models" / "rf_model.joblib"

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


def train_model() -> tuple[RandomForestClassifier, float, str]:
    """Train, evaluate, and persist the classifier.

    Returns:
        A tuple of the fitted model, test accuracy, and the classification
        report text.
    """
    features, labels = load_dataset()

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=labels,
    )

    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=6,
        random_state=RANDOM_STATE,
    )
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    accuracy = float(accuracy_score(y_test, predictions))
    report = classification_report(y_test, predictions, zero_division=0)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    return model, accuracy, report


def main() -> None:
    """Entrypoint: train the model and print split metrics."""
    features, labels = load_dataset()
    unique, counts = np.unique(labels, return_counts=True)
    distribution = ", ".join(f"{label}={count}" for label, count in zip(unique, counts))

    _, accuracy, report = train_model()

    print(f"Dataset: {features.shape[0]} rows x {features.shape[1]} competencies")
    print(f"Label distribution: {distribution}")
    print(f"Model saved to: {MODEL_PATH}")
    print(f"Test accuracy: {accuracy:.4f}")
    print("Classification report (test split):")
    print(report)


if __name__ == "__main__":
    main()
