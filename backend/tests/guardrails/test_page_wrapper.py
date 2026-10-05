"""Guardrail: every routed page uses the shared Page wrapper.

AGENTS.md §1.9 (design system) and docs/SLOP_AUDIT.md: the per-page vertical
rhythm (24px) and fade-in come from one primitive, ``components/ui/Page.jsx``.
A page must not hand-roll the wrapper string, and the wrapper must not declare
its own max-width or padding — the "gallery wall" lives once in AppShell.jsx.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PAGES = ROOT / "frontend" / "src" / "pages"
UI = ROOT / "frontend" / "src" / "components" / "ui"

# The exact page-root wrapper string. Inner elements may legitimately use
# `animate-in fade-in duration-150` (e.g. alerts); only the combined page-root
# string is forbidden outside <Page>.
WRAPPER_TOKEN = "space-y-6 animate-in fade-in duration-150"
# Auth pages render outside the app shell and have no Page wrapper by design.
SKIP_DIRS = {"auth"}


def _page_files():
    for dirpath, dirnames, filenames in os.walk(PAGES):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name.endswith(".jsx"):
                yield Path(dirpath) / name


def test_no_page_hand_rolls_the_wrapper():
    hits = [
        str(path.relative_to(ROOT))
        for path in _page_files()
        if WRAPPER_TOKEN in path.read_text(encoding="utf-8", errors="ignore")
    ]
    assert not hits, (
        "Pages must use <Page> from components/ui, not a hand-rolled wrapper "
        "string. Found:\n" + "\n".join(hits)
    )


def test_every_page_uses_the_page_primitive():
    missing = [
        str(path.relative_to(ROOT))
        for path in _page_files()
        if "<Page" not in path.read_text(encoding="utf-8", errors="ignore")
    ]
    assert not missing, (
        "Every routed page must render <Page>. Missing:\n" + "\n".join(missing)
    )


def test_page_wrapper_does_not_define_the_grid():
    """Page owns rhythm only; max-width/padding live once in AppShell."""
    text = (UI / "Page.jsx").read_text(encoding="utf-8")
    assert "max-w-" not in text, "Page must not declare max-width (AppShell owns the grid)"
    assert "px-" not in text and "py-" not in text, "Page must not declare padding (AppShell owns it)"


def test_no_page_escapes_the_gallery_wall():
    """A page must not break out of AppShell's gallery wall.

    The escape hatch is a ``main:has(...)`` override in index.css (e.g.
    ``main:has(.split) { padding: 0; max-width: none }``), which makes a page
    full-bleed and off-grid. The wall is the single source of max-width +
    padding (AGENTS.md §1.9, docs/SLOP_AUDIT.md rule 10).
    """
    css = (ROOT / "frontend" / "src" / "index.css").read_text(encoding="utf-8")
    offenders = [line.strip() for line in css.splitlines() if "main:has(" in line]
    assert not offenders, (
        "index.css must not override the gallery wall (found 'main:has('). "
        "Keep pages inside AppShell's max-width/padding; see AGENTS.md §1.9. "
        "Offending lines:\n" + "\n".join(offenders)
    )
