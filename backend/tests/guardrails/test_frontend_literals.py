"""Guardrail: no hardcoded statutory values left in the frontend (invariant §1.10).

Numbers and status shown in the UI must come from ``config/domain.js`` or the
API, never from literals in a page. These specific values were removed and must
not return.
"""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SRC = REPO_ROOT / "frontend" / "src"
FORBIDDEN = (
    "System Active",
    "target 4.0",
    "Minimum 4.0 average",
    "4.0 / 5.0",
    "weight: '20%'",
    "target: '4.0'",
)


def _source_files():
    for path in SRC.rglob("*"):
        if path.suffix in {".js", ".jsx"} and not path.name.endswith(".test.jsx"):
            yield path


def test_no_hardcoded_statutory_literals():
    hits: list[str] = []
    for path in _source_files():
        text = path.read_text(encoding="utf-8")
        for token in FORBIDDEN:
            if token in text:
                hits.append(f"{path.relative_to(REPO_ROOT)}: {token!r}")
    assert not hits, (
        "Hardcoded statutory literals must come from config/domain.js or the API:\n"
        + "\n".join(hits)
    )
