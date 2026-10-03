"""Guardrail: docs/generated/architecture-snapshot.md is not stale.

The snapshot is generated from ``Base.metadata`` and the FastAPI app. If this
test fails, the committed file no longer matches the code:

    python scripts/gen_architecture_snapshot.py
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "scripts" / "gen_architecture_snapshot.py"
SNAPSHOT = REPO_ROOT / "docs" / "generated" / "architecture-snapshot.md"


def _load_generator():
    spec = importlib.util.spec_from_file_location("gen_architecture_snapshot", SCRIPT)
    assert spec and spec.loader, f"cannot load {SCRIPT}"
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_snapshot_is_not_stale():
    assert SNAPSHOT.exists(), (
        "docs/generated/architecture-snapshot.md is missing; "
        "run: python scripts/gen_architecture_snapshot.py"
    )
    generator = _load_generator()
    expected = generator.render_snapshot()
    actual = SNAPSHOT.read_text(encoding="utf-8")
    assert actual == expected, (
        "docs/generated/architecture-snapshot.md is stale; "
        "regenerate with: python scripts/gen_architecture_snapshot.py"
    )
