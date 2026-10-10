"""Guardrail: ARCHITECTURE.md §2 competency IDs and milestone days match the code.

This is what stops the docs and the code from drifting.
"""
from __future__ import annotations

import re
from pathlib import Path

from backend.ml.catalog import COMPETENCIES
from backend.models import CompetencyEnum

ARCH = Path(__file__).resolve().parents[3] / "ARCHITECTURE.md"

_STATUTORY = {
    "task_completion",
    "attendance_and_punctuality",
    "communication_and_teamwork",
    "initiative_and_adaptability",
    "quality_of_work",
}


def _section_2() -> str:
    text = ARCH.read_text(encoding="utf-8")
    m = re.search(r"## 2\..*?(?=\n## 3\.)", text, re.S)
    assert m, "ARCHITECTURE.md §2 not found"
    return m.group(0)


def _section_1() -> str:
    text = ARCH.read_text(encoding="utf-8")
    m = re.search(r"## 1\..*?(?=\n## 2\.)", text, re.S)
    assert m, "ARCHITECTURE.md §1 not found"
    return m.group(0)


def test_docs_competency_ids_match_code():
    doc_ids = set(re.findall(r"`([a-z_]+)`", _section_2())) & _STATUTORY
    assert doc_ids == {c.value for c in CompetencyEnum}
    assert doc_ids == set(COMPETENCIES)


def test_docs_milestone_days_match_code():
    days = set(re.findall(r"Day (\d+)", _section_2()))
    assert days == {"150", "165", "178"}, f"doc milestone days mismatch: {days}"


def test_docs_frontend_icon_library_matches_code():
    section = _section_1()
    assert "Phosphor Icons" in section, "ARCHITECTURE.md §1 stack must name Phosphor Icons"
    assert "Lucide" not in section, "ARCHITECTURE.md §1 still claims Lucide React"


def test_docs_gemini_model_ids_match_code():
    from backend.gemini import FALLBACK_MODEL, PRIMARY_MODEL

    section = _section_1()
    assert PRIMARY_MODEL in section, f"§1 must name the primary model {PRIMARY_MODEL}"
    assert FALLBACK_MODEL in section, f"§1 must name the fallback model {FALLBACK_MODEL}"


def test_docs_statutory_values_match_domain():
    from backend.domain import PROBATION_TERM_DAYS, TARGET_SCORE

    section = _section_2()
    assert str(PROBATION_TERM_DAYS) in section, "§2 must state the 180-day cap"
    assert f"{TARGET_SCORE:.1f}" in section, "§2 must state the 4.0 standard"
