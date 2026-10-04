"""Guardrail: the Explainable-AI (XAI) copy stays visible in the UI.

AGENTS.md §1.4 and docs/UIUX_AUDIT.md §B (items 13-15) require the XAI terms to
remain visible for the thesis defense, and docs/UIUX_STANDARDS.md §1 names the
EmployeeDetail panel "ML Risk Explanation". The de-slop pass may restyle this
copy but must never delete or reword it.

Note: this checks the SOURCE, not the rendered DOM. It proves the strings exist
in frontend/src (outside comments); it does not prove they are displayed. A
rendered-output check would need a browser test runner.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "frontend" / "src"
EMPLOYEE_DETAIL = SRC / "pages" / "employees" / "EmployeeDetail.jsx"

_JSX_COMMENT = re.compile(r"\{/\*.*?\*/\}", re.S)


def _read(glob: str = "**/*.jsx") -> str:
    """All matching source files, JSX comments stripped, whitespace collapsed."""
    text = "\n".join(p.read_text(encoding="utf-8") for p in sorted(SRC.glob(glob)))
    text = _JSX_COMMENT.sub(" ", text)
    return re.sub(r"\s+", " ", text)


# Tier 1 — invariant §1.4 terms (case-insensitive: the UI uses sentence case).
REQUIRED_TERMS = ["random forest", "feature importance", "gemini performance rationale"]


def test_xai_terms_present_in_frontend_source():
    text = _read().lower()
    missing = [term for term in REQUIRED_TERMS if term not in text]
    assert not missing, (
        "XAI terms missing from frontend/src (AGENTS.md §1.4 / docs/UIUX_AUDIT.md §B): "
        + ", ".join(missing)
    )


# Tier 2 — audit §B item 15 preserved phrasing in EmployeeDetail (exact).
PRESERVED_COPY = [
    "ML Risk Explanation",
    "Feature importance for legal defensibility",
]


def test_employee_detail_preserves_xai_copy():
    assert EMPLOYEE_DETAIL.exists(), f"missing {EMPLOYEE_DETAIL}"
    text = _read("pages/employees/EmployeeDetail.jsx")
    missing = [phrase for phrase in PRESERVED_COPY if phrase not in text]
    assert not missing, (
        "Preserved XAI copy missing from EmployeeDetail.jsx (docs/UIUX_AUDIT.md §B "
        "item 15; docs/UIUX_STANDARDS.md §1): " + ", ".join(repr(p) for p in missing)
    )
