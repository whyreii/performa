"""Exact Shapley explanations and permutation importance for the competency model.

Two complementary explainability layers sit on top of the Random Forest:

* **Permutation importance** (global) — how much the model's score degrades when
  each competency's values are shuffled. This is the method named in the
  manuscript (Chapter 3) alongside Gini impurity.
* **Exact Shapley values** (local) — per-employee attribution of a single
  prediction to each competency, computed exactly over all ``2**5`` feature
  coalitions (Shapley, 1953). For a five-feature model this is cheap and needs no
  external dependency.

The value function uses an *interventional* expectation over a fixed background
sample drawn from the training distribution::

    v(S) = E_background[ model.predict_proba(target)[x_S, X_background,-S] ]

The background is deterministic (seeded) and cached. When a real dataset is
supplied via ``TRAINING_DATASET`` the same background is drawn from it, so the
explanations track the deployed model without any code change.

Caveat (for the defense): these values explain the *model's* output, not the
employee's true performance, and the current model is trained on a synthetic
distribution until the partner dataset is collected.
"""
from __future__ import annotations

import itertools
from functools import lru_cache
from math import factorial

import numpy as np
from sklearn.inspection import permutation_importance

from .catalog import COMPETENCIES
from .predictor import _load_model, _validate_scores
from .train import load_dataset

N_FEATURES: int = len(COMPETENCIES)
BACKGROUND_SIZE: int = 128
RANDOM_STATE: int = 42


@lru_cache(maxsize=1)
def _background() -> np.ndarray:
    """Deterministic background sample from the training distribution."""
    features, _ = load_dataset()
    features = np.asarray(features, dtype=float)
    rng = np.random.default_rng(RANDOM_STATE)
    size = min(BACKGROUND_SIZE, features.shape[0])
    index = rng.choice(features.shape[0], size=size, replace=False)
    return features[index]


@lru_cache(maxsize=1)
def permutation_importances() -> dict[str, float]:
    """Global permutation importance, normalized to sum to 1.

    Normalizing makes the values directly comparable with the Gini
    ``feature_importances_`` already shown in the UI. Negative means (shuffling
    that happens to help) are clipped to zero before normalization.
    """
    features, labels = load_dataset()
    model = _load_model()
    result = permutation_importance(
        model,
        np.asarray(features, dtype=float),
        np.asarray(labels),
        n_repeats=10,
        random_state=RANDOM_STATE,
        n_jobs=1,
    )
    means = np.clip(np.asarray(result.importances_mean, dtype=float), 0.0, None)
    total = float(means.sum())
    if total > 0.0:
        means = means / total
    return {name: round(float(value), 4) for name, value in zip(COMPETENCIES, means)}


def _coalition_value(
    model, x: np.ndarray, target_index: int, coalition: tuple[int, ...], background: np.ndarray
) -> float:
    """``v(S)``: expected target-class probability with S fixed to ``x``."""
    masked = background.copy()
    for i in coalition:
        masked[:, i] = x[i]
    probabilities = model.predict_proba(masked)[:, target_index]
    return float(np.mean(probabilities))


def shapley_values(scores: dict, target_class: str | None = None) -> dict:
    """Exact Shapley values for one employee's competency vector.

    Args:
        scores: Mapping with all five competency keys, values in ``[1.0, 5.0]``.
        target_class: Class to attribute. Defaults to the model's predicted tier.

    Returns:
        ``{"target_class", "base_value", "shap_values"}`` where ``base_value`` is
        the background expected probability (``E[f]``) and ``shap_values`` maps
        each competency to its signed contribution.

    Raises:
        ValueError: If ``scores`` is missing keys or out of range.
        FileNotFoundError: If no trained model has been generated yet.
    """
    values = _validate_scores(scores)
    x = np.asarray(values, dtype=float)
    model = _load_model()
    classes = [str(label) for label in model.classes_]

    if target_class is None:
        target_class = str(model.predict(np.asarray([values]))[0])
    if target_class not in classes:
        raise ValueError(f"Unknown target class '{target_class}'; expected one of {classes}")
    target_index = classes.index(target_class)

    background = _background()
    cache: dict[tuple[int, ...], float] = {}

    def coalition_value(members: tuple[int, ...]) -> float:
        key = tuple(sorted(members))
        if key not in cache:
            cache[key] = _coalition_value(model, x, target_index, key, background)
        return cache[key]

    phi = np.zeros(N_FEATURES, dtype=float)
    for i in range(N_FEATURES):
        others = [j for j in range(N_FEATURES) if j != i]
        for k in range(len(others) + 1):
            weight = factorial(k) * factorial(N_FEATURES - k - 1) / factorial(N_FEATURES)
            for combination in itertools.combinations(others, k):
                without = combination
                with_i = tuple(sorted(combination + (i,)))
                phi[i] += weight * (coalition_value(with_i) - coalition_value(without))

    return {
        "target_class": target_class,
        "base_value": round(coalition_value(()), 4),
        "shap_values": {name: round(float(value), 4) for name, value in zip(COMPETENCIES, phi)},
    }


def explain_prediction(scores: dict) -> dict:
    """Combine local (Shapley) and global (permutation) explanations.

    The target class is the model's predicted tier, so the attribution explains
    the classification actually shown to the user.
    """
    values = _validate_scores(scores)
    model = _load_model()
    predicted_tier = str(model.predict(np.asarray([values]))[0])

    local = shapley_values(scores, target_class=predicted_tier)

    return {
        "shap_values": local["shap_values"],
        "shap_base_value": local["base_value"],
        "shap_target_class": local["target_class"],
        "permutation_importances": dict(permutation_importances()),
        "explanation_method": (
            f"Exact Shapley over {N_FEATURES} competencies "
            f"({2 ** N_FEATURES} coalitions), interventional background n={len(_background())}"
        ),
    }


__all__ = [
    "N_FEATURES",
    "explain_prediction",
    "permutation_importances",
    "shapley_values",
]
