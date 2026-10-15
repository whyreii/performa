"""Training catalog access and the canonical competency ordering."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Single source for the five statutory competencies: model attribute -> label.
COMPETENCY_LABELS: dict[str, str] = {
    "task_completion": "Task Completion",
    "attendance_and_punctuality": "Attendance & Punctuality",
    "communication_and_teamwork": "Communication & Teamwork",
    "initiative_and_adaptability": "Initiative & Adaptability",
    "quality_of_work": "Quality of Work",
}
COMPETENCIES: tuple[str, ...] = tuple(COMPETENCY_LABELS)

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


def rank_courses_by_text(text: str) -> list[dict[str, Any]]:
    """Rank every catalog course by lexical similarity to ``text``.

    Deterministic and dependency-free (stdlib only). Used to suggest the
    best-fitting course for an employer-defined custom KPI name — the match is
    computed and stored at configuration time, so Gemini never selects the
    intervention set (ARCHITECTURE.md §5).
    """
    import re
    from difflib import SequenceMatcher

    needle = (text or "").strip().lower()
    tokens = set(re.findall(r"[a-z]+", needle))
    ranked: list[dict[str, Any]] = []
    for course in get_catalog():
        haystack = " ".join(
            str(course.get(field, ""))
            for field in ("intervention_title", "title", "description", "competency")
        ).lower()
        ratio = SequenceMatcher(None, needle, haystack).ratio()
        hay_tokens = set(re.findall(r"[a-z]+", haystack))
        overlap = len(tokens & hay_tokens) / len(tokens) if tokens else 0.0
        entry = dict(course)
        entry["_match_score"] = round(0.5 * ratio + 0.5 * overlap, 4)
        ranked.append(entry)
    ranked.sort(key=lambda item: item["_match_score"], reverse=True)
    return ranked


__all__ = [
    "COMPETENCIES",
    "CATALOG_PATH",
    "get_catalog",
    "recommend_courses",
    "rank_courses_by_text",
]
