"""tamper-evident chain columns on evaluation_audit_logs

Revision ID: 0004_audit_chain
Revises: 0003_immutable_audit
Create Date: 2026-10-10

Adds ``prev_hash`` / ``record_hash`` so the Evidentiary Labor Score Audit Trail is
tamper-evident, not merely append-only (ARCHITECTURE.md §5). Idempotent:
``0001_baseline`` materialises the ORM schema (which already includes these
columns) via ``create_all``, so each column is only added when absent.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_audit_chain"
down_revision = "0003_immutable_audit"
branch_labels = None
depends_on = None


def _columns() -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns("evaluation_audit_logs")}


def upgrade() -> None:
    columns = _columns()
    if "prev_hash" not in columns:
        op.add_column(
            "evaluation_audit_logs", sa.Column("prev_hash", sa.String(length=64), nullable=True)
        )
    if "record_hash" not in columns:
        op.add_column(
            "evaluation_audit_logs", sa.Column("record_hash", sa.String(length=64), nullable=True)
        )


def downgrade() -> None:
    columns = _columns()
    if "record_hash" in columns:
        op.drop_column("evaluation_audit_logs", "record_hash")
    if "prev_hash" in columns:
        op.drop_column("evaluation_audit_logs", "prev_hash")
