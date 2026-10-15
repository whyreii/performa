"""employee_custom_kpis

Revision ID: 0014_employee_custom_kpis
Revises: 0013_custom_kpis
Create Date: 2026-10-15

Per-employee narrowing of the organization-wide custom KPI set: the Employer
chooses which custom KPIs a given probationary employee is rated on when
onboarding the account. Non-statutory (ARCHITECTURE.md §2) — it never enters the
five competencies, the 4.0 regularizing standard, the ML feature vector, or the
competency audit chain.

Idempotent: 0001_baseline materialises the ORM schema via ``create_all``, so a
fresh database already has this table; it is only created when absent.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0014_employee_custom_kpis"
down_revision = "0013_custom_kpis"
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    if "employee_custom_kpis" not in _tables():
        op.create_table(
            "employee_custom_kpis",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("employee_id", sa.Uuid(), nullable=False),
            sa.Column("custom_kpi_id", sa.Uuid(), nullable=False),
            sa.Column("organization_id", sa.String(length=100), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["employee_id"], ["probationary_employees.id"]),
            sa.ForeignKeyConstraint(["custom_kpi_id"], ["custom_kpis.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "employee_id", "custom_kpi_id", name="uq_employee_custom_kpi"
            ),
        )
        op.create_index(
            "ix_employee_custom_kpis_employee_id",
            "employee_custom_kpis",
            ["employee_id"],
        )
        op.create_index(
            "ix_employee_custom_kpis_custom_kpi_id",
            "employee_custom_kpis",
            ["custom_kpi_id"],
        )
        op.create_index(
            "ix_employee_custom_kpis_organization_id",
            "employee_custom_kpis",
            ["organization_id"],
        )


def downgrade() -> None:
    if "employee_custom_kpis" in _tables():
        op.drop_table("employee_custom_kpis")
