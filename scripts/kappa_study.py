"""Cohen's kappa between the Article 296 labelling cascade and human raters.

Non-circular evaluation for the ML chapter (see ``docs/ML_KAPPA_STUDY.md``). Reads
the fixed competency profiles, derives the deterministic cascade label with the
same rule the Random Forest is trained on, and compares it to one or more human
raters.

Run:
    python scripts/kappa_study.py --labels data/kappa/human_labels.csv

Labels are long-format CSV: ``profile_id,label`` for a single rater, or
``profile_id,rater_id,label`` for several. Valid labels: Meets Expectations,
Needs Improvement, Critical Gap.
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import numpy as np  # noqa: E402
from sklearn.metrics import accuracy_score, cohen_kappa_score, confusion_matrix  # noqa: E402

from backend.ml.catalog import COMPETENCIES  # noqa: E402
from backend.ml.train import _label_row  # noqa: E402

PROFILES = REPO_ROOT / "data" / "kappa" / "profiles.csv"
LABELS_TEMPLATE = REPO_ROOT / "data" / "kappa" / "human_labels_template.csv"
VALID = ("Meets Expectations", "Needs Improvement", "Critical Gap")


def load_profiles() -> tuple[list[str], np.ndarray]:
    with PROFILES.open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    ids = [row["profile_id"] for row in rows]
    features = np.asarray([[float(row[c]) for c in COMPETENCIES] for row in rows])
    return ids, features


def cascade_labels(features: np.ndarray) -> list[str]:
    return [_label_row(row) for row in features]


def load_labels(path: Path) -> dict[str, dict[str, str]]:
    with path.open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise SystemExit(f"{path} has no rows")
    single = "rater_id" not in rows[0]
    ratings: dict[str, dict[str, str]] = defaultdict(dict)
    for row in rows:
        label = (row.get("label") or "").strip()
        if not label:
            continue
        if label not in VALID:
            raise SystemExit(f"invalid label {label!r} for {row.get('profile_id')}")
        rater = "rater" if single else row["rater_id"]
        ratings[rater][row["profile_id"]] = label
    return dict(ratings)


def majority(labels_by_rater: list[list[str]]) -> list[str]:
    return [Counter(column).most_common(1)[0][0] for column in zip(*labels_by_rater)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--labels",
        type=Path,
        default=REPO_ROOT / "data" / "kappa" / "human_labels.csv",
        help="long-format label CSV",
    )
    args = parser.parse_args()
    if not args.labels.exists():
        raise SystemExit(
            f"no labels at {args.labels}; copy {LABELS_TEMPLATE.name} to "
            f"human_labels.csv and fill it in."
        )

    ids, features = load_profiles()
    cascade = cascade_labels(features)
    ratings = load_labels(args.labels)

    vectors: dict[str, list[str]] = {}
    for rater, mapping in ratings.items():
        missing = [pid for pid in ids if pid not in mapping]
        if missing:
            raise SystemExit(f"rater {rater} is missing labels for: {missing}")
        vectors[rater] = [mapping[pid] for pid in ids]

    print(f"Profiles: {len(ids)}  Raters: {len(vectors)}")
    print(f"Cascade distribution: {dict(Counter(cascade))}")
    for rater, labels in vectors.items():
        kappa = cohen_kappa_score(cascade, labels)
        agreement = accuracy_score(cascade, labels)
        print(f"[{rater}] kappa={kappa:.3f} agreement={agreement:.3f}")

    if len(vectors) > 1:
        agreed = majority(list(vectors.values()))
        print(
            f"[majority] kappa-vs-cascade={cohen_kappa_score(cascade, agreed):.3f} "
            f"agreement={accuracy_score(cascade, agreed):.3f}"
        )
        human = agreed
    else:
        human = next(iter(vectors.values()))

    labels = sorted(VALID)
    print(f"Confusion (cascade rows x human cols, labels={labels}):")
    print(confusion_matrix(cascade, human, labels=labels))


if __name__ == "__main__":
    main()
