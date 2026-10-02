"""Admin routes: User account management module for system administrators."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_password_hash, require_role
from ..database import get_db
from ..models import User, UserRole
from ..schemas import UserResponse

router = APIRouter(prefix="/api/admin", tags=["Admin User Management"])


class AdminCreateUserRequest(BaseModel):
    email: str = Field(..., max_length=255)
    full_name: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole


class AdminUpdateStatusRequest(BaseModel):
    is_active: bool


class AdminResetPasswordRequest(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)


@router.get(
    "/users",
    response_model=list[UserResponse],
    summary="List all tenant user accounts (Admin only)",
)
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> list[User]:
    """Retrieve all user accounts within the administrator's organization."""
    result = await db.execute(
        select(User)
        .where(User.organization_id == current_user.organization_id)
        .order_by(User.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account with specified role (Admin only)",
)
async def create_user(
    payload: AdminCreateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> User:
    """Create a new user account and assign their role (Employer, Supervisor, or Probationary Employee)."""
    # Email is globally unique across the platform (see User model)
    existing = await db.execute(select(User.id).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{payload.email}' already exists.",
        )

    new_user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        organization_id=current_user.organization_id,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.patch(
    "/users/{user_id}/status",
    response_model=UserResponse,
    summary="Activate or deactivate a user account (Admin only)",
)
async def update_user_status(
    user_id: uuid.UUID,
    payload: AdminUpdateStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> User:
    """Toggle a user's active status."""
    if user_id == current_user.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account.",
        )

    target_user = await db.get(User, user_id)
    if target_user is None or target_user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    target_user.is_active = payload.is_active
    await db.commit()
    await db.refresh(target_user)
    return target_user


@router.post(
    "/users/{user_id}/reset-password",
    summary="Reset a user's password (Admin only)",
)
async def reset_user_password(
    user_id: uuid.UUID,
    payload: AdminResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> dict[str, str]:
    """Admin resets the password of an account."""
    target_user = await db.get(User, user_id)
    if target_user is None or target_user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    target_user.hashed_password = get_password_hash(payload.password)
    await db.commit()
    return {"status": "success", "message": f"Password reset successfully for {target_user.email}."}
