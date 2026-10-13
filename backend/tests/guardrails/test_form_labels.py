"""Guardrail: form-field labels come from the shared Label primitive.

AGENTS.md §1.9 (design system) + docs/LAYOUT_GRAMMAR.md (one source per element
type): the label above a control has exactly one definition —
``frontend/src/components/ui/Label.jsx``. A hand-rolled ``<label>`` that sets its
own font weight is how the labels drifted (Login's "Password" was 12px while
"Work email" was 14px).

Allowed (not field labels, no weight class): labels that wrap a control — the
inline "Target [input]" cell in Rubrics and the clickable card labels in
EmployeeDetail.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SRC = REPO_ROOT / "frontend" / "src"
PRIMITIVE = SRC / "components" / "ui" / "Label.jsx"

# An opening <label ...> tag (may span lines: [^>] matches newlines too).
_LABEL_TAG = re.compile(r"<label\b[^>]*>")
_WEIGHT = re.compile(r"font-(?:medium|semibold)")


def _source_files():
    for path in SRC.rglob("*.jsx"):
        if path == PRIMITIVE or path.name.endswith(".test.jsx"):
            continue
        yield path


def test_form_labels_use_the_shared_primitive():
    offenders: list[str] = []
    for path in _source_files():
        text = path.read_text(encoding="utf-8")
        for match in _LABEL_TAG.finditer(text):
            if _WEIGHT.search(match.group(0)):
                line = text[: match.start()].count("\n") + 1
                offenders.append(f"{path.relative_to(REPO_ROOT)}:{line}")
    assert not offenders, (
        "Form labels must use <Label> from components/ui (one source for the "
        "label's type). A <label> that sets its own font weight is drift:\n"
        + "\n".join(offenders)
    )
