"""Admin routes: User account management module for system administrators."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_password_hash, require_role
from ..audit import record_activity
from ..database import get_db
from ..models import (
    ActivityLog,
    MonthlySummary,
    ProbationaryEmployee,
    TrainingPlan,
    TrainingStatusEnum,
    User,
    UserRole,
)
from ..schemas import ActivityLogResponse, UserResponse, validate_email
from .kpi import INDUSTRY_TEMPLATES

router = APIRouter(prefix="/api/admin", tags=["Admin User Management"])

DEADLINE_THRESHOLDS = {"day_150": 150, "day_165": 165, "day_178": 178, "day_180": 180}


class AdminCreateUserRequest(BaseModel):
    email: str = Field(..., max_length=255)
    full_name: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return validate_email(value)


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
    await db.flush()
    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="user.create",
        entity_type="user",
        entity_id=new_user.id,
        detail=f"{new_user.role.value}:{new_user.email}",
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{payload.email}' already exists.",
        )
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

    if not payload.is_active and target_user.role == UserRole.ADMIN:
        other_active_admins = (
            await db.execute(
                select(func.count())
                .select_from(User)
                .where(
                    User.organization_id == target_user.organization_id,
                    User.role == UserRole.ADMIN,
                    User.is_active.is_(True),
                    User.id != target_user.id,
                )
            )
        ).scalar_one()
        if other_active_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the last active administrator.",
            )

    target_user.is_active = payload.is_active
    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="user.status",
        entity_type="user",
        entity_id=target_user.id,
        detail=f"is_active={payload.is_active}",
    )
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
    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="user.reset_password",
        entity_type="user",
        entity_id=target_user.id,
        detail=target_user.email,
    )
    await db.commit()
    return {"status": "success", "message": f"Password reset successfully for {target_user.email}."}


@router.get(
    "/activity",
    response_model=list[ActivityLogResponse],
    summary="List the tenant activity log (Admin only)",
)
async def list_activity(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> list[ActivityLog]:
    """Return general system activity entries for the administrator's tenant."""
    stmt = (
        select(ActivityLog)
        .where(ActivityLog.organization_id == current_user.organization_id)
        .order_by(ActivityLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


@router.get("/settings", summary="System settings (Admin only)")
async def get_system_settings(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> dict:
    """Return the statutory deadline thresholds and the KPI template library."""
    return {
        "deadline_thresholds": DEADLINE_THRESHOLDS,
        "kpi_templates": INDUSTRY_TEMPLATES,
    }


@router.get("/reports/overview", summary="Tenant performance overview (Admin only)")
async def reports_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> dict:
    """Aggregate probationary and intervention metrics for the tenant."""
    organization_id = current_user.organization_id

    total = (
        await db.execute(
            select(func.count())
            .select_from(ProbationaryEmployee)
            .where(ProbationaryEmployee.organization_id == organization_id)
        )
    ).scalar_one()

    status_rows = (
        await db.execute(
            select(ProbationaryEmployee.status, func.count())
            .where(ProbationaryEmployee.organization_id == organization_id)
            .group_by(ProbationaryEmployee.status)
        )
    ).all()
    by_status = {status.value: count for status, count in status_rows}

    pending_interventions = (
        await db.execute(
            select(func.count())
            .select_from(TrainingPlan)
            .join(ProbationaryEmployee, TrainingPlan.employee_id == ProbationaryEmployee.id)
            .where(
                ProbationaryEmployee.organization_id == organization_id,
                TrainingPlan.status == TrainingStatusEnum.PENDING_APPROVAL,
            )
        )
    ).scalar_one()

    average_overall = (
        await db.execute(
            select(func.avg(MonthlySummary.overall_average))
            .join(ProbationaryEmployee, MonthlySummary.employee_id == ProbationaryEmployee.id)
            .where(ProbationaryEmployee.organization_id == organization_id)
        )
    ).scalar_one()

    return {
        "total_employees": total,
        "by_status": by_status,
        "pending_interventions": pending_interventions,
        "average_overall_score": (
            round(float(average_overall), 2) if average_overall is not None else None
        ),
    }
