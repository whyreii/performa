"""Guardrail: the frontend domain constants mirror the backend.

``frontend/src/config/domain.js`` restates the probation term, the 30-day month,
the 4.0 standard, the milestone days, and the five competency keys. The backend
(``backend/domain.py`` + ``backend/ml/catalog.py``) is the source of truth, so
any drift is a silent legal/display error. This test parses the JS file and
compares it against the imported backend values.
"""
from __future__ import annotations

import re
from pathlib import Path

from backend.domain import (
    MILESTONE_CRITICAL_DAY,
    MILESTONE_NOTICE_DAY,
    MILESTONE_REVIEW_DAY,
    PROBATION_MONTH_DAYS,
    PROBATION_TERM_DAYS,
    TARGET_SCORE,
)
from backend.ml.catalog import COMPETENCIES as BACKEND_COMPETENCIES

ROOT = Path(__file__).resolve().parents[3]
DOMAIN_JS = ROOT / "frontend" / "src" / "config" / "domain.js"


def _js() -> str:
    return DOMAIN_JS.read_text(encoding="utf-8")


def _const(text: str, name: str) -> float:
    m = re.search(rf"\b{name}\s*=\s*([0-9.]+)\s*;", text)
    assert m, f"{name} not found in config/domain.js"
    return float(m.group(1))


def test_scalars_match_backend():
    text = _js()
    assert _const(text, "PROBATION_DAYS") == PROBATION_TERM_DAYS
    assert _const(text, "PROBATION_MONTH_DAYS") == PROBATION_MONTH_DAYS
    assert _const(text, "TARGET") == TARGET_SCORE
    assert _const(text, "MILESTONE_REVIEW") == MILESTONE_REVIEW_DAY
    assert _const(text, "MILESTONE_NOTICE") == MILESTONE_NOTICE_DAY
    assert _const(text, "MILESTONE_CRITICAL") == MILESTONE_CRITICAL_DAY


def test_competency_keys_match_backend():
    keys = re.findall(r"key:\s*'([a-z_]+)'", _js())
    assert keys, "no competency keys parsed from config/domain.js"
    # The invariant is the same five keys (never added, removed, renamed, or
    # re-keyed). Display order is a UI choice and is intentionally not asserted:
    # config/domain.js lists quality_of_work second, while the backend catalog
    # (and the manuscript's canonical CSV order) lists it last.
    assert set(keys) == set(BACKEND_COMPETENCIES), (
        "competency keys differ between config/domain.js and backend/ml/catalog.py:\n"
        f"  frontend: {sorted(keys)}\n"
        f"  backend:  {sorted(BACKEND_COMPETENCIES)}"
    )
    assert len(keys) == len(set(keys)), f"duplicate competency keys in config/domain.js: {keys}"
