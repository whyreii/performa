"""Training catalog access and the canonical competency ordering."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

COMPETENCIES: tuple[str, ...] = (
    "task_completion",
    "attendance_and_punctuality",
    "communication_and_teamwork",
    "initiative_and_adaptability",
    "quality_of_work",
)

CATALOG_PATH: Path = Path(__file__).resolve().parent / "training_catalog.json"


def get_catalog() -> list[dict[str, Any]]:
    """Load and return every catalog entry, preserving file order.

    Raises:
        FileNotFoundError: If the bundled catalog file is missing.
        ValueError: If the catalog file does not contain a JSON array.
    """
    if not CATALOG_PATH.exists():
        raise FileNotFoundError(f"Training catalog not found at {CATALOG_PATH}")
    with CATALOG_PATH.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("Training catalog must be a JSON array of course objects")
    return data


def recommend_courses(competency: str) -> list[dict[str, Any]]:
    """Return all catalog courses for the given competency."""
    return [course for course in get_catalog() if course.get("competency") == competency]


__all__ = ["COMPETENCIES", "CATALOG_PATH", "get_catalog", "recommend_courses"]
