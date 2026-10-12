"""Guardrail: the layout grammar (docs/LAYOUT_GRAMMAR.md).

Every page composes from the shared primitives in ``frontend/src/components/ui``
(PageHeader, SectionHead, StatBand, SectionCard, GroupCard). A page must not
define its own section header or hand-roll a stat band — that is how the three
pages drifted apart before. See docs/LAYOUT_GRAMMAR.md.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
PAGES = REPO_ROOT / "frontend" / "src" / "pages"

# A page-local section-header component (must use ui/SectionHead instead).
_LOCAL_HEADER = re.compile(r"function\s+(CardHead|SectionHead|PanelHead|SectionTitle)\s*\(")

# Hand-rolled stat bands (must use ui/StatBand instead).
_STAT_BAND_TOKENS = (
    "gap-px bg-line",
    "divide-x divide-line border-y border-line",
)

# Page-level grid declarations (must use ui/PageGrid + Row/Col instead, so every
# page's column lines match and nothing shifts when navigating).
_PAGE_GRID_TOKENS = (
    "grid-cols-12",
    "max-w-[1120px]",
    "max-w-[1100px]",
    "max-w-5xl",
)


def _page_files():
    for path in PAGES.rglob("*.jsx"):
        if path.name.endswith(".test.jsx"):
            continue
        yield path


def test_pages_do_not_declare_their_own_page_grid():
    hits: list[str] = []
    for path in _page_files():
        text = path.read_text(encoding="utf-8")
        for token in _PAGE_GRID_TOKENS:
            if token in text:
                hits.append(f"{path.relative_to(REPO_ROOT)}: {token!r}")
    assert not hits, (
        "Page-level layout must go through PageGrid/Row/Col "
        "(frontend/src/components/ui/PageGrid.jsx) so the column lines are shared. "
        "See docs/LAYOUT_GRAMMAR.md:\n" + "\n".join(hits)
    )


def test_pages_do_not_define_their_own_section_header():
    hits: list[str] = []
    for path in _page_files():
        text = path.read_text(encoding="utf-8")
        for m in _LOCAL_HEADER.finditer(text):
            hits.append(f"{path.relative_to(REPO_ROOT)}: function {m.group(1)}")
    assert not hits, (
        "Pages must use the shared SectionHead "
        "(frontend/src/components/ui/SectionHead.jsx), not a local header "
        "component. See docs/LAYOUT_GRAMMAR.md:\n" + "\n".join(hits)
    )


def test_pages_do_not_hand_roll_a_stat_band():
    hits: list[str] = []
    for path in _page_files():
        text = path.read_text(encoding="utf-8")
        for token in _STAT_BAND_TOKENS:
            if token in text:
                hits.append(f"{path.relative_to(REPO_ROOT)}: {token!r}")
    assert not hits, (
        "Stat bands must use ui/StatBand (one style). "
        "See docs/LAYOUT_GRAMMAR.md:\n" + "\n".join(hits)
    )
