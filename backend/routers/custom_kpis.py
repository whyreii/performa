"""Employer-defined custom KPIs (non-statutory).

Custom KPIs let an Employer name a performance criterion the five statutory
competencies do not cover (e.g. "How well he/she talks to the client"), rate it
weekly, and — when its monthly average falls below the critical-gap floor —
raise the catalog course it was mapped to. The mapping is chosen and stored at
configuration time (see ``/suggest-course``), so the intervention set stays
deterministic and Gemini only ever explains it (ARCHITECTURE.md §5).

Every query is scoped to ``current_user.organization_id``.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record_activity
from ..auth import require_role
from ..database import get_db
from ..domain import CUSTOM_KPIS_PER_EMPLOYEE
from ..ml.catalog import get_catalog, rank_courses_by_text
from ..models import CustomKpi, EmployeeCustomKpi, ProbationaryEmployee, User, UserRole
from ..schemas import (
    CustomKpiCourseSuggestion,
    CustomKpiCreate,
    CustomKpiResponse,
    CustomKpiUpdate,
    EmployeeCustomKpiAssign,
    EmployeeCustomKpiResponse,
)

router = APIRouter(prefix="/api/custom-kpis", tags=["Custom KPIs"])


def _catalog_ids() -> set[str]:
    """Every valid ``catalog_id`` in the bundled training catalog."""
    return {
        str(course.get("catalog_id") or course.get("course_id") or "")
        for course in get_catalog()
    }


async def _scoped_kpi(
    db: AsyncSession, kpi_id: uuid.UUID, organization_id: str
) -> CustomKpi:
    kpi = (
        await db.execute(
            select(CustomKpi).where(
                CustomKpi.id == kpi_id,
                CustomKpi.organization_id == organization_id,
            )
        )
    ).scalar_one_or_none()
    if kpi is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Custom KPI not found",
        )
    return kpi


async def _scoped_employee(
    db: AsyncSession, employee_id: uuid.UUID, organization_id: str
) -> ProbationaryEmployee:
    employee = (
        await db.execute(
            select(ProbationaryEmployee).where(
                ProbationaryEmployee.id == employee_id,
                ProbationaryEmployee.organization_id == organization_id,
            )
        )
    ).scalar_one_or_none()
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return employee


async def _assert_name_free(
    db: AsyncSession, organization_id: str, name: str, exclude_id: Optional[uuid.UUID] = None
) -> None:
    """Reject a duplicate name (case-insensitive) within the tenant."""
    stmt = select(CustomKpi).where(
        CustomKpi.organization_id == organization_id,
        func.lower(CustomKpi.name) == name.strip().lower(),
    )
    if exclude_id is not None:
        stmt = stmt.where(CustomKpi.id != exclude_id)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is None:
        return
    # A removed KPI still holds its name (the tenant-wide uniqueness rule does
    # not care about is_active), so say that plainly instead of a bare duplicate
    # error the employer cannot act on.
    if not existing.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "That name belongs to a removed custom KPI — restore it instead of "
                "creating a new one."
            ),
        )
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="A custom KPI with this name already exists.",
    )


@router.get("", response_model=list[CustomKpiResponse], summary="List custom KPIs")
async def list_custom_kpis(
    include_inactive: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.EMPLOYER, UserRole.SUPERVISOR)
    ),
) -> list[CustomKpi]:
    """Return the tenant's custom KPIs.

    Supervisors always see only the active set (the rating surface); employers
    may include deactivated ones to reactivate them.
    """
    stmt = select(CustomKpi).where(
        CustomKpi.organization_id == current_user.organization_id
    )
    if current_user.role != UserRole.EMPLOYER or not include_inactive:
        stmt = stmt.where(CustomKpi.is_active.is_(True))
    stmt = stmt.order_by(CustomKpi.created_at.asc())
    return list((await db.execute(stmt)).scalars().all())


@router.post(
    "/suggest-course",
    response_model=CustomKpiCourseSuggestion,
    summary="Suggest the best-fitting catalog course for a KPI name",
)
async def suggest_course(
    payload: CustomKpiCreate,
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> CustomKpiCourseSuggestion:
    """Rank catalog courses by lexical similarity to the KPI name (deterministic)."""
    ranked = rank_courses_by_text(payload.name)
    if not ranked:
        return CustomKpiCourseSuggestion(custom_kpi_name=payload.name)
    best = ranked[0]
    return CustomKpiCourseSuggestion(
        custom_kpi_name=payload.name,
        suggested_catalog_id=str(best.get("catalog_id") or best.get("course_id") or ""),
        suggested_title=str(
            best.get("intervention_title") or best.get("title") or ""
        ),
        match_score=float(best.get("_match_score") or 0.0),
        alternatives=[
            {
                "catalog_id": str(c.get("catalog_id") or c.get("course_id") or ""),
                "title": str(c.get("intervention_title") or c.get("title") or ""),
                "competency": str(c.get("competency") or ""),
                "match_score": float(c.get("_match_score") or 0.0),
            }
            for c in ranked[1:4]
        ],
    )


@router.post(
    "",
    response_model=CustomKpiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom KPI (Employer)",
)
async def create_custom_kpi(
    payload: CustomKpiCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> CustomKpi:
    """Create an employer-defined KPI for the tenant."""
    await _assert_name_free(db, current_user.organization_id, payload.name)

    if payload.mapped_catalog_id and payload.mapped_catalog_id not in _catalog_ids():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="mapped_catalog_id is not a catalog course.",
        )

    kpi = CustomKpi(
        organization_id=current_user.organization_id,
        name=payload.name.strip(),
        mapped_catalog_id=payload.mapped_catalog_id or None,
        created_by_id=current_user.id,
    )
    db.add(kpi)
    await db.flush()
    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="custom_kpi.create",
        entity_type="custom_kpi",
        entity_id=kpi.id,
        detail=f"{kpi.name} -> {kpi.mapped_catalog_id or 'unmapped'}",
    )
    await db.commit()
    await db.refresh(kpi)
    return kpi


@router.put(
    "/{kpi_id}",
    response_model=CustomKpiResponse,
    summary="Update a custom KPI (Employer)",
)
async def update_custom_kpi(
    kpi_id: uuid.UUID,
    payload: CustomKpiUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> CustomKpi:
    """Rename, remap, or deactivate a custom KPI."""
    kpi = await _scoped_kpi(db, kpi_id, current_user.organization_id)

    if payload.name is not None and payload.name.strip() != kpi.name:
        await _assert_name_free(
            db, current_user.organization_id, payload.name, exclude_id=kpi.id
        )
        kpi.name = payload.name.strip()

    if payload.mapped_catalog_id is not None:
        if payload.mapped_catalog_id and payload.mapped_catalog_id not in _catalog_ids():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="mapped_catalog_id is not a catalog course.",
            )
        kpi.mapped_catalog_id = payload.mapped_catalog_id or None

    if payload.is_active is not None:
        kpi.is_active = payload.is_active

    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="custom_kpi.update",
        entity_type="custom_kpi",
        entity_id=kpi.id,
        detail=f"{kpi.name} active={kpi.is_active}",
    )
    await db.commit()
    await db.refresh(kpi)
    return kpi


@router.delete(
    "/{kpi_id}",
    response_model=CustomKpiResponse,
    summary="Deactivate a custom KPI (Employer)",
)
async def deactivate_custom_kpi(
    kpi_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> CustomKpi:
    """Soft-delete: keeps historical ratings intact (never a hard delete)."""
    kpi = await _scoped_kpi(db, kpi_id, current_user.organization_id)
    kpi.is_active = False
    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="custom_kpi.deactivate",
        entity_type="custom_kpi",
        entity_id=kpi.id,
        detail=kpi.name,
    )
    await db.commit()
    await db.refresh(kpi)
    return kpi


@router.get(
    "/employees/{employee_id}",
    response_model=EmployeeCustomKpiResponse,
    summary="Custom KPIs assigned to an employee",
)
async def list_employee_custom_kpis(
    employee_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.EMPLOYER, UserRole.SUPERVISOR)
    ),
) -> EmployeeCustomKpiResponse:
    """The custom KPIs this employee is rated on.

    Supervisors need this to know which scales to show; it is never used to
    decide statutory scoring.
    """
    await _scoped_employee(db, employee_id, current_user.organization_id)
    assigned = list(
        (
            await db.execute(
                select(EmployeeCustomKpi.custom_kpi_id).where(
                    EmployeeCustomKpi.employee_id == employee_id,
                    EmployeeCustomKpi.organization_id
                    == current_user.organization_id,
                )
            )
        )
        .scalars()
        .all()
    )
    return EmployeeCustomKpiResponse(
        employee_id=employee_id, custom_kpi_ids=assigned
    )


@router.put(
    "/employees/{employee_id}",
    response_model=EmployeeCustomKpiResponse,
    summary="Assign custom KPIs to an employee (Employer)",
)
async def set_employee_custom_kpis(
    employee_id: uuid.UUID,
    payload: EmployeeCustomKpiAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> EmployeeCustomKpiResponse:
    """Replace the employee's assigned custom KPIs (idempotent).

    At most ``CUSTOM_KPIS_PER_EMPLOYEE`` may be assigned; every id must be an
    active custom KPI of this tenant. An empty list is valid — it means the
    employee is rated on the five statutory competencies only.
    """
    await _scoped_employee(db, employee_id, current_user.organization_id)

    wanted = list(dict.fromkeys(payload.custom_kpi_ids))
    if len(wanted) > CUSTOM_KPIS_PER_EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"At most {CUSTOM_KPIS_PER_EMPLOYEE} custom KPIs can be "
                "assigned to one employee."
            ),
        )

    if wanted:
        known = set(
            (
                await db.execute(
                    select(CustomKpi.id).where(
                        CustomKpi.id.in_(wanted),
                        CustomKpi.organization_id == current_user.organization_id,
                        CustomKpi.is_active.is_(True),
                    )
                )
            )
            .scalars()
            .all()
        )
        if set(wanted) - known:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Every assigned custom KPI must be an active KPI of this "
                    "organization."
                ),
            )

    await db.execute(
        delete(EmployeeCustomKpi).where(
            EmployeeCustomKpi.employee_id == employee_id,
            EmployeeCustomKpi.organization_id == current_user.organization_id,
        )
    )
    for kpi_id in wanted:
        db.add(
            EmployeeCustomKpi(
                employee_id=employee_id,
                custom_kpi_id=kpi_id,
                organization_id=current_user.organization_id,
            )
        )

    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="custom_kpi.assign",
        entity_type="probationary_employee",
        entity_id=employee_id,
        detail=f"{len(wanted)} custom KPI(s) assigned",
    )
    await db.commit()
    return EmployeeCustomKpiResponse(
        employee_id=employee_id, custom_kpi_ids=wanted
    )
