"""Database-level immutability for the Evidentiary Labor Score Audit Trail.

The append-only guarantee for ``evaluation_audit_logs`` (ARCHITECTURE.md §5, §6a)
is enforced in two places:

* **Application logic** — no update/delete route exists for audit rows.
* **The database** — a trigger rejects any ``UPDATE`` or ``DELETE`` against the
  table, so even a compromised or buggy code path cannot rewrite evidence.

The trigger DDL is dialect-specific and lives here as the single source. It is
applied on ``Base.metadata.create_all`` (dev and tests, via the ``after_create``
listener registered in ``backend/models.py``) and by Alembic revision
``0003_immutable_audit`` (existing databases). Every statement is idempotent, so
running both paths is safe.
"""
from __future__ import annotations

AUDIT_TABLE = "evaluation_audit_logs"
_MESSAGE = f"{AUDIT_TABLE} is append-only"

_TRIGGER_NO_UPDATE = f"{AUDIT_TABLE}_no_update"
_TRIGGER_NO_DELETE = f"{AUDIT_TABLE}_no_delete"
_FUNCTION = "performa_block_audit_mutation"

_SQLITE_STATEMENTS: tuple[str, ...] = (
    f"CREATE TRIGGER IF NOT EXISTS {_TRIGGER_NO_UPDATE} "
    f"BEFORE UPDATE ON {AUDIT_TABLE} "
    f"BEGIN SELECT RAISE(ABORT, '{_MESSAGE}'); END",
    f"CREATE TRIGGER IF NOT EXISTS {_TRIGGER_NO_DELETE} "
    f"BEFORE DELETE ON {AUDIT_TABLE} "
    f"BEGIN SELECT RAISE(ABORT, '{_MESSAGE}'); END",
)

_POSTGRES_STATEMENTS: tuple[str, ...] = (
    f"CREATE OR REPLACE FUNCTION {_FUNCTION}() RETURNS trigger LANGUAGE plpgsql AS "
    f"$$ BEGIN RAISE EXCEPTION '{_MESSAGE}'; END; $$",
    f"DROP TRIGGER IF EXISTS {_TRIGGER_NO_UPDATE} ON {AUDIT_TABLE}",
    f"DROP TRIGGER IF EXISTS {_TRIGGER_NO_DELETE} ON {AUDIT_TABLE}",
    f"CREATE TRIGGER {_TRIGGER_NO_UPDATE} BEFORE UPDATE ON {AUDIT_TABLE} "
    f"FOR EACH ROW EXECUTE FUNCTION {_FUNCTION}()",
    f"CREATE TRIGGER {_TRIGGER_NO_DELETE} BEFORE DELETE ON {AUDIT_TABLE} "
    f"FOR EACH ROW EXECUTE FUNCTION {_FUNCTION}()",
)

_SQLITE_DROP: tuple[str, ...] = (
    f"DROP TRIGGER IF EXISTS {_TRIGGER_NO_UPDATE}",
    f"DROP TRIGGER IF EXISTS {_TRIGGER_NO_DELETE}",
)

_POSTGRES_DROP: tuple[str, ...] = (
    f"DROP TRIGGER IF EXISTS {_TRIGGER_NO_UPDATE} ON {AUDIT_TABLE}",
    f"DROP TRIGGER IF EXISTS {_TRIGGER_NO_DELETE} ON {AUDIT_TABLE}",
    f"DROP FUNCTION IF EXISTS {_FUNCTION}()",
)


def statements_for(dialect: str) -> tuple[str, ...]:
    """Return the idempotent CREATE statements for ``dialect`` (empty if unknown)."""
    if dialect == "sqlite":
        return _SQLITE_STATEMENTS
    if dialect == "postgresql":
        return _POSTGRES_STATEMENTS
    return ()


def drop_statements_for(dialect: str) -> tuple[str, ...]:
    """Return the DROP statements for ``dialect`` (empty if unknown)."""
    if dialect == "sqlite":
        return _SQLITE_DROP
    if dialect == "postgresql":
        return _POSTGRES_DROP
    return ()


def create_audit_triggers(target, connection, **kw) -> None:
    """SQLAlchemy ``after_create`` listener: install the immutability triggers."""
    from sqlalchemy import text

    for statement in statements_for(connection.dialect.name):
        connection.execute(text(statement))


__all__ = ["AUDIT_TABLE", "statements_for", "drop_statements_for", "create_audit_triggers"]
