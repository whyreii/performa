"""pending_probation

Revision ID: 0012_pending_probation
Revises: 0011_training_plan_approval
Create Date: 2026-10-15

Adds the ``pending`` probation status and makes ``start_date`` / ``day_180_date``
nullable, so an employee account can exist before the Employer assigns a start
date. The 180-day clock only starts at assignment.

Idempotent: the enum value is only added when absent, and the columns are only
altered when they are still NOT NULL.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0012_pending_probation"
down_revision = "0011_training_plan_approval"
branch_labels = None
depends_on = None


def _not_null_columns() -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {
        c["name"]
        for c in inspector.get_columns("probationary_employees")
        if not c["nullable"]
    }


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Native enum: add the new label before any row uses it.
        op.execute("ALTER TYPE probation_status ADD VALUE IF NOT EXISTS 'pending'")

    not_null = _not_null_columns()
    with op.batch_alter_table("probationary_employees") as batch:
        if "start_date" in not_null:
            batch.alter_column("start_date", existing_type=sa.Date(), nullable=True)
        if "day_180_date" in not_null:
            batch.alter_column("day_180_date", existing_type=sa.Date(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("probationary_employees") as batch:
        batch.alter_column("start_date", existing_type=sa.Date(), nullable=False)
        batch.alter_column("day_180_date", existing_type=sa.Date(), nullable=False)
