"""In-app notification routes (self-service only)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_db
from ..models import Notification, User
from ..schemas import NotificationResponse

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationResponse], summary="List my notifications")
async def list_notifications(
    unread_only: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Notification]:
    """Return the current user's notifications, newest first."""
    stmt = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    stmt = stmt.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/{notification_id}/read", response_model=NotificationResponse, summary="Mark a notification read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Notification:
    """Mark one of the current user's notifications as read."""
    notification = (
        await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    if not notification.is_read:
        notification.is_read = True
        await db.commit()
        await db.refresh(notification)
    return notification


@router.post("/read-all", summary="Mark all my notifications read")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Mark every notification for the current user as read."""
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "success", "message": "All notifications marked as read"}


__all__ = ["router"]
