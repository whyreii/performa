"""database-level immutability for evaluation_audit_logs

Revision ID: 0003_immutable_audit
Revises: 0002_unique_constraints
Create Date: 2026-10-10

Installs dialect-specific triggers that reject UPDATE/DELETE on the Evidentiary
Labor Score Audit Trail (ARCHITECTURE.md §5). Idempotent: ``0001_baseline``
creates the schema via ``Base.metadata.create_all``, which already fires the
``after_create`` listener in ``backend/models.py`` and may have installed the
triggers; the statements guard with ``IF NOT EXISTS`` / ``DROP ... IF EXISTS``.

PostgreSQL requires the deploy role to own the table (or hold TRIGGER privilege)
to create the trigger function.
"""
from __future__ import annotations

from alembic import op

from backend.audit_immutability import drop_statements_for, statements_for

revision = "0003_immutable_audit"
down_revision = "0002_unique_constraints"
branch_labels = None
depends_on = None


def upgrade() -> None:
    dialect = op.get_bind().dialect.name
    for statement in statements_for(dialect):
        op.execute(statement)


def downgrade() -> None:
    dialect = op.get_bind().dialect.name
    for statement in drop_statements_for(dialect):
        op.execute(statement)
