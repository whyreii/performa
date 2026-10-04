"""Tests for the training split and held-out metrics harness.

These exercise ``backend/ml/train.py`` directly without fitting a model, so they
stay fast. The manuscript's split is 70 / 15 / 15 train / validation / test.
"""
from __future__ import annotations

import pytest

from backend.ml import train
from backend.ml.catalog import COMPETENCIES


def test_split_is_70_15_15():
    features, labels = train.build_dataset(n_samples=400, seed=1)
    x_train, x_val, x_test, *_ = train.split_dataset(features, labels)
    n = len(labels)
    assert abs(len(x_train) / n - 0.70) < 0.03
    assert abs(len(x_val) / n - 0.15) < 0.03
    assert abs(len(x_test) / n - 0.15) < 0.03
    assert len(x_train) + len(x_val) + len(x_test) == n


def test_metrics_report_expected_keys():
    features, labels = train.build_dataset(n_samples=90, seed=1)
    metrics = train._metrics(labels, labels)
    assert metrics["accuracy"] == 1.0
    assert set(metrics) >= {
        "accuracy",
        "precision_macro",
        "recall_macro",
        "f1_macro",
        "f1_weighted",
        "confusion_matrix",
        "labels",
        "classification_report",
    }


def test_load_dataset_reads_csv(tmp_path, monkeypatch):
    """A real CSV (one column per competency) is loaded, ordered, and labelled."""
    csv_path = tmp_path / "kpi.csv"
    csv_path.write_text(
        f"{','.join(COMPETENCIES)}\n"
        "4.5,4.0,3.5,4.2,4.8\n"
        "1.5,2.0,1.8,2.2,1.9\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(train, "DATASET_PATH", str(csv_path))
    features, labels = train.load_dataset()
    assert features.shape == (2, len(COMPETENCIES))
    # Column order must follow COMPETENCIES exactly.
    assert features[0].tolist() == [4.5, 4.0, 3.5, 4.2, 4.8]
    # Row 1 passes the cascade; row 2 has quality_of_work < 2.0 -> Critical Gap.
    assert labels[0] == "Meets Expectations"
    assert labels[1] == "Critical Gap"


def test_load_dataset_rejects_missing_columns(tmp_path, monkeypatch):
    csv_path = tmp_path / "bad.csv"
    csv_path.write_text("task_completion\n4.5\n", encoding="utf-8")
    monkeypatch.setattr(train, "DATASET_PATH", str(csv_path))
    with pytest.raises(ValueError):
        train.load_dataset()


def test_load_dataset_falls_back_when_file_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(train, "DATASET_PATH", str(tmp_path / "nope.csv"))
    features, labels = train.load_dataset()
    assert features.shape[0] == train.N_SAMPLES
