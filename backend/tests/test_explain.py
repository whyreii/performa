"""Tests for exact Shapley explanations and permutation importance.

These exercise ``backend/ml/explain.py`` directly (no DB or HTTP needed). They
require a trained model, which CI generates via ``python -m backend.ml.train``
and which exists locally at ``backend/ml/models/rf_model.joblib``.
"""
from __future__ import annotations

import numpy as np
import pytest

from backend.ml.catalog import COMPETENCIES
from backend.ml.explain import (
    explain_prediction,
    permutation_importances,
    risk_polarity,
    shapley_values,
)
from backend.ml.predictor import _load_model, predict_employee_risk

SCORES = {
    "task_completion": 2.1,
    "attendance_and_punctuality": 4.8,
    "communication_and_teamwork": 4.0,
    "initiative_and_adaptability": 3.9,
    "quality_of_work": 2.2,
}


def test_shapley_efficiency_axiom():
    """The Shapley values must sum to f(x) - E[f] (the efficiency axiom)."""
    result = shapley_values(SCORES)
    model = _load_model()
    classes = [str(label) for label in model.classes_]
    target_index = classes.index(result["target_class"])

    x = np.asarray([[SCORES[name] for name in COMPETENCIES]], dtype=float)
    f_x = float(model.predict_proba(x)[0][target_index])

    total = sum(result["shap_values"].values())
    assert abs(total - (f_x - result["base_value"])) < 1e-3


def test_shapley_is_deterministic():
    assert shapley_values(SCORES) == shapley_values(SCORES)


def test_shapley_values_cover_all_competencies():
    result = shapley_values(SCORES)
    assert set(result["shap_values"]) == set(COMPETENCIES)
    assert result["target_class"] in [str(label) for label in _load_model().classes_]


def test_permutation_importances_shape():
    importances = permutation_importances()
    assert set(importances) == set(COMPETENCIES)
    assert all(value >= 0.0 for value in importances.values())
    assert abs(sum(importances.values()) - 1.0) < 1e-3


def test_explain_prediction_matches_predicted_tier():
    explanation = explain_prediction(SCORES)
    predicted_tier = predict_employee_risk(SCORES)["predicted_tier"]
    assert explanation["shap_target_class"] == predicted_tier
    assert set(explanation["shap_values"]) == set(COMPETENCIES)
    assert set(explanation["permutation_importances"]) == set(COMPETENCIES)
    assert isinstance(explanation["shap_base_value"], float)
    assert "Exact Shapley" in explanation["explanation_method"]


def test_risk_polarity_maps_gap_tiers_to_risk():
    assert risk_polarity("Critical Gap") == "risk"
    assert risk_polarity("Needs Improvement") == "risk"
    assert risk_polarity("Meets Expectations") == "safe"


def test_explain_prediction_reports_consistent_polarity():
    explanation = explain_prediction(SCORES)
    assert explanation["shap_risk_polarity"] == risk_polarity(explanation["shap_target_class"])


def test_high_scores_are_safe_polarity():
    strong = {name: 5.0 for name in COMPETENCIES}
    explanation = explain_prediction(strong)
    assert explanation["shap_target_class"] == "Meets Expectations"
    assert explanation["shap_risk_polarity"] == "safe"


def test_missing_competency_rejected():
    incomplete = dict(SCORES)
    incomplete.pop("quality_of_work")
    with pytest.raises(ValueError):
        shapley_values(incomplete)


def test_out_of_range_score_rejected():
    invalid = dict(SCORES)
    invalid["quality_of_work"] = 9.0
    with pytest.raises(ValueError):
        shapley_values(invalid)
