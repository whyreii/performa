"""unique constraints for monthly_summaries and kpi_rubrics

Revision ID: 0002_unique_constraints
Revises: 0001_baseline
Create Date: 2026-10-03

Adds the uniqueness guarantees that prevent concurrent-request races from
creating duplicate monthly summaries (per employee/month) or duplicate KPI
rubrics (per organization/competency).
"""
from __future__ import annotations

from alembic import op

revision = "0002_unique_constraints"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("monthly_summaries") as batch_op:
        batch_op.create_unique_constraint(
            "uq_monthly_summary_employee_month", ["employee_id", "month_number"]
        )
    with op.batch_alter_table("kpi_rubrics") as batch_op:
        batch_op.create_unique_constraint(
            "uq_kpi_rubric_org_competency", ["organization_id", "competency"]
        )


def downgrade() -> None:
    with op.batch_alter_table("kpi_rubrics") as batch_op:
        batch_op.drop_constraint("uq_kpi_rubric_org_competency", type_="unique")
    with op.batch_alter_table("monthly_summaries") as batch_op:
        batch_op.drop_constraint("uq_monthly_summary_employee_month", type_="unique")
