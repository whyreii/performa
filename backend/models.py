"""SQLAlchemy 2.0 ORM models for Performa.

All models are consolidated here using modern ``Mapped[...]`` /
``mapped_column(...)`` typing. Every tenant-scoped table carries an indexed
``organization_id`` to support the multi-tenant architecture described in
ARCHITECTURE.md.

The five competency categories map to ``CompetencyEnum`` and the statutory
180-day probation timeline (Philippine Labor Code Article 296) is represented
on ``ProbationaryEmployee`` via ``start_date``, ``day_180_date``, and the
Day 150 / 165 / 178 milestone flags.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class UserRole(enum.Enum):
    """The four distinct roles enforced by JWT bearer authentication."""

    ADMIN = "admin"
    EMPLOYER = "employer"
    SUPERVISOR = "supervisor"
    PROBATIONARY_EMPLOYEE = "probationary_employee"


class ProbationStatus(enum.Enum):
    """Lifecycle status of a probationary employee."""

    ACTIVE = "active"
    REGULARIZED = "regularized"
    TERMINATED = "terminated"


class CompetencyEnum(enum.Enum):
    """The five competency categories permitted by Article 296."""

    TASK_COMPLETION = "task_completion"
    ATTENDANCE_AND_PUNCTUALITY = "attendance_and_punctuality"
    COMMUNICATION_AND_TEAMWORK = "communication_and_teamwork"
    INITIATIVE_AND_ADAPTABILITY = "initiative_and_adaptability"
    QUALITY_OF_WORK = "quality_of_work"


class PerformanceRatingEnum(enum.Enum):
    """Random Forest competency classifications produced by the ML pipeline."""

    MEETS_EXPECTATIONS = "Meets Expectations"
    NEEDS_IMPROVEMENT = "Needs Improvement"
    CRITICAL_GAP = "Critical Gap"


class TrainingStatusEnum(enum.Enum):
    """Human-in-the-loop approval state for training interventions."""

    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"


def _enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    """Persist the string *values* of an enum rather than its member names."""
    return [member.value for member in enum_cls]


def _utcnow() -> datetime:
    """Timezone-aware UTC timestamp with microsecond precision.

    Paired with ``server_default=func.now()`` so newest-first ordering remains
    deterministic on databases whose native ``CURRENT_TIMESTAMP`` is
    second-granular (e.g. SQLite).
    """
    return datetime.now(timezone.utc)


class Organization(Base):
    """A tenant. ``slug`` is the value stored as ``organization_id``."""

    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class User(Base):
    """A platform account occupying one of the four roles."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", values_callable=_enum_values),
        nullable=False,
    )
    organization_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("organizations.slug"), index=True, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    probationary_profile: Mapped[Optional["ProbationaryEmployee"]] = relationship(
        "ProbationaryEmployee",
        back_populates="user",
        foreign_keys="ProbationaryEmployee.user_id",
        uselist=False,
        cascade="all, delete-orphan",
    )
    employer_profiles: Mapped[list["ProbationaryEmployee"]] = relationship(
        "ProbationaryEmployee",
        back_populates="employer",
        foreign_keys="ProbationaryEmployee.employer_id",
    )
    supervised_profiles: Mapped[list["ProbationaryEmployee"]] = relationship(
        "ProbationaryEmployee",
        back_populates="supervisor",
        foreign_keys="ProbationaryEmployee.supervisor_id",
    )
    weekly_evaluations: Mapped[list["WeeklyEvaluation"]] = relationship(
        "WeeklyEvaluation",
        back_populates="evaluator",
        foreign_keys="WeeklyEvaluation.evaluator_id",
    )
    evaluation_audit_logs: Mapped[list["EvaluationAuditLog"]] = relationship(
        "EvaluationAuditLog",
        back_populates="evaluator",
        foreign_keys="EvaluationAuditLog.evaluator_id",
    )


class ProbationaryEmployee(Base):
    """An employee profile tracking the strict 180-day probation timeline."""

    __tablename__ = "probationary_employees"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), unique=True, nullable=False
    )
    employer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    supervisor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )
    organization_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    job_title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    day_180_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[ProbationStatus] = mapped_column(
        SAEnum(ProbationStatus, name="probation_status", values_callable=_enum_values),
        default=ProbationStatus.ACTIVE,
        nullable=False,
    )
    milestone_150_alerted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    milestone_165_alerted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    milestone_178_alerted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    standards_acknowledged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(
        "User", back_populates="probationary_profile", foreign_keys=[user_id]
    )
    employer: Mapped["User"] = relationship(
        "User", back_populates="employer_profiles", foreign_keys=[employer_id]
    )
    supervisor: Mapped[Optional["User"]] = relationship(
        "User", back_populates="supervised_profiles", foreign_keys=[supervisor_id]
    )
    weekly_evaluations: Mapped[list["WeeklyEvaluation"]] = relationship(
        "WeeklyEvaluation",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    monthly_summaries: Mapped[list["MonthlySummary"]] = relationship(
        "MonthlySummary",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    training_plans: Mapped[list["TrainingPlan"]] = relationship(
        "TrainingPlan",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    evaluation_audit_logs: Mapped[list["EvaluationAuditLog"]] = relationship(
        "EvaluationAuditLog",
        back_populates="employee",
        cascade="all, delete-orphan",
    )
    regularization_recommendations: Mapped[list["RegularizationRecommendation"]] = relationship(
        "RegularizationRecommendation",
        back_populates="employee",
        cascade="all, delete-orphan",
    )


class KpiRubric(Base):
    """Organization-scoped weighting and targets for each competency."""

    __tablename__ = "kpi_rubrics"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    competency: Mapped[CompetencyEnum] = mapped_column(
        SAEnum(CompetencyEnum, name="competency_enum", values_callable=_enum_values),
        nullable=False,
    )
    target_score: Mapped[float] = mapped_column(Float, default=3.0, nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=0.20, nullable=False)


class WeeklyEvaluation(Base):
    """A weekly rating of an employee across the five fixed competencies."""

    __tablename__ = "weekly_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("probationary_employees.id"), nullable=False, index=True
    )
    evaluator_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    organization_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    evaluation_date: Mapped[date] = mapped_column(
        Date, default=date.today, nullable=False, index=True
    )
    week_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    task_completion: Mapped[float] = mapped_column(Float, nullable=False)
    attendance_and_punctuality: Mapped[float] = mapped_column(Float, nullable=False)
    communication_and_teamwork: Mapped[float] = mapped_column(Float, nullable=False)
    initiative_and_adaptability: Mapped[float] = mapped_column(Float, nullable=False)
    quality_of_work: Mapped[float] = mapped_column(Float, nullable=False)
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        server_default=func.now(),
        nullable=False,
    )

    employee: Mapped["ProbationaryEmployee"] = relationship(
        "ProbationaryEmployee", back_populates="weekly_evaluations"
    )
    evaluator: Mapped["User"] = relationship(
        "User", back_populates="weekly_evaluations", foreign_keys=[evaluator_id]
    )


class MonthlySummary(Base):
    """Monthly roll-up of weekly scores plus the ML classification."""

    __tablename__ = "monthly_summaries"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("probationary_employees.id"), nullable=False
    )
    month_number: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_task_completion: Mapped[float] = mapped_column(Float, nullable=False)
    avg_attendance: Mapped[float] = mapped_column(Float, nullable=False)
    avg_communication: Mapped[float] = mapped_column(Float, nullable=False)
    avg_initiative: Mapped[float] = mapped_column(Float, nullable=False)
    avg_quality: Mapped[float] = mapped_column(Float, nullable=False)
    overall_average: Mapped[float] = mapped_column(Float, nullable=False)
    status_classification: Mapped[PerformanceRatingEnum] = mapped_column(
        SAEnum(
            PerformanceRatingEnum,
            name="performance_rating_enum",
            values_callable=_enum_values,
        ),
        nullable=False,
    )
    performance_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dispatched_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    employee: Mapped["ProbationaryEmployee"] = relationship(
        "ProbationaryEmployee", back_populates="monthly_summaries"
    )
    training_plans: Mapped[list["TrainingPlan"]] = relationship(
        "TrainingPlan", back_populates="monthly_summary"
    )


class TrainingPlan(Base):
    """A catalog intervention pending employer sign-off."""

    __tablename__ = "training_plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("probationary_employees.id"), nullable=False, index=True
    )
    monthly_summary_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("monthly_summaries.id"), nullable=True
    )
    competency: Mapped[str] = mapped_column(String(100), nullable=False)
    catalog_id: Mapped[str] = mapped_column(String(100), nullable=False)
    intervention_title: Mapped[str] = mapped_column(String(255), nullable=False)
    intervention_type: Mapped[str] = mapped_column(String(100), nullable=False)
    default_timeline: Mapped[str] = mapped_column(String(100), nullable=False)
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[TrainingStatusEnum] = mapped_column(
        SAEnum(TrainingStatusEnum, name="training_status_enum", values_callable=_enum_values),
        default=TrainingStatusEnum.PENDING_APPROVAL,
        nullable=False,
        index=True,
    )
    employer_approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    employee: Mapped["ProbationaryEmployee"] = relationship(
        "ProbationaryEmployee", back_populates="training_plans"
    )
    monthly_summary: Mapped[Optional["MonthlySummary"]] = relationship(
        "MonthlySummary", back_populates="training_plans"
    )


class RegularizationRecommendation(Base):
    """AI-assisted regularization decision support at the mid-5th month."""

    __tablename__ = "regularization_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("probationary_employees.id"), nullable=False, index=True
    )
    organization_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    month_number: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    status_classification: Mapped[PerformanceRatingEnum] = mapped_column(
        SAEnum(
            PerformanceRatingEnum,
            name="performance_rating_enum",
            values_callable=_enum_values,
        ),
        nullable=False,
    )
    overall_average: Mapped[float] = mapped_column(Float, nullable=False)
    recommendation: Mapped[str] = mapped_column(String(50), nullable=False)
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        server_default=func.now(),
        nullable=False,
    )

    employee: Mapped["ProbationaryEmployee"] = relationship(
        "ProbationaryEmployee", back_populates="regularization_recommendations"
    )


class EvaluationAuditLog(Base):
    """Append-only audit record for a competency score change."""

    __tablename__ = "evaluation_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("probationary_employees.id"), nullable=False, index=True
    )
    evaluator_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    organization_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    competency: Mapped[str] = mapped_column(String(100), nullable=False)
    prior_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    new_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    employee: Mapped["ProbationaryEmployee"] = relationship(
        "ProbationaryEmployee", back_populates="evaluation_audit_logs"
    )
    evaluator: Mapped["User"] = relationship(
        "User", back_populates="evaluation_audit_logs", foreign_keys=[evaluator_id]
    )


__all__ = [
    "UserRole",
    "ProbationStatus",
    "CompetencyEnum",
    "PerformanceRatingEnum",
    "TrainingStatusEnum",
    "Organization",
    "User",
    "ProbationaryEmployee",
    "KpiRubric",
    "WeeklyEvaluation",
    "MonthlySummary",
    "TrainingPlan",
    "EvaluationAuditLog",
    "RegularizationRecommendation",
]
