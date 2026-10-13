"""reports

Revision ID: 0007_reports
Revises: 0006_training_completed_at
Create Date: 2026-10-13

Adds the ``reports`` table (persisted generated-report metadata — the
manuscript's "generated reports list"). Idempotent: 0001_baseline materialises
the ORM schema via ``create_all`` (which already includes this table), so the
table is only created when absent.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0007_reports"
down_revision = "0006_training_completed_at"
branch_labels = None
depends_on = None


def _has_table() -> bool:
    return sa.inspect(op.get_bind()).has_table("reports")


def upgrade() -> None:
    if _has_table():
        return
    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.String(100), nullable=False),
        sa.Column(
            "employee_id",
            sa.Uuid(),
            sa.ForeignKey("probationary_employees.id"),
            nullable=False,
        ),
        sa.Column("generated_by_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_reports_organization_id", "reports", ["organization_id"])
    op.create_index("ix_reports_employee_id", "reports", ["employee_id"])
    op.create_index("ix_reports_created_at", "reports", ["created_at"])


def downgrade() -> None:
    if _has_table():
        op.drop_table("reports")
