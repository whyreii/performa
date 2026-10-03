"""In-app notification helper (rows are committed by the caller)."""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from .models import Notification


def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    organization_id: str,
    title: str,
    body: Optional[str] = None,
    category: str = "general",
) -> None:
    """Queue an in-app notification for a user."""
    db.add(
        Notification(
            user_id=user_id,
            organization_id=organization_id,
            title=title,
            body=body,
            category=category,
        )
    )


__all__ = ["create_notification"]
