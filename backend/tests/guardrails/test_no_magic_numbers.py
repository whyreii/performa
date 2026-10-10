"""Guardrail: the statutory Article 296 numbers are declared once.

Milestone days (150 / 165 / 178) and the 180-day term must not reappear as
integer literals in business code — they are referenced from ``backend/domain.py``
so the value lives in one place (AGENTS.md §1.2, ARCHITECTURE.md §6a).
"""
from __future__ import annotations

import ast
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
ALLOWED = {BACKEND / "domain.py"}
GUARDED = {150, 165, 178, 180}
SKIP_PARTS = {"tests", "migrations", "__pycache__"}


def _business_files():
    for path in BACKEND.rglob("*.py"):
        if path in ALLOWED:
            continue
        if any(part in SKIP_PARTS for part in path.relative_to(BACKEND).parts):
            continue
        yield path


def test_statutory_numbers_are_declared_once():
    offenders: list[str] = []
    for path in _business_files():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Constant)
                and isinstance(node.value, int)
                and not isinstance(node.value, bool)
                and node.value in GUARDED
            ):
                offenders.append(
                    f"{path.relative_to(BACKEND)}:{node.lineno} literal {node.value}"
                )
    assert not offenders, (
        "Statutory Article 296 numbers must come from backend/domain.py:\n"
        + "\n".join(sorted(offenders))
    )
