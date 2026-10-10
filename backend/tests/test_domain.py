"""Day-math boundaries for the Article 296 timeline (backend/domain.py)."""
from __future__ import annotations

from datetime import date, timedelta

import pytest

from backend.domain import (
    day_180_date,
    days_elapsed,
    milestone_dates,
    month_number_for,
    month_window,
)

START = date(2026, 1, 1)


def test_day_count_start_is_zero():
    assert days_elapsed(START, START) == 0


def test_day_180_is_the_cap_and_a_valid_day():
    assert day_180_date(START) == START + timedelta(days=180)


@pytest.mark.parametrize("day,key", [(150, "day_150"), (165, "day_165"), (178, "day_178")])
def test_milestone_dates(day, key):
    assert milestone_dates(START)[key] == START + timedelta(days=day)


@pytest.mark.parametrize("month", range(1, 7))
def test_month_windows_are_non_overlapping(month):
    start, end = month_window(START, month)
    next_start, _ = month_window(START, month + 1)
    assert start <= end
    assert end + timedelta(days=1) == next_start


@pytest.mark.parametrize(
    "offset,expected",
    [(0, 1), (29, 1), (30, 2), (59, 2), (60, 3), (149, 5), (150, 6)],
)
def test_month_number_for(offset, expected):
    assert month_number_for(START, START + timedelta(days=offset)) == expected
