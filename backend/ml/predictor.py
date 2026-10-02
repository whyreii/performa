"""Inference service for the Random Forest competency-risk classifier.

The trained model is loaded lazily from ``backend/ml/models/rf_model.joblib``.
Feature vectors are always assembled in the canonical ``COMPETENCIES`` order.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

from .catalog import COMPETENCIES

MODEL_DIR: Path = Path(__file__).resolve().parent / "models"
MODEL_PATH: Path = MODEL_DIR / "rf_model.joblib"


@lru_cache(maxsize=1)
def _load_model():
    """Load and cache the persisted classifier."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Trained model not found at {MODEL_PATH}. "
            "Run 'python -m backend.ml.train' to generate it."
        )
    return joblib.load(MODEL_PATH)


def _validate_scores(scores: dict) -> list[float]:
    """Validate input and return values ordered by ``COMPETENCIES``."""
    if not isinstance(scores, dict):
        raise ValueError("scores must be a mapping of competency name to numeric value")

    missing = [name for name in COMPETENCIES if name not in scores]
    if missing:
        raise ValueError(f"Missing competency scores: {', '.join(missing)}")

    values: list[float] = []
    for name in COMPETENCIES:
        raw = scores[name]
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            raise ValueError(f"Score for '{name}' must be a number between 1.0 and 5.0")
        value = float(raw)
        if not 1.0 <= value <= 5.0:
            raise ValueError(
                f"Score for '{name}' must be between 1.0 and 5.0 (got {value})"
            )
        values.append(value)
    return values


def predict_employee_risk(scores: dict) -> dict:
    """Predict the competency risk tier for a single employee.

    Args:
        scores: Mapping containing all five competency keys with values in
            ``[1.0, 5.0]``.

    Returns:
        A payload with ``predicted_tier``, ``confidence``, ``probabilities``,
        and ``flagged_competencies``.

    Raises:
        ValueError: If required keys are missing or values are out of range.
        FileNotFoundError: If no trained model has been generated yet.
    """
    values = _validate_scores(scores)
    features = np.asarray([values], dtype=float)

    model = _load_model()
    classes = [str(label) for label in model.classes_]

    predicted_tier = str(model.predict(features)[0])
    raw_probabilities = model.predict_proba(features)[0]

    probabilities = {
        label: round(float(probability), 4)
        for label, probability in zip(classes, raw_probabilities)
    }
    confidence = round(float(raw_probabilities[classes.index(predicted_tier)]), 4)

    flagged_competencies = [
        name for name in COMPETENCIES if float(scores[name]) < 3.0
    ]

    return {
        "predicted_tier": predicted_tier,
        "confidence": confidence,
        "probabilities": probabilities,
        "flagged_competencies": flagged_competencies,
    }


__all__ = ["MODEL_DIR", "MODEL_PATH", "predict_employee_risk"]
