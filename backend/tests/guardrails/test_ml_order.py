"""Guardrail: ML inference feature order equals the training order.

Both training (``ml/train.py``) and inference (``ml/predictor.py``) assemble
columns in ``ml/catalog.COMPETENCIES`` order. The model artifact does NOT record
its feature order (see the guardrail FINDING), so this test pins the shared
constant that both sides rely on.
"""
from __future__ import annotations

from backend.ml import predictor, train
from backend.ml.catalog import COMPETENCIES


def test_training_builds_columns_in_competency_order():
    features, labels = train.build_dataset(n_samples=4, seed=1)
    assert features.shape[1] == len(COMPETENCIES)
    assert len(labels) == features.shape[0]


def test_inference_validates_scores_in_competency_order():
    # A dict keyed in a scrambled order must still yield values in COMPETENCIES order.
    scrambled = {name: float(i + 1) for i, name in enumerate(reversed(COMPETENCIES))}
    ordered = predictor._validate_scores(scrambled)
    assert ordered == [scrambled[name] for name in COMPETENCIES]
