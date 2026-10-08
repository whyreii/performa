"""Probationary employee routes for Performa.

Covers onboarding (linking or creating the backing user account), tenant-scoped
listing, Philippine Labor Code Article 296 milestone reporting, profile
retrieval, standards acknowledgement, and status transitions.

Multi-tenancy is enforced on every query by filtering on
``organization_id == current_user.organization_id``. When a tenant filter is
applied a missing row yields ``404`` (never leaking cross-tenant existence).
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Load, selectinload

from ..auth import get_current_user, get_password_hash, require_role
from ..audit import record_activity
from ..database import get_db
from ..emailer import send_credentials_email
from ..models import Organization, ProbationaryEmployee, ProbationStatus, User, UserRole
from ..notifications import create_notification
from ..passwords import generate_password
from ..schemas import (
    MilestoneEmployee,
    MilestoneReport,
    ProbationaryEmployeeCreateRequest,
    ProbationaryEmployeeDetailResponse,
    ProbationaryEmployeeStatusUpdate,
    UserResponse,
)
from ..timeutils import manila_today

router = APIRouter(tags=["Employees"])

PROBATION_TERM_DAYS = 180
MILESTONE_LEAD_DAYS = 7

# Statutory milestone alerts (Article 296). Each fires at most once per
# employee; the Employer always receives all three, the assigned Supervisor
# only the Day 150 review alert (Manuscript: supervisor is view-only for alerts).
# (day, employee flag attribute, notification title, category)
MILESTONE_ALERT_STEPS: tuple[tuple[int, str, str, str], ...] = (
    (150, "milestone_150_alerted", "Day 150 · Performance appraisal due", "milestone_150"),
    (165, "milestone_165_alerted", "Day 165 · Written-notice window", "milestone_165"),
    (178, "milestone_178_alerted", "Day 178 · Critical 48h to regularization", "milestone_178"),
)


def _employee_load_options() -> tuple[Load, ...]:
    """Eager-load relationships required by the detail response schema."""
    return (
        selectinload(ProbationaryEmployee.user),
        selectinload(ProbationaryEmployee.employer),
        selectinload(ProbationaryEmployee.supervisor),
    )


async def _fetch_employee(
    db: AsyncSession,
    employee_id: uuid.UUID,
    organization_id: str,
) -> ProbationaryEmployee:
    """Fetch an employee within the tenant, eagerly loading account relations."""
    stmt = (
        select(ProbationaryEmployee)
        .options(*_employee_load_options())
        .where(
            ProbationaryEmployee.id == employee_id,
            ProbationaryEmployee.organization_id == organization_id,
        )
    )
    result = await db.execute(stmt)
    employee = result.scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Probationary employee not found",
        )
    return employee


def _milestone_item(employee: ProbationaryEmployee, as_of: date) -> MilestoneEmployee:
    """Compute an employee's position relative to the statutory milestones."""
    day_150_date = employee.start_date + timedelta(days=150)
    day_165_date = employee.start_date + timedelta(days=165)
    day_178_date = employee.start_date + timedelta(days=178)
    days_elapsed = (as_of - employee.start_date).days
    days_remaining = (employee.day_180_date - as_of).days
    return MilestoneEmployee(
        employee=employee,
        days_elapsed=days_elapsed,
        days_remaining=days_remaining,
        day_150_date=day_150_date,
        day_165_date=day_165_date,
        day_178_date=day_178_date,
        day_150_reached=as_of >= day_150_date,
        day_165_reached=as_of >= day_165_date,
        day_178_reached=as_of >= day_178_date,
        overdue=days_remaining < 0,
    )


async def _fire_milestone_alerts(
    db: AsyncSession, organization_id: Optional[str] = None
) -> int:
    """Dispatch due statutory milestone alerts for active probationers.

    Idempotent: each of the Day 150/165/178 alerts fires at most once per
    employee (guarded by the ``milestone_*_alerted`` flags). The Employer always
    receives all three; the assigned Supervisor receives only the Day 150 review
    alert. When ``organization_id`` is ``None`` every tenant is scanned (used by
    the background dispatch loop). Returns the number of alerts fired.
    """
    stmt = (
        select(ProbationaryEmployee)
        .options(selectinload(ProbationaryEmployee.user))
        .where(ProbationaryEmployee.status == ProbationStatus.ACTIVE)
    )
    if organization_id is not None:
        stmt = stmt.where(ProbationaryEmployee.organization_id == organization_id)
    employees = list((await db.execute(stmt)).scalars().all())

    as_of = manila_today()
    fired = 0
    for employee in employees:
        for day, flag_attr, title, category in MILESTONE_ALERT_STEPS:
            if getattr(employee, flag_attr):
                continue
            if as_of < employee.start_date + timedelta(days=day):
                continue

            setattr(employee, flag_attr, True)
            fired += 1
            days_elapsed = (as_of - employee.start_date).days
            name = employee.user.full_name if employee.user else "A probationary employee"
            body = (
                f"{name} is at Day {days_elapsed} of 180 and has reached the "
                f"statutory Day {day} milestone under Article 296."
            )
            create_notification(
                db,
                user_id=employee.employer_id,
                organization_id=employee.organization_id,
                title=title,
                body=body,
                category=category,
            )
            if day == 150 and employee.supervisor_id is not None:
                create_notification(
                    db,
                    user_id=employee.supervisor_id,
                    organization_id=employee.organization_id,
                    title=title,
                    body=body,
                    category=category,
                )

    if fired:
        await db.commit()
    return fired


def _is_approaching_or_past(threshold_date: date, as_of: date) -> bool:
    """True once a threshold is reached or within the lead window before it."""
    return as_of >= threshold_date - timedelta(days=MILESTONE_LEAD_DAYS)


@router.post(
    "/",
    response_model=ProbationaryEmployeeDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Onboard a probationary employee",
)
async def create_employee(
    payload: ProbationaryEmployeeCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> ProbationaryEmployee:
    """Create a probationary profile, creating or linking its user account."""
    organization_id = current_user.organization_id
    generated_password = False
    raw_password: Optional[str] = None

    if payload.user_id is not None:
        user = await db.get(User, payload.user_id)
        if user is None or user.organization_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        if user.role != UserRole.PROBATIONARY_EMPLOYEE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Linked user must have the probationary_employee role",
            )
        existing = await db.execute(
            select(ProbationaryEmployee.id).where(ProbationaryEmployee.user_id == user.id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already has a probationary employee profile",
            )
    else:
        if not payload.email or not payload.full_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="email and full_name are required to create a new user",
            )
        duplicate = await db.execute(select(User.id).where(User.email == payload.email))
        if duplicate.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )
        # When the caller omits a password, generate one and email it to the new
        # account (same flow as admin provisioning; delivery never blocks creation).
        generated_password = payload.password is None
        raw_password = payload.password or generate_password()
        user = User(
            email=payload.email,
            hashed_password=get_password_hash(raw_password),
            full_name=payload.full_name,
            role=UserRole.PROBATIONARY_EMPLOYEE,
            organization_id=organization_id,
            is_active=True,
        )
        db.add(user)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )

    employer_id = payload.employer_id or current_user.id
    employer = await db.get(User, employer_id)
    if (
        employer is None
        or employer.organization_id != organization_id
        or employer.role != UserRole.EMPLOYER
    ):
        # Only an Employer may own a probationary record (Manuscript Scope of the
        # Study: the Admin is view-only and never an employer). This prevents an
        # Admin from being assigned as employer_id and receiving employer-only
        # milestone alerts.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="employer_id must reference an employer in your organization",
        )

    supervisor = await db.get(User, payload.supervisor_id)
    if (
        supervisor is None
        or supervisor.organization_id != organization_id
        or supervisor.role != UserRole.SUPERVISOR
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="supervisor_id must reference a supervisor in your organization",
        )

    day_180_date = payload.day_180_date or (payload.start_date + timedelta(days=PROBATION_TERM_DAYS))
    if day_180_date <= payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_180_date must be after start_date",
        )

    employee = ProbationaryEmployee(
        user_id=user.id,
        employer_id=employer.id,
        supervisor_id=supervisor.id,
        organization_id=organization_id,
        job_title=payload.job_title,
        department=payload.department,
        start_date=payload.start_date,
        day_180_date=day_180_date,
        status=payload.status,
    )
    db.add(employee)
    await db.flush()
    record_activity(
        db,
        organization_id=organization_id,
        actor=current_user,
        action="employee.create",
        entity_type="employee",
        entity_id=employee.id,
        detail=f"{employee.department}:{employee.job_title}",
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create the probationary employee profile",
        )

    if generated_password and raw_password:
        organization_name = (
            await db.execute(
                select(Organization.name).where(Organization.slug == organization_id)
            )
        ).scalar_one_or_none()
        await send_credentials_email(
            user.email, user.full_name, raw_password, organization_name
        )

    return await _fetch_employee(db, employee.id, organization_id)


@router.get(
    "/",
    response_model=list[ProbationaryEmployeeDetailResponse],
    summary="List probationary employees in the tenant",
)
async def list_employees(
    status_filter: Optional[ProbationStatus] = Query(default=None, alias="status"),
    department: Optional[str] = Query(default=None, max_length=255),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProbationaryEmployee]:
    """List employees, scoped by tenant and, for supervisors, by assignment."""
    stmt = (
        select(ProbationaryEmployee)
        .options(*_employee_load_options())
        .where(ProbationaryEmployee.organization_id == current_user.organization_id)
    )

    if current_user.role == UserRole.SUPERVISOR:
        stmt = stmt.where(ProbationaryEmployee.supervisor_id == current_user.id)
    elif current_user.role == UserRole.PROBATIONARY_EMPLOYEE:
        stmt = stmt.where(ProbationaryEmployee.user_id == current_user.id)
    elif current_user.role != UserRole.EMPLOYER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted for current role",
        )

    if status_filter is not None:
        stmt = stmt.where(ProbationaryEmployee.status == status_filter)
    if department is not None:
        stmt = stmt.where(ProbationaryEmployee.department == department)

    stmt = (
        stmt.order_by(ProbationaryEmployee.day_180_date.asc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/milestones",
    response_model=MilestoneReport,
    summary="Article 296 milestone report (Day 150 / 165 / 178)",
)
async def list_milestones(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.EMPLOYER, UserRole.SUPERVISOR)
    ),
) -> MilestoneReport:
    """Return active employees approaching or past each statutory threshold."""
    as_of = manila_today()

    stmt = (
        select(ProbationaryEmployee)
        .options(*_employee_load_options())
        .where(
            ProbationaryEmployee.organization_id == current_user.organization_id,
            ProbationaryEmployee.status == ProbationStatus.ACTIVE,
            ProbationaryEmployee.start_date
            <= as_of - timedelta(days=150 - MILESTONE_LEAD_DAYS),
        )
    )
    if current_user.role == UserRole.SUPERVISOR:
        stmt = stmt.where(ProbationaryEmployee.supervisor_id == current_user.id)
    stmt = stmt.order_by(ProbationaryEmployee.day_180_date.asc())

    result = await db.execute(stmt)
    employees = list(result.scalars().all())

    day_150: list[MilestoneEmployee] = []
    day_165: list[MilestoneEmployee] = []
    day_178: list[MilestoneEmployee] = []

    for employee in employees:
        item = _milestone_item(employee, as_of)
        if _is_approaching_or_past(item.day_150_date, as_of):
            day_150.append(item)
        if _is_approaching_or_past(item.day_165_date, as_of):
            day_165.append(item)
        if _is_approaching_or_past(item.day_178_date, as_of):
            day_178.append(item)

    return MilestoneReport(as_of=as_of, day_150=day_150, day_165=day_165, day_178=day_178)


@router.post(
    "/milestones/scan",
    summary="Dispatch due statutory milestone alerts (Employer)",
)
async def scan_milestone_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> dict[str, int]:
    """Fire any due, un-dispatched Day 150/165/178 alerts for the caller's tenant.

    Idempotent: each alert fires at most once per employee, so the Employer
    dashboard can call this on load to dispatch alerts automatically.
    """
    fired = await _fire_milestone_alerts(db, current_user.organization_id)
    if fired:
        record_activity(
            db,
            organization_id=current_user.organization_id,
            actor=current_user,
            action="milestone.dispatch",
            entity_type="organization",
            entity_id=current_user.organization_id,
            detail=f"fired={fired}",
        )
        await db.commit()
    return {"fired": fired}


@router.get(
    "/supervisors",
    response_model=list[UserResponse],
    summary="List supervisors in the tenant",
)
async def list_supervisors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> list[User]:
    """Return active supervisors in the caller's organization for assignment."""
    stmt = (
        select(User)
        .where(
            User.organization_id == current_user.organization_id,
            User.role == UserRole.SUPERVISOR,
            User.is_active.is_(True),
        )
        .order_by(User.full_name.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/{employee_id}",
    response_model=ProbationaryEmployeeDetailResponse,
    summary="Retrieve a probationary employee profile",
)
async def get_employee(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProbationaryEmployee:
    """Return a full profile for an employer, assigned supervisor, or self."""
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted for current role",
        )
    employee = await _fetch_employee(db, employee_id, current_user.organization_id)

    if current_user.role == UserRole.EMPLOYER:
        return employee
    if current_user.role == UserRole.SUPERVISOR and employee.supervisor_id == current_user.id:
        return employee
    if (
        current_user.role == UserRole.PROBATIONARY_EMPLOYEE
        and employee.user_id == current_user.id
    ):
        return employee

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Operation not permitted for current role",
    )


@router.post(
    "/{employee_id}/acknowledge-standards",
    response_model=ProbationaryEmployeeDetailResponse,
    summary="Acknowledge initial performance standards",
)
async def acknowledge_standards(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProbationaryEmployee:
    """Stamp standards acknowledgement for the employee's own profile only."""
    employee = await _fetch_employee(db, employee_id, current_user.organization_id)

    if (
        current_user.role != UserRole.PROBATIONARY_EMPLOYEE
        or employee.user_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the probationary employee may acknowledge their standards",
        )

    if employee.standards_acknowledged_at is None:
        employee.standards_acknowledged_at = datetime.now(timezone.utc)
        record_activity(
            db,
            organization_id=current_user.organization_id,
            actor=current_user,
            action="employee.acknowledge_standards",
            entity_type="employee",
            entity_id=employee.id,
        )
        await db.commit()
        await db.refresh(employee)

    return employee


@router.patch(
    "/{employee_id}/status",
    response_model=ProbationaryEmployeeDetailResponse,
    summary="Update probationary status (regularized / terminated)",
)
async def update_status(
    employee_id: uuid.UUID,
    payload: ProbationaryEmployeeStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> ProbationaryEmployee:
    """Transition status to regularized or terminated, recording the reason."""
    if payload.status not in (ProbationStatus.REGULARIZED, ProbationStatus.TERMINATED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be 'regularized' or 'terminated'",
        )
    if payload.status == ProbationStatus.TERMINATED and not payload.reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="reason is required when terminating an employee",
        )

    employee = await _fetch_employee(db, employee_id, current_user.organization_id)

    if employee.status in (ProbationStatus.REGULARIZED, ProbationStatus.TERMINATED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cannot update status; employee is already in terminal state "
                f"'{employee.status.value}'."
            ),
        )

    employee.status = payload.status
    if payload.reason is not None:
        employee.status_reason = payload.reason
    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="employee.status",
        entity_type="employee",
        entity_id=employee.id,
        detail=f"status={payload.status.value}",
    )
    await db.commit()

    return await _fetch_employee(db, employee_id, current_user.organization_id)


__all__ = ["router"]
