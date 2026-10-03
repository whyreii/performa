"""Guardrail: exactly the 5 statutory competencies, consistent across the code.

Source of truth: ARCHITECTURE.md §2. Asserts the DB enum, the ML feature order,
and the training catalog all agree on the same five IDs — no sixth, none renamed.
"""
from __future__ import annotations

import json
from pathlib import Path

from backend.ml.catalog import CATALOG_PATH, COMPETENCIES
from backend.models import CompetencyEnum

EXPECTED = {
    "task_completion",
    "attendance_and_punctuality",
    "communication_and_teamwork",
    "initiative_and_adaptability",
    "quality_of_work",
}


def test_model_enum_is_exactly_the_statutory_set():
    assert {c.value for c in CompetencyEnum} == EXPECTED


def test_ml_feature_order_is_exactly_the_statutory_set():
    assert set(COMPETENCIES) == EXPECTED
    assert len(COMPETENCIES) == 5, "ML feature order must be exactly 5 columns"


def test_training_catalog_keys_are_statutory_competencies():
    data = json.loads(Path(CATALOG_PATH).read_text(encoding="utf-8"))
    catalog_competencies = {entry["competency"] for entry in data}
    unexpected = catalog_competencies - EXPECTED
    assert not unexpected, f"catalog references non-statutory competencies: {unexpected}"
    missing = EXPECTED - catalog_competencies
    assert not missing, f"statutory competencies with no catalog item: {missing}"
