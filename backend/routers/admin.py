"""Admin routes: User account management module for system administrators."""
from __future__ import annotations

import re
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_password_hash, require_role
from ..audit import record_activity
from ..database import get_db
from ..domain import (
    MILESTONE_CRITICAL_DAY,
    MILESTONE_NOTICE_DAY,
    MILESTONE_REVIEW_DAY,
    PROBATION_TERM_DAYS,
)
from ..emailer import send_credentials_email
from ..models import (
    ActivityLog,
    MonthlySummary,
    Organization,
    ProbationStatus,
    ProbationaryEmployee,
    TrainingPlan,
    TrainingStatusEnum,
    User,
    UserRole,
)
from ..passwords import generate_password
from ..schemas import (
    ActivityLogResponse,
    OrganizationResponse,
    PasswordStr,
    UserResponse,
    validate_email,
)
from .kpi import INDUSTRY_TEMPLATES

router = APIRouter(prefix="/api/admin", tags=["Admin User Management"])

DEADLINE_THRESHOLDS = {
    "day_150": MILESTONE_REVIEW_DAY,
    "day_165": MILESTONE_NOTICE_DAY,
    "day_178": MILESTONE_CRITICAL_DAY,
    "day_180": PROBATION_TERM_DAYS,
}


class AdminCreateUserRequest(BaseModel):
    email: str = Field(..., max_length=255)
    full_name: str = Field(..., max_length=255)
    # Optional: when omitted, a strong password is generated and emailed to the
    # account. Supplying one is kept for API/back-compat and tests.
    password: Optional[PasswordStr] = Field(default=None, min_length=8, max_length=128)
    role: UserRole
    # Optional tenant to place the account in. A new name provisions a new
    # Organization (empty workspace); an existing name reuses that tenant.
    # Omitted/blank keeps the administrator's own tenant (backward compatible).
    organization_name: Optional[str] = Field(default=None, max_length=255)

    # Employee-only fields. When role is probationary_employee the account and its
    # probationary profile are created together, so the account appears on the
    # employer side immediately. The record starts PENDING: the Employer assigns
    # the start date and supervisor later, which is when the 180-day clock starts.
    job_title: Optional[str] = Field(default=None, max_length=255)
    department: Optional[str] = Field(default=None, max_length=255)
    supervisor_id: Optional[uuid.UUID] = None

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return validate_email(value)


async def _org_employer_id(db: AsyncSession, organization_id: str) -> Optional[uuid.UUID]:
    """Return an employer account in the organization, or None if there is none.

    A probationary record must be owned by an Employer (the Admin is never an
    employer), so a new employee account is attached to the organization's
    existing employer.
    """
    return (
        await db.execute(
            select(User.id)
            .where(
                User.organization_id == organization_id,
                User.role == UserRole.EMPLOYER,
                User.is_active.is_(True),
            )
            .order_by(User.created_at)
            .limit(1)
        )
    ).scalar_one_or_none()


def _slugify(value: str) -> str:
    """Lowercase, dash-separated slug for a new tenant key."""
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "org"


async def _unique_slug(db: AsyncSession, base: str) -> str:
    """Return a slug not already used by an organization."""
    slug = base
    suffix = 2
    while (
        await db.execute(select(Organization.id).where(Organization.slug == slug))
    ).scalar_one_or_none() is not None:
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


async def _resolve_organization_id(
    db: AsyncSession, organization_name: Optional[str]
) -> Optional[str]:
    """Resolve a tenant slug from a name, creating the Organization when new.

    Returns ``None`` when no name is supplied so callers fall back to their own
    tenant.
    """
    if organization_name is None or not organization_name.strip():
        return None
    name = organization_name.strip()
    existing = (
        await db.execute(select(Organization).where(Organization.name == name))
    ).scalar_one_or_none()
    if existing is not None:
        return existing.slug
    slug = await _unique_slug(db, _slugify(name))
    db.add(Organization(name=name, slug=slug))
    await db.flush()
    return slug


class AdminUpdateStatusRequest(BaseModel):
    is_active: bool


class AdminResetPasswordRequest(BaseModel):
    password: PasswordStr = Field(..., min_length=8, max_length=128)


@router.get(
    "/users",
    response_model=list[UserResponse],
    summary="List all platform user accounts (Admin only)",
)
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> list[UserResponse]:
    """Retrieve every account across all tenants for platform oversight."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = list(result.scalars().all())
    org_names = {
        org.slug: org.name
        for org in (await db.execute(select(Organization))).scalars().all()
    }
    responses: list[UserResponse] = []
    for user in users:
        item = UserResponse.model_validate(user)
        item.organization_name = org_names.get(user.organization_id)
        responses.append(item)
    return responses


@router.get(
    "/organizations",
    response_model=list[OrganizationResponse],
    summary="List all tenant organizations (Admin only)",
)
async def list_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> list[Organization]:
    """Return every tenant on the platform for account provisioning."""
    result = await db.execute(select(Organization).order_by(Organization.name.asc()))
    return list(result.scalars().all())


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account with specified role (Admin only)",
)
async def create_user(
    payload: AdminCreateUserRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
) -> User:
    """Create a new user account and assign their role (Employer, Supervisor, or Probationary Employee).

    When ``organization_name`` names a new tenant, that Organization is
    provisioned so the account starts with an empty workspace.
    """
    # Email is globally unique across the platform (see User model)
    existing = await db.execute(select(User.id).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{payload.email}' already exists.",
        )

    organization_id = (
        await _resolve_organization_id(db, payload.organization_name)
        or current_user.organization_id
    )

    # A probationary employee account is created together with its profile, so it
    # appears on the employer side immediately. The HR fields are required here;
    # all of them stay editable by the Employer afterwards.
    employer_id: Optional[uuid.UUID] = None
    supervisor_id: Optional[uuid.UUID] = None
    if payload.role == UserRole.PROBATIONARY_EMPLOYEE:
        if not (payload.job_title or "").strip() or not (payload.department or "").strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "job_title and department are required to create a probationary "
                    "employee account."
                ),
            )
        employer_id = await _org_employer_id(db, organization_id)
        if employer_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "This organization has no employer account to own the employee "
                    "record. Create an employer account first."
                ),
            )
        if payload.supervisor_id is not None:
            supervisor = await db.get(User, payload.supervisor_id)
            if (
                supervisor is None
                or supervisor.organization_id != organization_id
                or supervisor.role != UserRole.SUPERVISOR
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="supervisor_id must reference a supervisor in this organization",
                )
            supervisor_id = payload.supervisor_id

    # The caller may supply a password (API/back-compat, e.g. tests); when they
    # do not, one is generated here and emailed to the new account.
    generated_password = payload.password is None
    raw_password = payload.password or generate_password()

    new_user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(raw_password),
        role=payload.role,
        organization_id=organization_id,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    if payload.role == UserRole.PROBATIONARY_EMPLOYEE:
        db.add(
            ProbationaryEmployee(
                user_id=new_user.id,
                employer_id=employer_id,
                supervisor_id=supervisor_id,
                organization_id=organization_id,
                job_title=(payload.job_title or "").strip(),
                department=(payload.department or "").strip(),
                start_date=None,
                day_180_date=None,
                status=ProbationStatus.PENDING,
            )
        )
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

    if generated_password:
        organization_name = (
            await db.execute(
                select(Organization.name).where(Organization.slug == organization_id)
            )
        ).scalar_one_or_none()
        # Sent after the response, so a slow SMTP send does not delay account
        # creation. Delivery failures are logged, never raised (see emailer.py).
        background_tasks.add_task(
            send_credentials_email,
            new_user.email,
            new_user.full_name,
            raw_password,
            organization_name,
        )

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
    if target_user is None:
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
    if target_user is None:
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
) -> list[ActivityLogResponse]:
    """Return general system activity entries across the platform."""
    stmt = (
        select(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    logs = list((await db.execute(stmt)).scalars().all())
    org_names = {
        org.slug: org.name
        for org in (await db.execute(select(Organization))).scalars().all()
    }
    return [
        ActivityLogResponse.model_validate(log).model_copy(
            update={"organization_name": org_names.get(log.organization_id)}
        )
        for log in logs
    ]


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
