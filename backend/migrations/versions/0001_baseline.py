"""baseline schema (all tables as of the Wave 4 data-model changes)

Revision ID: 0001_baseline
Revises:
Create Date: 2026-10-03

The initial baseline materializes the full ORM schema from ``Base.metadata``.
Subsequent schema changes should be added as new, explicit revisions.
"""
from __future__ import annotations

from alembic import op

from backend import models  # noqa: F401  (register all models)
from backend.database import Base

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
