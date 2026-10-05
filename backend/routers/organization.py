"""Organization (tenant) settings routes.

The organization display name is resolved dynamically for every user through
``/api/auth/me`` (``organization_name``); this router lets an Admin or Employer
rename the tenant so the value is not baked into seed data or the UI.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record_activity
from ..auth import require_role
from ..database import get_db
from ..models import Organization, User, UserRole
from ..schemas import OrganizationResponse, OrganizationUpdate

router = APIRouter(prefix="/api/organization", tags=["Organization"])


@router.patch(
    "",
    response_model=OrganizationResponse,
    summary="Rename the organization (Admin/Employer)",
)
async def update_organization(
    payload: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.EMPLOYER)),
) -> Organization:
    """Update the caller's tenant display name (slug is the immutable tenant key)."""
    org = (
        await db.execute(
            select(Organization).where(Organization.slug == current_user.organization_id)
        )
    ).scalar_one_or_none()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization name cannot be blank",
        )
    if name == org.name:
        return org

    org.name = name
    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="organization.rename",
        entity_type="organization",
        entity_id=org.id,
        detail=name,
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That organization name is already in use.",
        )
    await db.refresh(org)
    return org


__all__ = ["router"]
