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
    event,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    true,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .audit_immutability import create_audit_triggers
from .database import Base
from .timeutils import manila_today


class UserRole(enum.Enum):
    """The four distinct roles enforced by JWT bearer authentication."""

    ADMIN = "admin"
    EMPLOYER = "employer"
    SUPERVISOR = "supervisor"
    PROBATIONARY_EMPLOYEE = "probationary_employee"


class ProbationStatus(enum.Enum):
    """Lifecycle status of a probationary employee."""

    # PENDING: the account exists (often created by an Admin) but the Employer
    # has not yet assigned it a start date and supervisor, so the 180-day clock
    # has not started.
    PENDING = "pending"
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
    COMPLETED = "completed"


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
    # When the account holder accepted the Data Privacy (RA 10173) notice.
    privacy_consented_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Self-registered accounts start unverified; seeded/provisioned ones are True.
    email_verified: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
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
    # Nullable until the Employer assigns a start date; a PENDING record has none.
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    day_180_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
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
    __table_args__ = (
        UniqueConstraint(
            "organization_id", "competency", name="uq_kpi_rubric_org_competency"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    competency: Mapped[CompetencyEnum] = mapped_column(
        SAEnum(CompetencyEnum, name="competency_enum", values_callable=_enum_values),
        nullable=False,
    )
    target_score: Mapped[float] = mapped_column(Float, default=4.0, nullable=False)
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
        Date, default=manila_today, nullable=False, index=True
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
    custom_kpi_ratings: Mapped[list["CustomKpiRating"]] = relationship(
        "CustomKpiRating", back_populates="weekly_evaluation", cascade="all, delete-orphan"
    )


class MonthlySummary(Base):
    """Monthly roll-up of weekly scores plus the ML classification."""

    __tablename__ = "monthly_summaries"
    __table_args__ = (
        UniqueConstraint(
            "employee_id", "month_number", name="uq_monthly_summary_employee_month"
        ),
    )

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
    # Set only when this plan was raised by an employer-defined custom KPI (a
    # non-statutory signal); null for the five-competency catalog mapping.
    custom_kpi_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
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
    # Per-cycle approval record: who approved, and the exact rationale text that
    # was on screen at that moment (frozen so a later regeneration cannot change
    # what was approved).
    employer_approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )
    approved_rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(
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


class CustomKpi(Base):
    """An employer-defined KPI that sits OUTSIDE the five statutory competencies.

    Purely supplementary (ARCHITECTURE.md §2): it never enters the 4.0
    regularizing standard, the ML feature vector, the competency audit chain, or
    the ``CompetencyEnum``. ``mapped_catalog_id`` optionally links it to a
    catalog course so a sub-3.0 monthly average can raise a deterministic,
    employer-approved intervention that Gemini then explains (never selects).
    """

    __tablename__ = "custom_kpis"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_custom_kpi_org_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    mapped_catalog_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now(), nullable=False
    )

    ratings: Mapped[list["CustomKpiRating"]] = relationship(
        "CustomKpiRating", back_populates="custom_kpi", cascade="all, delete-orphan"
    )


class CustomKpiRating(Base):
    """A weekly score for an employer-defined custom KPI.

    Stored apart from the five statutory competency columns so it can never
    change ``WeeklyEvaluation.overall_score`` or the tamper-evident competency
    audit chain.
    """

    __tablename__ = "custom_kpi_ratings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    weekly_evaluation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("weekly_evaluations.id"), nullable=False, index=True
    )
    custom_kpi_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("custom_kpis.id"), nullable=False, index=True
    )
    organization_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)

    custom_kpi: Mapped["CustomKpi"] = relationship("CustomKpi", back_populates="ratings")
    weekly_evaluation: Mapped["WeeklyEvaluation"] = relationship(
        "WeeklyEvaluation", back_populates="custom_kpi_ratings"
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
    # Tamper-evident chain: ``record_hash`` = sha256(row fields + ``prev_hash``),
    # where ``prev_hash`` is the previous row's ``record_hash`` for the same
    # employee. Nullable for rows written before the chain was introduced.
    prev_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    record_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
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


class ActivityLog(Base):
    """General system activity log for oversight and compliance."""

    __tablename__ = "activity_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )
    actor_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        server_default=func.now(),
        nullable=False,
        index=True,
    )


class Notification(Base):
    """An in-app notification for a single user."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False, index=True
    )
    organization_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="general", nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        server_default=func.now(),
        nullable=False,
        index=True,
    )


# Enforce append-only immutability for the Evidentiary Labor Score Audit Trail at
# the database level whenever the table is created (dev/tests via create_all;
# Alembic revision 0003_immutable_audit covers pre-existing databases).
event.listen(EvaluationAuditLog.__table__, "after_create", create_audit_triggers)


class Report(Base):
    """A persisted record of a generated performance report (metadata only).

    The manuscript's "generated reports list" (title / date / size). The report
    body itself is regenerated on demand from current data, so only the metadata
    is stored here.
    """

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("probationary_employees.id"), nullable=False, index=True
    )
    generated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True
    )
    report_type: Mapped[str] = mapped_column(String(50), default="performance", nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    employee: Mapped["ProbationaryEmployee"] = relationship("ProbationaryEmployee")
    generated_by: Mapped[Optional["User"]] = relationship("User")


class PasswordResetToken(Base):
    """Single-use, expiring password-reset token (stored hashed) for self-service reset."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now(), nullable=False
    )


class EmailVerificationToken(Base):
    """Single-use, expiring email-verification token (stored hashed)."""

    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now(), nullable=False
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
    "ActivityLog",
    "Notification",
    "Report",
    "PasswordResetToken",
    "EmailVerificationToken",
]
