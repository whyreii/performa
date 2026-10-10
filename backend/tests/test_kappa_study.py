"""The shipped kappa-study profiles stay valid and span every tier."""
from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

import numpy as np

from backend.ml.catalog import COMPETENCIES
from backend.ml.train import _label_row

REPO_ROOT = Path(__file__).resolve().parents[2]
PROFILES = REPO_ROOT / "data" / "kappa" / "profiles.csv"


def _rows() -> list[dict[str, str]]:
    with PROFILES.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def test_profiles_are_valid_and_span_all_tiers():
    rows = _rows()
    assert len(rows) >= 15, "need enough profiles to power the study"
    features = np.asarray([[float(row[c]) for c in COMPETENCIES] for row in rows])
    assert features.min() >= 1.0 and features.max() <= 5.0
    labels = [_label_row(row) for row in features]
    counts = Counter(labels)
    assert set(counts) == {
        "Meets Expectations",
        "Needs Improvement",
        "Critical Gap",
    }, f"profiles must span all three tiers, got {dict(counts)}"
