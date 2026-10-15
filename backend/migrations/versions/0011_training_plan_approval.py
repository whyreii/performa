"""training_plan_approval

Revision ID: 0011_training_plan_approval
Revises: 0010_email_verification
Create Date: 2026-10-15

Adds the per-cycle approval record to ``training_plans``:
``employer_approved_by_id`` (who signed off) and ``approved_rationale`` (the
Gemini rationale text frozen at approval time). Idempotent: 0001_baseline
materialises the ORM schema via ``create_all``, so each column is only added
when absent.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0011_training_plan_approval"
down_revision = "0010_email_verification"
branch_labels = None
depends_on = None


def _columns() -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {c["name"] for c in inspector.get_columns("training_plans")}


def upgrade() -> None:
    cols = _columns()
    if "employer_approved_by_id" not in cols:
        op.add_column(
            "training_plans",
            sa.Column("employer_approved_by_id", sa.Uuid(), nullable=True),
        )
    if "approved_rationale" not in cols:
        op.add_column(
            "training_plans",
            sa.Column("approved_rationale", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    cols = _columns()
    if "approved_rationale" in cols:
        op.drop_column("training_plans", "approved_rationale")
    if "employer_approved_by_id" in cols:
        op.drop_column("training_plans", "employer_approved_by_id")
