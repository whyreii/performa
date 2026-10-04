"""Guardrail: the theme palette swatch hexes mirror tokens.css.

The palette list lives once in ``frontend/src/config/themes.js`` (consumed by
ThemeContext, Login, MobileBar, Settings, CommandPalette). Its ``bg``/``accent``
hexes must equal the runtime values in ``tokens.css`` — otherwise a swatch shows
a color the theme does not actually use (the drift this replaces).
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
THEMES_JS = ROOT / "frontend" / "src" / "config" / "themes.js"
TOKENS_CSS = ROOT / "frontend" / "src" / "tokens.css"

_HEX = r"#[0-9a-fA-F]{6}"
_JS_ENTRY = re.compile(
    rf"id:\s*'(?P<id>\w+)'[\s\S]*?bg:\s*'(?P<bg>{_HEX})'[\s\S]*?accent:\s*'(?P<accent>{_HEX})'"
)
_CSS_BLOCK = re.compile(r'data-theme="(?P<id>\w+)"\]?\s*\{(?P<body>[^}]*)\}')


def _parse_js():
    text = THEMES_JS.read_text(encoding="utf-8")
    return {m.group("id"): (m.group("bg").lower(), m.group("accent").lower()) for m in _JS_ENTRY.finditer(text)}


def _parse_css():
    text = TOKENS_CSS.read_text(encoding="utf-8")
    out = {}
    for m in _CSS_BLOCK.finditer(text):
        body = m.group("body")
        bg = re.search(rf"--bg:\s*({_HEX})", body)
        accent = re.search(rf"--accent:\s*({_HEX})", body)
        if bg and accent:
            out[m.group("id")] = (bg.group(1).lower(), accent.group(1).lower())
    return out


def test_palette_hexes_match_tokens():
    js = _parse_js()
    css = _parse_css()
    assert js, "config/themes.js palette entries not parsed"
    assert css, "tokens.css theme blocks not parsed"
    assert set(js) == set(css), f"palette ids differ: themes.js={sorted(js)} tokens.css={sorted(css)}"
    mismatches = [f"{pid}: themes.js={js[pid]} tokens.css={css[pid]}" for pid in js if js[pid] != css[pid]]
    assert not mismatches, "themes.js swatch hexes must mirror tokens.css:\n" + "\n".join(mismatches)
