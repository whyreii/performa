"""custom_kpis

Revision ID: 0013_custom_kpis
Revises: 0012_pending_probation
Create Date: 2026-10-15

Adds employer-defined, non-statutory KPIs and their weekly ratings, plus the
``custom_kpi_name`` marker on ``training_plans``.

Idempotent: 0001_baseline materialises the ORM schema via ``create_all``, so a
fresh database already has these objects; each is only created/added when
absent.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0013_custom_kpis"
down_revision = "0012_pending_probation"
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return set()
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    tables = _tables()

    if "custom_kpis" not in tables:
        op.create_table(
            "custom_kpis",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("organization_id", sa.String(length=100), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("mapped_catalog_id", sa.String(length=100), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_by_id", sa.Uuid(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("organization_id", "name", name="uq_custom_kpi_org_name"),
        )
        op.create_index("ix_custom_kpis_organization_id", "custom_kpis", ["organization_id"])

    if "custom_kpi_ratings" not in tables:
        op.create_table(
            "custom_kpi_ratings",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("weekly_evaluation_id", sa.Uuid(), nullable=False),
            sa.Column("custom_kpi_id", sa.Uuid(), nullable=False),
            sa.Column("organization_id", sa.String(length=100), nullable=False),
            sa.Column("score", sa.Float(), nullable=False),
            sa.ForeignKeyConstraint(["weekly_evaluation_id"], ["weekly_evaluations.id"]),
            sa.ForeignKeyConstraint(["custom_kpi_id"], ["custom_kpis.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_custom_kpi_ratings_weekly_evaluation_id",
            "custom_kpi_ratings",
            ["weekly_evaluation_id"],
        )
        op.create_index(
            "ix_custom_kpi_ratings_custom_kpi_id", "custom_kpi_ratings", ["custom_kpi_id"]
        )
        op.create_index(
            "ix_custom_kpi_ratings_organization_id",
            "custom_kpi_ratings",
            ["organization_id"],
        )

    if "custom_kpi_name" not in _columns("training_plans"):
        op.add_column(
            "training_plans",
            sa.Column("custom_kpi_name", sa.String(length=120), nullable=True),
        )


def downgrade() -> None:
    if "custom_kpi_name" in _columns("training_plans"):
        op.drop_column("training_plans", "custom_kpi_name")

    tables = _tables()
    if "custom_kpi_ratings" in tables:
        op.drop_table("custom_kpi_ratings")
    if "custom_kpis" in tables:
        op.drop_table("custom_kpis")
