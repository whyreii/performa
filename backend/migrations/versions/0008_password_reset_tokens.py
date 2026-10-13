"""password_reset_tokens

Revision ID: 0008_password_reset_tokens
Revises: 0007_reports
Create Date: 2026-10-13

Adds the ``password_reset_tokens`` table (self-service reset: hashed, expiring,
single-use). Idempotent: 0001_baseline materialises the ORM schema via
``create_all`` (which already includes this table), so the table is only created
when absent.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0008_password_reset_tokens"
down_revision = "0007_reports"
branch_labels = None
depends_on = None


def _has_table() -> bool:
    return sa.inspect(op.get_bind()).has_table("password_reset_tokens")


def upgrade() -> None:
    if _has_table():
        return
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("token_hash", name="uq_password_reset_token_hash"),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_index(
        "ix_password_reset_tokens_token_hash", "password_reset_tokens", ["token_hash"]
    )


def downgrade() -> None:
    if _has_table():
        op.drop_table("password_reset_tokens")
