"""Tests for the training split and held-out metrics harness.

These exercise ``backend/ml/train.py`` directly without fitting a model, so they
stay fast. The manuscript's split is 70 / 15 / 15 train / validation / test.
"""
from __future__ import annotations

from backend.ml import train


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
