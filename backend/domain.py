"""Statutory domain constants and day math for Article 296 of the Labor Code.

Single source of truth for the values fixed in ``ARCHITECTURE.md`` §2/§6a: the
180-day probation term, the Day 150 / 165 / 178 milestones, the 30-day probation
month, and the 4.0 regularizing standard. Routers and the timeline helpers import
from here; they must not re-declare these as literals or re-implement the day
arithmetic (enforced by ``tests/guardrails/test_no_magic_numbers.py``).
"""
from __future__ import annotations

from datetime import date, timedelta

PROBATION_TERM_DAYS = 180
MILESTONE_REVIEW_DAY = 150
MILESTONE_NOTICE_DAY = 165
MILESTONE_CRITICAL_DAY = 178
MILESTONE_DAYS: tuple[int, int, int] = (
    MILESTONE_REVIEW_DAY,
    MILESTONE_NOTICE_DAY,
    MILESTONE_CRITICAL_DAY,
)
REGULARIZATION_HORIZON_DAYS = MILESTONE_REVIEW_DAY
PROBATION_MONTH_DAYS = 30
TARGET_SCORE = 4.0
# Ceiling on the employer-defined KPIs assigned to one probationary employee.
# The custom layer must stay visibly subordinate to the five statutory
# competencies, so its cap is below the statutory count.
CUSTOM_KPIS_PER_EMPLOYEE = 5


def days_elapsed(start_date: date, as_of: date) -> int:
    """Article 296 day count: the start date is Day 0."""
    return (as_of - start_date).days


def day_180_date(start_date: date) -> date:
    """The statutory cap date (still a valid probation day)."""
    return start_date + timedelta(days=PROBATION_TERM_DAYS)


def milestone_dates(start_date: date) -> dict[str, date]:
    """Return the Day 150 / 165 / 178 milestone dates for an employee."""
    return {
        "day_150": start_date + timedelta(days=MILESTONE_REVIEW_DAY),
        "day_165": start_date + timedelta(days=MILESTONE_NOTICE_DAY),
        "day_178": start_date + timedelta(days=MILESTONE_CRITICAL_DAY),
    }


def month_window(start_date: date, month_number: int) -> tuple[date, date]:
    """The non-overlapping 30-day window ``[start, end]`` for a probation month."""
    start = start_date + timedelta(days=(month_number - 1) * PROBATION_MONTH_DAYS)
    end = start_date + timedelta(days=month_number * PROBATION_MONTH_DAYS - 1)
    return start, end


def month_number_for(start_date: date, evaluation_date: date) -> int:
    """The 1-based probation month that ``evaluation_date`` falls into."""
    return max(1, (evaluation_date - start_date).days // PROBATION_MONTH_DAYS + 1)


__all__ = [
    "PROBATION_TERM_DAYS",
    "MILESTONE_REVIEW_DAY",
    "MILESTONE_NOTICE_DAY",
    "MILESTONE_CRITICAL_DAY",
    "MILESTONE_DAYS",
    "REGULARIZATION_HORIZON_DAYS",
    "PROBATION_MONTH_DAYS",
    "TARGET_SCORE",
    "CUSTOM_KPIS_PER_EMPLOYEE",
    "days_elapsed",
    "day_180_date",
    "milestone_dates",
    "month_window",
    "month_number_for",
]
