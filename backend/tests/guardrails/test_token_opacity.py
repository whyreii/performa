"""Guardrail: every colour token used with an opacity modifier can actually take one.

Tailwind drops an opacity modifier (``bg-surface/80``) silently when the colour
token is declared as a plain ``var(--x)``, and drops it when the modifier is not
in the opacity scale (``bg-warn/6``). Both produce no CSS and no error. Tokens
declared with ``withOpacity()`` in ``frontend/tailwind.config.js`` are the only
ones allowed to carry a ``/N`` modifier.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TAILWIND_JS = ROOT / "frontend" / "tailwind.config.js"
SRC = ROOT / "frontend" / "src"

_COLORS_BLOCK = re.compile(r"colors:\s*\{(?P<body>[\s\S]*?)\n {6}\},\n {6}borderRadius")
_WITH_OPACITY = re.compile(r"(?P<name>[\w'-]+|DEFAULT):\s*withOpacity\(")
_USAGE = re.compile(
    r"(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|divide|from|to|via|fill|stroke|outline|shadow|placeholder)"
    r"-(?P<token>[a-z][a-z0-9-]*?)/(?P<mod>\d+)(?![\w.])"
)
_OPACITY_SCALE = {0, 5, 8, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100}


def _opacity_tokens() -> set[str]:
    text = TAILWIND_JS.read_text(encoding="utf-8")
    block = _COLORS_BLOCK.search(text)
    assert block, "could not locate the colors block in tailwind.config.js"
    names = {m.group("name").strip("'") for m in _WITH_OPACITY.finditer(block.group("body"))}
    names.discard("DEFAULT")
    names.discard("2")
    names.discard("3")
    # `ink` and `accent` are nested objects whose DEFAULT is withOpacity();
    # their keys map to the parent token name.
    names.update({"ink", "ink-2", "ink-3", "accent"})
    # Tailwind built-in colours take opacity modifiers natively.
    names.update({"black", "white"})
    return names


def _source_files():
    for path in SRC.rglob("*"):
        if path.suffix in {".js", ".jsx", ".ts", ".tsx"} and not path.name.endswith(".test.jsx"):
            yield path


def test_opacity_modifiers_only_on_withopacity_tokens():
    allowed = _opacity_tokens()
    assert {"bg", "surface", "line", "hover", "warn", "accent", "ink"} <= allowed, (
        f"expected tokens missing from tailwind.config.js withOpacity set: {sorted(allowed)}"
    )
    offenders = []
    for path in _source_files():
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for m in _USAGE.finditer(line):
                token, mod = m.group("token"), int(m.group("mod"))
                if token not in allowed:
                    offenders.append(f"{path.relative_to(ROOT)}:{lineno}: '{m.group(0)}' — token '{token}' is not withOpacity()")
                elif mod not in _OPACITY_SCALE:
                    offenders.append(f"{path.relative_to(ROOT)}:{lineno}: '{m.group(0)}' — modifier /{mod} is not in the opacity scale")
    assert not offenders, "opacity modifiers that generate no CSS:\n" + "\n".join(offenders)
