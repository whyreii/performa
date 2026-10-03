"""General system activity-log helper.

Callers add an :class:`ActivityLog` row via ``record_activity`` and persist it
as part of their existing transaction (no commit is performed here).
"""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from .models import ActivityLog


def record_activity(
    db: AsyncSession,
    *,
    organization_id: str,
    action: str,
    actor: Any = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[Any] = None,
    detail: Optional[str] = None,
) -> None:
    """Queue an activity-log row for the given actor and action."""
    db.add(
        ActivityLog(
            organization_id=organization_id,
            actor_id=getattr(actor, "id", None),
            actor_name=getattr(actor, "full_name", None),
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            detail=detail,
        )
    )


__all__ = ["record_activity"]
