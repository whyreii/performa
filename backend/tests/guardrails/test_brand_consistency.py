"""Guardrail: one product name everywhere.

The wordmark lives once in ``frontend/src/config/brand.js`` and — because
``index.html`` can't import JS — as a literal in its ``<title>`` and
``<meta name="application-name">``. Every other surface must reference the single
source; drifted descriptors ("Performa Capstone", "Probationary Performance
Management") are not allowed in app source.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
SKIP_DIRS = {"node_modules", "dist", ".vite", "coverage"}
EXTS = {".js", ".jsx", ".html"}

BRAND_NAME = "Performa"
FORBIDDEN = ["Performa Capstone", "Probationary Performance Management"]


def _files():
    for dirpath, dirnames, filenames in os.walk(SRC):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            p = Path(dirpath) / name
            if p.suffix in EXTS:
                yield p
    yield FRONTEND / "index.html"


def test_brand_has_one_source():
    brand = (SRC / "config" / "brand.js").read_text(encoding="utf-8")
    assert f"'{BRAND_NAME}'" in brand, "brand.js must define the product name"


def test_index_html_title_and_app_name():
    html = (FRONTEND / "index.html").read_text(encoding="utf-8")
    assert f"<title>{BRAND_NAME}</title>" in html, "index.html <title> must equal the brand name"
    assert f'name="application-name" content="{BRAND_NAME}"' in html


def test_no_drifted_brand_descriptors():
    hits = []
    for path in _files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for token in FORBIDDEN:
            if token in text:
                hits.append(f"{path.relative_to(ROOT)}: {token!r}")
    assert not hits, (
        "Use the single brand name; no drifted descriptors. Found:\n" + "\n".join(hits)
    )
