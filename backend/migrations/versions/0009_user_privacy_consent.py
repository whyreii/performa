"""user_privacy_consent

Revision ID: 0009_user_privacy_consent
Revises: 0008_password_reset_tokens
Create Date: 2026-10-13

Adds ``users.privacy_consented_at`` (RA 10173 Data Privacy notice acceptance).
Idempotent: 0001_baseline materialises the ORM schema via ``create_all`` (which
already includes this column), so the column is only added when absent.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0009_user_privacy_consent"
down_revision = "0008_password_reset_tokens"
branch_labels = None
depends_on = None


def _has_column() -> bool:
    inspector = sa.inspect(op.get_bind())
    return "privacy_consented_at" in {c["name"] for c in inspector.get_columns("users")}


def upgrade() -> None:
    if _has_column():
        return
    op.add_column(
        "users",
        sa.Column("privacy_consented_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    if _has_column():
        op.drop_column("users", "privacy_consented_at")
