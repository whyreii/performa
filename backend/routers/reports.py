"""Persisted performance-report records (the manuscript's generated-reports list).

A report is generated on demand; each generation records a metadata row
(title / date / size) so the employer can review prior reports. The report body
is regenerated from current data on open/download.

Employer-only; every query is tenant-scoped.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..audit import record_activity
from ..auth import require_role
from ..database import get_db
from ..models import ProbationaryEmployee, Report, User, UserRole
from ..schemas import ReportGenerateRequest, ReportResponse
from .evaluations import _get_scoped_employee, _html_to_pdf, _render_report_html

router = APIRouter(prefix="/api/reports", tags=["Reports"])

REPORT_TITLE = "Performance Evaluation Report (Article 296)"


def _to_response(report: Report) -> ReportResponse:
    return ReportResponse(
        id=report.id,
        employee_id=report.employee_id,
        employee_name=(
            report.employee.user.full_name
            if report.employee and report.employee.user
            else None
        ),
        report_type=report.report_type,
        title=report.title,
        size_bytes=report.size_bytes,
        generated_by_name=(report.generated_by.full_name if report.generated_by else None),
        created_at=report.created_at,
    )


@router.get(
    "",
    response_model=list[ReportResponse],
    summary="List generated reports (Employer)",
)
async def list_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> list[ReportResponse]:
    """Return the tenant's generated reports, newest first."""
    stmt = (
        select(Report)
        .options(
            selectinload(Report.employee).selectinload(ProbationaryEmployee.user),
            selectinload(Report.generated_by),
        )
        .where(Report.organization_id == current_user.organization_id)
        .order_by(Report.created_at.desc())
    )
    reports = (await db.execute(stmt)).scalars().all()
    return [_to_response(report) for report in reports]


@router.post(
    "",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate and record a report (Employer)",
)
async def generate_report(
    payload: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> ReportResponse:
    """Generate a report for an employee and persist the record."""
    employee = await _get_scoped_employee(db, payload.employee_id, current_user)
    document = await _render_report_html(db, employee, current_user.organization_id)

    report = Report(
        organization_id=current_user.organization_id,
        employee_id=employee.id,
        generated_by_id=current_user.id,
        report_type=payload.report_type or "performance",
        title=REPORT_TITLE,
        size_bytes=len(document.encode("utf-8")),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    return ReportResponse(
        id=report.id,
        employee_id=employee.id,
        employee_name=employee.user.full_name if employee.user else None,
        report_type=report.report_type,
        title=report.title,
        size_bytes=report.size_bytes,
        generated_by_name=current_user.full_name,
        created_at=report.created_at,
    )


@router.get(
    "/{report_id}/pdf",
    summary="Download a recorded report as PDF (Employer)",
)
async def download_report_pdf(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> Response:
    """Regenerate the report body for a recorded report and return it as PDF."""
    report = (
        await db.execute(
            select(Report).where(
                Report.id == report_id,
                Report.organization_id == current_user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )

    employee = await _get_scoped_employee(db, report.employee_id, current_user)
    document = await _render_report_html(db, employee, current_user.organization_id)
    pdf_bytes = _html_to_pdf(document)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="performa-report-{report.id}.pdf"'
        },
    )


@router.delete(
    "/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a recorded report (Employer)",
)
async def delete_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EMPLOYER)),
) -> Response:
    """Remove a report row from the tenant's library (the deletion is logged)."""
    report = (
        await db.execute(
            select(Report).where(
                Report.id == report_id,
                Report.organization_id == current_user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )

    await db.delete(report)
    record_activity(
        db,
        organization_id=current_user.organization_id,
        actor=current_user,
        action="report.delete",
        entity_type="report",
        entity_id=report_id,
        detail=report.title,
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
