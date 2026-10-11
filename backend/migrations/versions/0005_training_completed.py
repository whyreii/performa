"""training_plans.status enum: add 'completed'

Revision ID: 0005_training_completed
Revises: 0004_audit_chain
Create Date: 2026-10-11

Employees can now mark an approved intervention as ``completed``. On PostgreSQL the
status column is a native enum, so the value must be added to the type; on SQLite
(dev/tests) enums are stored as VARCHAR and ``create_all`` already includes it, so
this is a no-op there. Idempotent for the same reason.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005_training_completed"
down_revision = "0004_audit_chain"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # PG 12+ allows ADD VALUE inside a transaction when the value is not used
        # in the same transaction (it is not).
        op.execute("ALTER TYPE training_status_enum ADD VALUE IF NOT EXISTS 'completed'")


def downgrade() -> None:
    # PostgreSQL cannot remove a single enum value; SQLite needs nothing. No-op.
    pass
