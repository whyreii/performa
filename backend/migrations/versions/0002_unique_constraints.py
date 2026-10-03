"""unique constraints for monthly_summaries and kpi_rubrics

Revision ID: 0002_unique_constraints
Revises: 0001_baseline
Create Date: 2026-10-03

Adds the uniqueness guarantees that prevent concurrent-request races from
creating duplicate monthly summaries (per employee/month) or duplicate KPI
rubrics (per organization/competency).

**Idempotent.** ``0001_baseline`` materialises the ORM schema via
``Base.metadata.create_all``, which already includes these constraints (they are
declared in the models' ``__table_args__``). A blind ``ADD CONSTRAINT`` would
therefore fail on PostgreSQL with "relation ... already exists" (SQLite's
``batch_alter_table`` happened to tolerate it). Each constraint is only added
when absent, so the migration is safe whether or not the baseline created them.
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import inspect

revision = "0002_unique_constraints"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

_MONTHLY_UQ = "uq_monthly_summary_employee_month"
_KPI_UQ = "uq_kpi_rubric_org_competency"


def _unique_constraint_names(table_name: str) -> set[str]:
    """Return the names of unique constraints currently on ``table_name``."""
    inspector = inspect(op.get_bind())
    names: set[str] = set()
    for constraint in inspector.get_unique_constraints(table_name):
        name = constraint.get("name")
        if name:
            names.add(name)
    return names


def upgrade() -> None:
    if _MONTHLY_UQ not in _unique_constraint_names("monthly_summaries"):
        with op.batch_alter_table("monthly_summaries") as batch_op:
            batch_op.create_unique_constraint(
                _MONTHLY_UQ, ["employee_id", "month_number"]
            )
    if _KPI_UQ not in _unique_constraint_names("kpi_rubrics"):
        with op.batch_alter_table("kpi_rubrics") as batch_op:
            batch_op.create_unique_constraint(
                _KPI_UQ, ["organization_id", "competency"]
            )


def downgrade() -> None:
    if _KPI_UQ in _unique_constraint_names("kpi_rubrics"):
        with op.batch_alter_table("kpi_rubrics") as batch_op:
            batch_op.drop_constraint(_KPI_UQ, type_="unique")
    if _MONTHLY_UQ in _unique_constraint_names("monthly_summaries"):
        with op.batch_alter_table("monthly_summaries") as batch_op:
            batch_op.drop_constraint(_MONTHLY_UQ, type_="unique")
