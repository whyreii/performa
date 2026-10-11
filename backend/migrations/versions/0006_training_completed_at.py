"""training_plans.completed_at

Revision ID: 0006_training_completed_at
Revises: 0005_training_completed
Create Date: 2026-10-11

Records when an employee marked an approved intervention completed. Idempotent:
0001_baseline materialises the ORM schema via ``create_all`` (which already
includes this column), so the column is only added when absent.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006_training_completed_at"
down_revision = "0005_training_completed"
branch_labels = None
depends_on = None


def _columns() -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns("training_plans")}


def upgrade() -> None:
    if "completed_at" not in _columns():
        op.add_column(
            "training_plans",
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    if "completed_at" in _columns():
        op.drop_column("training_plans", "completed_at")
