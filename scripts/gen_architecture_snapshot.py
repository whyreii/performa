"""Generate docs/generated/architecture-snapshot.md from the code.

Deterministic, sorted, and requires no database connection: it reads
``Base.metadata`` (schema) and the FastAPI app (routes), plus a static scan for
environment variables and key file paths.

Regenerate with:

    python scripts/gen_architecture_snapshot.py

``backend/tests/guardrails/test_snapshot.py`` fails if the committed file is
stale, so run the command above whenever models, routes, or config change.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
BACKEND_DIR = REPO_ROOT / "backend"
OUTPUT_PATH = REPO_ROOT / "docs" / "generated" / "architecture-snapshot.md"

HEADER = """\
<!-- GENERATED FILE — DO NOT HAND-EDIT. -->
<!-- Regenerate: python scripts/gen_architecture_snapshot.py -->
<!-- Staleness is enforced by backend/tests/guardrails/test_snapshot.py. -->

# Architecture snapshot

"""

_KEY_PATHS: tuple[tuple[str, str], ...] = (
    ("Models", "backend/models.py"),
    ("Schemas", "backend/schemas.py"),
    ("Routers", "backend/routers/"),
    ("Timezone helpers", "backend/timeutils.py"),
    ("Gemini client", "backend/gemini.py"),
    ("ML predictor", "backend/ml/predictor.py"),
    ("ML training", "backend/ml/train.py"),
    ("ML feature order / catalog access", "backend/ml/catalog.py"),
    ("Training catalog", "backend/ml/training_catalog.json"),
    ("RF artifact", "backend/ml/models/rf_model.joblib"),
    ("Config", "backend/config.py"),
    ("Database engine", "backend/database.py"),
    ("Auth / RBAC", "backend/auth.py"),
    ("Audit log writer", "backend/audit.py"),
    ("App entrypoint", "backend/main.py"),
    ("Alembic migrations", "backend/migrations/versions/"),
)

_ENV_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"""os\.getenv\(\s*["']([A-Z0-9_]+)["']"""),
    re.compile(r"""os\.environ\.get\(\s*["']([A-Z0-9_]+)["']"""),
    re.compile(r"""os\.environ\[\s*["']([A-Z0-9_]+)["']\s*\]"""),
    re.compile(r"""os\.environ\.setdefault\(\s*["']([A-Z0-9_]+)["']"""),
    re.compile(r"""os\.environ\.pop\(\s*["']([A-Z0-9_]+)["']"""),
)


def _iter_dependant_calls(dependant) -> Iterable[object]:
    call = getattr(dependant, "call", None)
    if call is not None:
        yield call
    for sub in getattr(dependant, "dependencies", []) or []:
        yield from _iter_dependant_calls(sub)


def _roles_from_closure(call) -> tuple[str, ...] | None:
    closure = getattr(call, "__closure__", None)
    if not closure:
        return None
    for cell in closure:
        try:
            value = cell.cell_contents
        except ValueError:
            continue
        if (
            isinstance(value, tuple)
            and value
            and all(hasattr(item, "value") for item in value)
        ):
            return tuple(sorted(str(item.value) for item in value))
    return None


def _auth_for_route(route) -> str:
    dependant = getattr(route, "dependant", None)
    if dependant is None:
        return "not detected"
    calls = list(_iter_dependant_calls(dependant))
    for call in calls:
        if getattr(call, "__qualname__", "").endswith("role_checker"):
            roles = _roles_from_closure(call)
            if roles:
                return "roles: " + ", ".join(roles)
            return "role-gated"
    for call in calls:
        if getattr(call, "__qualname__", "") == "get_current_user":
            return "authenticated (any role)"
    return "not detected"


def _render_schema() -> str:
    import backend.models  # noqa: F401  (registers all tables on Base.metadata)
    from backend.models import Base

    lines = ["## Database schema", "", "Source: `Base.metadata` (no DB connection).", ""]
    for table in sorted(Base.metadata.tables.values(), key=lambda t: t.name):
        lines.append(f"### `{table.name}`")
        lines.append("")
        lines.append("| Column | Type | Nullable | PK | Unique | Default | Foreign key |")
        lines.append("|---|---|---|---|---|---|---|")
        for column in sorted(table.columns, key=lambda c: c.name):
            fks = ", ".join(sorted(fk.target_fullname for fk in column.foreign_keys))
            default = _column_default(column)
            lines.append(
                "| {name} | {type} | {nullable} | {pk} | {unique} | {default} | {fk} |".format(
                    name=column.name,
                    type=str(column.type),
                    nullable="yes" if column.nullable else "no",
                    pk="yes" if column.primary_key else "no",
                    unique="yes" if column.unique else "no",
                    default=default or "",
                    fk=fks or "",
                )
            )
        unique_constraints = sorted(
            {
                tuple(sorted(col.name for col in getattr(constraint, "columns", ())))
                for constraint in table.constraints
                if constraint.__class__.__name__ == "UniqueConstraint"
            }
        )
        if unique_constraints:
            lines.append("")
            lines.append("Unique constraints: " + "; ".join(
                "(" + ", ".join(cols) + ")" for cols in unique_constraints
            ))
        lines.append("")
    return "\n".join(lines)


def _render_default_arg(arg) -> str:
    """Render a default deterministically (callables by name, never by address)."""
    if callable(arg) and not isinstance(arg, type):
        module = getattr(arg, "__module__", "")
        qualname = getattr(arg, "__qualname__", getattr(arg, "__name__", repr(arg)))
        return f"{module}.{qualname}" if module else qualname
    return str(arg)


def _column_default(column) -> str:
    if column.server_default is not None:
        arg = getattr(column.server_default, "arg", None)
        return _render_default_arg(arg) if arg is not None else str(column.server_default)
    if column.default is not None:
        arg = getattr(column.default, "arg", None)
        return _render_default_arg(arg) if arg is not None else str(column.default)
    return ""


def _render_routes() -> str:
    from fastapi.routing import APIRoute

    from backend.main import app

    rows: list[tuple[str, str, str, str]] = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        auth = _auth_for_route(route)
        for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
            rows.append((route.path, method, auth, route.name))
    rows.sort(key=lambda row: (row[0], row[1]))

    lines = ["## Routes", "", "Auth column is read from the FastAPI dependency graph.", ""]
    lines.append("| Method | Path | Auth / role dependency | Endpoint |")
    lines.append("|---|---|---|---|")
    for path, method, auth, name in rows:
        lines.append(f"| {method} | `{path}` | {auth} | {name} |")
    lines.append("")
    return "\n".join(lines)


def _render_env() -> str:
    from backend.config import Settings

    entries: dict[str, str] = {}
    for name, field in Settings.model_fields.items():
        env_name = (field.alias or name).upper()
        default = field.default
        entries[env_name] = "—" if default is None else str(default)

    for path in sorted(BACKEND_DIR.rglob("*.py")):
        if "tests" in path.parts or "migrations" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        for pattern in _ENV_PATTERNS:
            for match in pattern.finditer(text):
                entries.setdefault(match.group(1), "—")

    lines = ["## Environment variables", "", "| Variable | Default |", "|---|---|"]
    for name in sorted(entries):
        lines.append(f"| `{name}` | `{entries[name]}` |")
    lines.append("")
    return "\n".join(lines)


def _render_paths() -> str:
    lines = ["## Key file paths", "", "| Purpose | Path | Exists |", "|---|---|---|"]
    for label, rel in _KEY_PATHS:
        exists = "yes" if (REPO_ROOT / rel).exists() else "no"
        lines.append(f"| {label} | `{rel}` | {exists} |")
    lines.append("")
    return "\n".join(lines)


def render_snapshot() -> str:
    """Return the full snapshot document as a string."""
    sections = [HEADER, _render_schema(), _render_routes(), _render_env(), _render_paths()]
    return "\n".join(sections).rstrip() + "\n"


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(render_snapshot(), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
