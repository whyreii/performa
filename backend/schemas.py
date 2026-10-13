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

import re
import uuid
from datetime import date, datetime
from typing import Annotated, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from .models import (
    CompetencyEnum,
    PerformanceRatingEnum,
    ProbationStatus,
    TrainingStatusEnum,
    UserRole,
)


# ---------------------------------------------------------------------------
# Shared validators
# ---------------------------------------------------------------------------
# Dependency-free email format check (pydantic's EmailStr needs the optional
# `email-validator` package, which is not a project dependency). Rejects values
# without a local part, domain, or TLD; does not do DNS/existence checks.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


def validate_email(value: str) -> str:
    if not _EMAIL_RE.match(value):
        raise ValueError("Invalid email address")
    return value


def validate_password(value: str) -> str:
    """Strength policy: >= 8 characters with an uppercase, a lowercase, and a digit."""
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not any(c.isupper() for c in value):
        raise ValueError("Password must contain an uppercase letter")
    if not any(c.islower() for c in value):
        raise ValueError("Password must contain a lowercase letter")
    if not any(c.isdigit() for c in value):
        raise ValueError("Password must contain a number")
    return value


# Reusable password field type — the single source for the strength policy.
PasswordStr = Annotated[str, AfterValidator(validate_password)]


# ---------------------------------------------------------------------------
# User / Auth
# ---------------------------------------------------------------------------
class UserBase(BaseModel):
    email: str = Field(..., max_length=255)
    full_name: str = Field(..., max_length=255)
    role: UserRole
    organization_id: str = Field(..., max_length=100)
    is_active: bool = True

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return validate_email(value)


class UserCreate(UserBase):
    password: PasswordStr = Field(..., min_length=8, max_length=128)


class UserUpdate(BaseModel):
    email: Optional[str] = Field(default=None, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=255)
    role: Optional[UserRole] = None
    organization_id: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None
    password: Optional[PasswordStr] = Field(default=None, min_length=8, max_length=128)


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    # Tenant display name (resolved from Organization.name); None when unknown.
    organization_name: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[UserRole] = None
    organization_id: Optional[str] = None
    exp: Optional[int] = None


class PasswordChange(BaseModel):
    """Self-service password change payload."""

    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: PasswordStr = Field(..., min_length=8, max_length=128)


class ProfileUpdate(BaseModel):
    """Self-service profile update payload."""

    full_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)


class RegisterRequest(BaseModel):
    """Public self-registration payload: an Employer plus a brand-new tenant."""

    full_name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., max_length=255)
    organization_name: str = Field(..., min_length=1, max_length=255)
    password: PasswordStr = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return validate_email(value)

    @field_validator("full_name", "organization_name")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value


class ForgotPasswordRequest(BaseModel):
    """Request a password-reset link for the given email."""

    email: str = Field(..., max_length=255)

    @field_validator("email")
    @classmethod
    def _check_email(cls, value: str) -> str:
        return validate_email(value)


class ResetPasswordRequest(BaseModel):
    """Complete a password reset with the token from the emailed link."""

    token: str = Field(..., min_length=1, max_length=512)
    new_password: PasswordStr = Field(..., min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Organization (tenant)
# ---------------------------------------------------------------------------
class OrganizationUpdate(BaseModel):
    """Rename payload for the caller's tenant."""

    name: str = Field(..., min_length=1, max_length=255)


class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str


# ---------------------------------------------------------------------------
# ProbationaryEmployee
# ---------------------------------------------------------------------------
class ProbationaryEmployeeBase(BaseModel):
    user_id: uuid.UUID
    employer_id: uuid.UUID
    supervisor_id: Optional[uuid.UUID] = None
    organization_id: str = Field(..., max_length=100)
    job_title: str = Field(..., max_length=255)
    department: str = Field(..., max_length=255)
    start_date: date
    day_180_date: date
    status: ProbationStatus = ProbationStatus.ACTIVE


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
    supervisor: Optional[UserResponse] = None


class ProbationaryEmployeeCreateRequest(BaseModel):
    """Onboarding payload: link an existing user or create a new account."""

    user_id: Optional[uuid.UUID] = None
    email: Optional[str] = Field(default=None, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=255)
    password: Optional[PasswordStr] = Field(default=None, min_length=8, max_length=128)

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
    target_score: float = Field(default=4.0, ge=4.0, le=5.0)
    weight: float = Field(default=0.20, ge=0.0, le=1.0)


class KpiRubricCreate(KpiRubricBase):
    pass


class KpiRubricUpdate(BaseModel):
    organization_id: Optional[str] = Field(default=None, max_length=100)
    competency: Optional[CompetencyEnum] = None
    target_score: Optional[float] = Field(default=None, ge=4.0, le=5.0)
    weight: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class KpiRubricUpsert(BaseModel):
    """Employer-configurable target and weight for a single competency."""

    target_score: float = Field(default=4.0, ge=4.0, le=5.0)
    weight: float = Field(default=0.20, ge=0.0, le=1.0)


class KpiRubricBulkItem(BaseModel):
    """One competency's target and weight within a bulk save."""

    competency: CompetencyEnum
    target_score: float = Field(..., ge=4.0, le=5.0)
    weight: float = Field(..., ge=0.0, le=1.0)


class KpiRubricBulkUpsert(BaseModel):
    """Atomic save of several competencies at once (one transaction)."""

    items: list[KpiRubricBulkItem] = Field(..., min_length=1)

    @field_validator("items")
    @classmethod
    def _unique_competencies(cls, value: list[KpiRubricBulkItem]) -> list[KpiRubricBulkItem]:
        seen = [item.competency for item in value]
        if len(set(seen)) != len(seen):
            raise ValueError("Duplicate competency in a bulk save")
        return value


class KpiRubricResponse(KpiRubricBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


# ---------------------------------------------------------------------------
# WeeklyEvaluation / Scorecard
# ---------------------------------------------------------------------------
class WeeklyRatingSubmit(BaseModel):
    """Evaluator payload for a weekly rating across the five competencies."""

    task_completion: float = Field(..., ge=1.0, le=5.0)
    attendance_and_punctuality: float = Field(..., ge=1.0, le=5.0)
    communication_and_teamwork: float = Field(..., ge=1.0, le=5.0)
    initiative_and_adaptability: float = Field(..., ge=1.0, le=5.0)
    quality_of_work: float = Field(..., ge=1.0, le=5.0)
    remarks: Optional[str] = Field(default=None, max_length=500)
    evaluation_date: Optional[date] = Field(default=None)


class WeeklyEvaluationResponse(BaseModel):
    """A persisted weekly evaluation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    evaluator_id: uuid.UUID
    organization_id: str
    evaluation_date: date
    week_number: Optional[int] = None
    task_completion: float
    attendance_and_punctuality: float
    communication_and_teamwork: float
    initiative_and_adaptability: float
    quality_of_work: float
    overall_score: float
    remarks: Optional[str] = None
    created_at: datetime


class WeeklyEvaluationListItem(BaseModel):
    """A weekly evaluation's behavioral remarks, for the record/history views."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    evaluation_date: date
    week_number: Optional[int] = None
    evaluator_name: str
    overall_score: float
    remarks: Optional[str] = None


class CompetencyScoreItem(BaseModel):
    """A single competency's current score relative to its target."""

    key: str
    label: str
    score: float
    target: float = 4.0
    gap: float


class EmployeeScorecardResponse(BaseModel):
    """Current competency standing for a probationary employee."""

    employee_id: uuid.UUID
    overall_score: float
    target_score: float = 4.0
    gap: float
    competencies: list[CompetencyScoreItem]
    latest_evaluation_date: Optional[date] = None


class RiskExplanationResponse(BaseModel):
    """ML classification result with feature importances for legal defensibility."""

    predicted_tier: str
    confidence: float
    probabilities: dict[str, float]
    feature_importances: dict[str, float]
    flagged_competencies: list[str]
    # Local (exact Shapley) + global (permutation) explainability. Additive fields;
    # see backend/ml/explain.py. shap_target_class is the tier being attributed.
    shap_values: dict[str, float] = {}
    shap_base_value: float = 0.0
    shap_target_class: str = ""
    # Meaning of a positive contribution: "risk" (toward a gap) or "safe".
    shap_risk_polarity: str = ""
    permutation_importances: dict[str, float] = {}
    explanation_method: str = ""


class RegularizationRecommendationResponse(BaseModel):
    """AI-assisted regularization decision support for the mid-5th month."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_id: uuid.UUID
    organization_id: str
    month_number: int
    status_classification: PerformanceRatingEnum
    overall_average: float
    recommendation: str
    rationale: Optional[str] = None
    created_at: datetime


class TrendPoint(BaseModel):
    """One monthly bucket of aggregated competency scores."""

    month_number: int
    period_start: date
    period_end: date
    overall_average: float
    task_completion: float
    attendance_and_punctuality: float
    communication_and_teamwork: float
    initiative_and_adaptability: float
    quality_of_work: float


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
    dispatched_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
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
    completed_at: Optional[datetime] = None


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


class TrainingPlanSignOff(BaseModel):
    """Employer decision payload for a pending training intervention."""

    approved: bool = True


# ---------------------------------------------------------------------------
# EvaluationAuditLog
# ---------------------------------------------------------------------------
class AuditLogItemResponse(BaseModel):
    """A single immutable competency audit entry for display."""

    id: uuid.UUID
    competency: str
    evaluator_name: str
    employee_name: Optional[str] = None
    prior_score: Optional[float] = None
    new_score: float
    created_at: datetime


class AuditChainVerificationResponse(BaseModel):
    """Result of verifying an employee's tamper-evident audit hash chain."""

    valid: bool
    checked: int
    first_broken_id: Optional[uuid.UUID] = None


class ReportResponse(BaseModel):
    """A persisted generated-report record (metadata only)."""

    id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: Optional[str] = None
    report_type: str
    title: str
    size_bytes: int
    generated_by_name: Optional[str] = None
    created_at: datetime


class ReportGenerateRequest(BaseModel):
    """Request to generate and record a performance report."""

    employee_id: uuid.UUID
    report_type: str = "performance"


class ActivityLogResponse(BaseModel):
    """A general system activity-log entry."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: str
    actor_id: Optional[uuid.UUID] = None
    actor_name: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    detail: Optional[str] = None
    created_at: datetime


class NotificationResponse(BaseModel):
    """An in-app notification."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    body: Optional[str] = None
    category: str
    is_read: bool
    created_at: datetime


__all__ = [
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "Token",
    "TokenPayload",
    "PasswordChange",
    "ProfileUpdate",
    "ForgotPasswordRequest",
    "ResetPasswordRequest",
    "ProbationaryEmployeeBase",
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
    "KpiRubricUpsert",
    "KpiRubricBulkItem",
    "KpiRubricBulkUpsert",
    "WeeklyRatingSubmit",
    "WeeklyEvaluationResponse",
    "WeeklyEvaluationListItem",
    "CompetencyScoreItem",
    "EmployeeScorecardResponse",
    "RiskExplanationResponse",
    "RegularizationRecommendationResponse",
    "TrendPoint",
    "MonthlySummaryBase",
    "MonthlySummaryCreate",
    "MonthlySummaryUpdate",
    "MonthlySummaryResponse",
    "TrainingPlanBase",
    "TrainingPlanCreate",
    "TrainingPlanUpdate",
    "TrainingPlanResponse",
    "TrainingPlanSignOff",
    "AuditLogItemResponse",
    "AuditChainVerificationResponse",
    "ActivityLogResponse",
    "NotificationResponse",
]
