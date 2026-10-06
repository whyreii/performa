"""Guardrail: structural rules from the Anti-Slop Contract.

docs/FRONTEND_ROADMAP.md defines the permanent UI standard. These are the parts
that can be checked statically:

  * rule 2 — radii come from the tokens (``var(--r-*)``) or a pill/circle/reset
    (999px / 50% / 0), never a bespoke numeric literal or arbitrary
    ``rounded-[...]`` utility;
  * rule 7 — no animation dependency: ``motion`` was removed in Phase 5 in
    favour of ``frontend/src/utils/animate.js``.

Semantic rules (one encoder per value, status-colour usage) stay review-only.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
SKIP_DIRS = {"node_modules", "dist", ".vite", "coverage"}

# A CSS border-radius declaration whose value is a bespoke literal.
_RADIUS_DECL = re.compile(r"border-radius\s*:")
_ALLOWED_RADIUS = re.compile(r"border-radius:\s*(var\(|999px|50%|0(?:px)?\b|inherit)")
_ARBITRARY_UTIL = re.compile(r"rounded-\[")


def _files(exts):
    for dirpath, dirnames, filenames in os.walk(SRC):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            p = Path(dirpath) / name
            if p.suffix in exts:
                yield p


def test_no_bespoke_border_radius():
    hits = []
    for path in _files({".css"}):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for i, line in enumerate(text.splitlines(), 1):
            if _RADIUS_DECL.search(line) and not _ALLOWED_RADIUS.search(line):
                hits.append(f"{path.relative_to(ROOT)}:{i}: {line.strip()}")
    assert not hits, (
        "border-radius must use a token (var(--r-*)) or a pill/circle/reset "
        "(999px / 50% / 0). See docs/FRONTEND_ROADMAP.md rule 2. Found:\n"
        + "\n".join(hits)
    )


def test_no_arbitrary_radius_utility():
    hits = []
    for path in _files({".jsx", ".js", ".html"}):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for i, line in enumerate(text.splitlines(), 1):
            if _ARBITRARY_UTIL.search(line):
                hits.append(f"{path.relative_to(ROOT)}:{i}: {line.strip()}")
    assert not hits, (
        "Use the Tailwind radius scale / tokens, not arbitrary rounded-[...]. "
        "See docs/FRONTEND_ROADMAP.md rule 2. Found:\n" + "\n".join(hits)
    )


def test_no_animation_dependency():
    pkg = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    assert "motion" not in deps, (
        "`motion` was removed in favour of frontend/src/utils/animate.js "
        "(Phase 5). Do not re-add an animation dependency. See "
        "docs/FRONTEND_ROADMAP.md rule 7."
    )
