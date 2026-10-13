"""email_verification

Revision ID: 0010_email_verification
Revises: 0009_user_privacy_consent
Create Date: 2026-10-13

Adds ``users.email_verified`` (self-registered accounts start unverified) and the
``email_verification_tokens`` table. Idempotent: 0001_baseline materialises the
ORM schema via ``create_all``, so each object is only created when absent.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0010_email_verification"
down_revision = "0009_user_privacy_consent"
branch_labels = None
depends_on = None


def _columns() -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {c["name"] for c in inspector.get_columns("users")}


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if "email_verified" not in _columns():
        op.add_column(
            "users",
            sa.Column(
                "email_verified",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )
    if not _has_table("email_verification_tokens"):
        op.create_table(
            "email_verification_tokens",
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
            sa.UniqueConstraint("token_hash", name="uq_email_verification_token_hash"),
        )
        op.create_index(
            "ix_email_verification_tokens_user_id", "email_verification_tokens", ["user_id"]
        )
        op.create_index(
            "ix_email_verification_tokens_token_hash",
            "email_verification_tokens",
            ["token_hash"],
        )


def downgrade() -> None:
    if _has_table("email_verification_tokens"):
        op.drop_table("email_verification_tokens")
    if "email_verified" in _columns():
        op.drop_column("users", "email_verified")
