"""Pydantic v2 request/response schemas for Performa.

Each entity exposes a ``Base`` schema (shared fields), a ``Create`` schema
(creation payload), an ``Update`` schema (all-optional partial update), and a
``Response`` schema (ORM-mapped output).

Competency scores are bounded to the rubric range ``1.0`` – ``5.0`` using
``Field(ge=1.0, le=5.0)``. Response schemas use
``ConfigDict(from_attributes=True)`` so they can be constructed directly from
SQLAlchemy ORM instances.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from .models import (
    CompetencyEnum,
    PerformanceRatingEnum,
    ProbationStatus,
    TrainingStatusEnum,
    UserRole,
)


# ---------------------------------------------------------------------------
# User / Auth
# ---------------------------------------------------------------------------
class UserBase(BaseModel):
    email: str = Field(..., max_length=255)
    full_name: str = Field(..., max_length=255)
    role: UserRole
    organization_id: str = Field(..., max_length=100)
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)


class UserUpdate(BaseModel):
    email: Optional[str] = Field(default=None, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=255)
    role: Optional[UserRole] = None
    organization_id: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[UserRole] = None
    organization_id: Optional[str] = None
    exp: Optional[int] = None


# ---------------------------------------------------------------------------
# ProbationaryEmployee
# ---------------------------------------------------------------------------
class ProbationaryEmployeeBase(BaseModel):
    user_id: uuid.UUID
    employer_id: uuid.UUID
    supervisor_id: uuid.UUID
    organization_id: str = Field(..., max_length=100)
    job_title: str = Field(..., max_length=255)
    department: str = Field(..., max_length=255)
    start_date: date
    day_180_date: date
    status: ProbationStatus = ProbationStatus.ACTIVE


class ProbationaryEmployeeCreate(ProbationaryEmployeeBase):
    pass


class ProbationaryEmployeeUpdate(BaseModel):
    employer_id: Optional[uuid.UUID] = None
    supervisor_id: Optional[uuid.UUID] = None
    organization_id: Optional[str] = Field(default=None, max_length=100)
    job_title: Optional[str] = Field(default=None, max_length=255)
    department: Optional[str] = Field(default=None, max_length=255)
    start_date: Optional[date] = None
    day_180_date: Optional[date] = None
    status: Optional[ProbationStatus] = None
    milestone_150_alerted: Optional[bool] = None
    milestone_165_alerted: Optional[bool] = None
    milestone_178_alerted: Optional[bool] = None
    standards_acknowledged_at: Optional[datetime] = None
    status_reason: Optional[str] = None


class ProbationaryEmployeeResponse(ProbationaryEmployeeBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    milestone_150_alerted: bool = False
    milestone_165_alerted: bool = False
    milestone_178_alerted: bool = False
    standards_acknowledged_at: Optional[datetime] = None
    status_reason: Optional[str] = None
    updated_at: datetime


class ProbationaryEmployeeDetailResponse(ProbationaryEmployeeResponse):
    """Employee profile enriched with its linked account relationships."""

    user: UserResponse
    employer: UserResponse
    supervisor: UserResponse


class ProbationaryEmployeeCreateRequest(BaseModel):
    """Onboarding payload: link an existing user or create a new account."""

    user_id: Optional[uuid.UUID] = None
    email: Optional[str] = Field(default=None, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=255)
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)

    employer_id: Optional[uuid.UUID] = None
    supervisor_id: uuid.UUID
    job_title: str = Field(..., max_length=255)
    department: str = Field(..., max_length=255)
    start_date: date
    day_180_date: Optional[date] = None
    status: ProbationStatus = ProbationStatus.ACTIVE


class ProbationaryEmployeeStatusUpdate(BaseModel):
    """Status transition payload for regularizing or terminating an employee."""

    status: ProbationStatus
    reason: Optional[str] = None


class MilestoneEmployee(BaseModel):
    """An active employee positioned relative to the statutory milestones."""

    model_config = ConfigDict(from_attributes=True)

    employee: ProbationaryEmployeeDetailResponse
    days_elapsed: int
    days_remaining: int
    day_150_date: date
    day_165_date: date
    day_178_date: date
    day_150_reached: bool
    day_165_reached: bool
    day_178_reached: bool
    overdue: bool


class MilestoneReport(BaseModel):
    """Active employees approaching or past each Article 296 threshold."""

    as_of: date
    day_150: list[MilestoneEmployee]
    day_165: list[MilestoneEmployee]
    day_178: list[MilestoneEmployee]


# ---------------------------------------------------------------------------
# KpiRubric
# ---------------------------------------------------------------------------
class KpiRubricBase(BaseModel):
    organization_id: str = Field(..., max_length=100)
    competency: CompetencyEnum
    target_score: float = Field(default=3.0, ge=1.0, le=5.0)
    weight: float = Field(default=0.20, ge=0.0, le=1.0)


class KpiRubricCreate(KpiRubricBase):
    pass


class KpiRubricUpdate(BaseModel):
    organization_id: Optional[str] = Field(default=None, max_length=100)
    competency: Optional[CompetencyEnum] = None
    target_score: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    weight: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class KpiRubricResponse(KpiRubricBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


# ---------------------------------------------------------------------------
# WeeklyEvaluation
# ---------------------------------------------------------------------------
class WeeklyEvaluationBase(BaseModel):
    employee_id: uuid.UUID
    supervisor_id: uuid.UUID
    week_number: int = Field(..., ge=1)
    date_logged: date
    task_completion_score: float = Field(..., ge=1.0, le=5.0)
    attendance_score: float = Field(..., ge=1.0, le=5.0)
    communication_score: float = Field(..., ge=1.0, le=5.0)
    initiative_score: float = Field(..., ge=1.0, le=5.0)
    quality_score: float = Field(..., ge=1.0, le=5.0)
    qualitative_notes: Optional[str] = None


class WeeklyEvaluationCreate(WeeklyEvaluationBase):
    pass


class WeeklyEvaluationUpdate(BaseModel):
    supervisor_id: Optional[uuid.UUID] = None
    week_number: Optional[int] = Field(default=None, ge=1)
    date_logged: Optional[date] = None
    task_completion_score: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    attendance_score: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    communication_score: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    initiative_score: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    quality_score: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    qualitative_notes: Optional[str] = None


class WeeklyEvaluationResponse(WeeklyEvaluationBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


# ---------------------------------------------------------------------------
# MonthlySummary
# ---------------------------------------------------------------------------
class MonthlySummaryBase(BaseModel):
    employee_id: uuid.UUID
    month_number: int = Field(..., ge=1)
    avg_task_completion: float = Field(..., ge=1.0, le=5.0)
    avg_attendance: float = Field(..., ge=1.0, le=5.0)
    avg_communication: float = Field(..., ge=1.0, le=5.0)
    avg_initiative: float = Field(..., ge=1.0, le=5.0)
    avg_quality: float = Field(..., ge=1.0, le=5.0)
    overall_average: float = Field(..., ge=1.0, le=5.0)
    status_classification: PerformanceRatingEnum
    performance_summary: Optional[str] = None


class MonthlySummaryCreate(MonthlySummaryBase):
    pass


class MonthlySummaryUpdate(BaseModel):
    month_number: Optional[int] = Field(default=None, ge=1)
    avg_task_completion: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    avg_attendance: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    avg_communication: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    avg_initiative: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    avg_quality: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    overall_average: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    status_classification: Optional[PerformanceRatingEnum] = None
    performance_summary: Optional[str] = None


class MonthlySummaryResponse(MonthlySummaryBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


# ---------------------------------------------------------------------------
# TrainingPlan
# ---------------------------------------------------------------------------
class TrainingPlanBase(BaseModel):
    employee_id: uuid.UUID
    monthly_summary_id: Optional[uuid.UUID] = None
    competency: str = Field(..., max_length=100)
    catalog_id: str = Field(..., max_length=100)
    intervention_title: str = Field(..., max_length=255)
    intervention_type: str = Field(..., max_length=100)
    default_timeline: str = Field(..., max_length=100)
    rationale: Optional[str] = None
    status: TrainingStatusEnum = TrainingStatusEnum.PENDING_APPROVAL
    employer_approved_at: Optional[datetime] = None


class TrainingPlanCreate(TrainingPlanBase):
    pass


class TrainingPlanUpdate(BaseModel):
    monthly_summary_id: Optional[uuid.UUID] = None
    competency: Optional[str] = Field(default=None, max_length=100)
    catalog_id: Optional[str] = Field(default=None, max_length=100)
    intervention_title: Optional[str] = Field(default=None, max_length=255)
    intervention_type: Optional[str] = Field(default=None, max_length=100)
    default_timeline: Optional[str] = Field(default=None, max_length=100)
    rationale: Optional[str] = None
    status: Optional[TrainingStatusEnum] = None
    employer_approved_at: Optional[datetime] = None


class TrainingPlanResponse(TrainingPlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


# ---------------------------------------------------------------------------
# EvaluationAuditLog
# ---------------------------------------------------------------------------
class EvaluationAuditLogBase(BaseModel):
    evaluation_id: uuid.UUID
    employee_id: uuid.UUID
    evaluator_id: uuid.UUID
    previous_scores: dict[str, Any]
    new_scores: dict[str, Any]
    justification: str


class EvaluationAuditLogCreate(EvaluationAuditLogBase):
    pass


class EvaluationAuditLogUpdate(BaseModel):
    previous_scores: Optional[dict[str, Any]] = None
    new_scores: Optional[dict[str, Any]] = None
    justification: Optional[str] = None


class EvaluationAuditLogResponse(EvaluationAuditLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    timestamp: datetime


__all__ = [
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "Token",
    "TokenPayload",
    "ProbationaryEmployeeBase",
    "ProbationaryEmployeeCreate",
    "ProbationaryEmployeeUpdate",
    "ProbationaryEmployeeResponse",
    "ProbationaryEmployeeDetailResponse",
    "ProbationaryEmployeeCreateRequest",
    "ProbationaryEmployeeStatusUpdate",
    "MilestoneEmployee",
    "MilestoneReport",
    "KpiRubricBase",
    "KpiRubricCreate",
    "KpiRubricUpdate",
    "KpiRubricResponse",
    "WeeklyEvaluationBase",
    "WeeklyEvaluationCreate",
    "WeeklyEvaluationUpdate",
    "WeeklyEvaluationResponse",
    "MonthlySummaryBase",
    "MonthlySummaryCreate",
    "MonthlySummaryUpdate",
    "MonthlySummaryResponse",
    "TrainingPlanBase",
    "TrainingPlanCreate",
    "TrainingPlanUpdate",
    "TrainingPlanResponse",
    "EvaluationAuditLogBase",
    "EvaluationAuditLogCreate",
    "EvaluationAuditLogUpdate",
    "EvaluationAuditLogResponse",
]
