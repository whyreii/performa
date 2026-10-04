"""Guardrail: the app uses only IBM Plex Sans + IBM Plex Mono (no serif).

AGENTS.md §1.9 (design system) and docs/SLOP_AUDIT.md §1 rule 9: the type system
is exactly two families. A serif (or any third family) is not allowed, so this
fails if one is introduced anywhere in frontend/ (source, tokens, config, html).
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FRONTEND = ROOT / "frontend"
SKIP_DIRS = {"node_modules", "dist", ".vite", "coverage"}
EXTS = {".jsx", ".js", ".css", ".html"}
FORBIDDEN = ["Plex Serif", "font-serif", "Georgia", "Times New Roman", "--serif"]


def _files():
    for dirpath, dirnames, filenames in os.walk(FRONTEND):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            p = Path(dirpath) / name
            if p.suffix in EXTS:
                yield p


def test_no_serif_or_third_font_family():
    hits = []
    for path in _files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for token in FORBIDDEN:
            if token in text:
                hits.append(f"{path.relative_to(ROOT)}: {token!r}")
    assert not hits, (
        "Only IBM Plex Sans + IBM Plex Mono are allowed (no serif). "
        "See docs/SLOP_AUDIT.md §1 rule 9. Found:\n" + "\n".join(hits)
    )


def test_tokens_define_sans_and_mono():
    tokens = (FRONTEND / "src" / "tokens.css").read_text(encoding="utf-8")
    assert '--font: "IBM Plex Sans"' in tokens, "tokens.css must define --font as IBM Plex Sans"
    assert '--mono: "IBM Plex Mono"' in tokens, "tokens.css must define --mono as IBM Plex Mono"
