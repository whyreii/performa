"""Guardrail: Manila (Asia/Manila) time handling and milestone-day properties.

§6a-1 is RESOLVED: start date is Day 0; Day 150/165/178 = start + 150/165/178.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from backend.tests.helpers import EMPLOYER_EMAIL, login_user
from backend.timeutils import MANILA_TZ, manila_today


def test_late_utc_resolves_to_next_manila_date():
    # 22:00 UTC is 06:00 the NEXT day in Asia/Manila (UTC+8).
    utc_late = datetime(2026, 1, 1, 22, 0, tzinfo=timezone.utc)
    assert utc_late.astimezone(MANILA_TZ).date() == date(2026, 1, 2)


def test_manila_offset_is_utc_plus_8():
    utc = datetime(2026, 6, 1, 0, 0, tzinfo=timezone.utc)
    assert utc.astimezone(MANILA_TZ).utcoffset() == timedelta(hours=8)


def test_manila_today_returns_a_date():
    assert isinstance(manila_today(), date)


@pytest.mark.asyncio
async def test_milestone_boundaries_use_day_zero_convention(client, monkeypatch):
    employer = await login_user(client, EMPLOYER_EMAIL)
    employees = (await client.get("/api/employees/", headers=employer)).json()
    carlos = next(e for e in employees if e["user"]["full_name"] == "Carlos Early")
    start = date.fromisoformat(carlos["start_date"])

    boundaries = {
        149: (False, False, False),
        150: (True, False, False),
        164: (True, False, False),
        165: (True, True, False),
        177: (True, True, False),
        178: (True, True, True),
    }
    for day, (r150, r165, r178) in boundaries.items():
        monkeypatch.setenv("PERFORMA_TODAY", (start + timedelta(days=day)).isoformat())
        report = (await client.get("/api/employees/milestones", headers=employer)).json()
        items = report["day_150"] + report["day_165"] + report["day_178"]
        item = next(i for i in items if i["employee"]["id"] == carlos["id"])
        assert item["days_elapsed"] == day
        assert item["day_150_reached"] is r150
        assert item["day_165_reached"] is r165
        assert item["day_178_reached"] is r178


@pytest.mark.asyncio
async def test_milestone_dates_have_fixed_spacing_and_cap(client, monkeypatch):
    employer = await login_user(client, EMPLOYER_EMAIL)
    employees = (await client.get("/api/employees/", headers=employer)).json()
    carlos = next(e for e in employees if e["user"]["full_name"] == "Carlos Early")
    start = date.fromisoformat(carlos["start_date"])

    monkeypatch.setenv("PERFORMA_TODAY", (start + timedelta(days=150)).isoformat())
    report = (await client.get("/api/employees/milestones", headers=employer)).json()
    item = next(i for i in report["day_150"] if i["employee"]["id"] == carlos["id"])

    d150 = date.fromisoformat(item["day_150_date"])
    d165 = date.fromisoformat(item["day_165_date"])
    d178 = date.fromisoformat(item["day_178_date"])
    cap = date.fromisoformat(item["employee"]["day_180_date"])
    assert (d165 - d150).days == 15
    assert (d178 - d165).days == 13
    assert (cap - d178).days == 2
    assert (cap - start).days == 180


@pytest.mark.xfail(
    strict=True,
    reason="FINDING: milestone alerts are not wired — milestone_150/165/178_alerted "
    "are never written and no notification fires at 150/165/178 (only a read-only report exists)",
)
def test_milestone_alerts_fire_once_in_order():
    import backend.routers.employees as emp

    assert hasattr(emp, "_fire_milestone_alerts"), "no milestone alert-firing function exists"
