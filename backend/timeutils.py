"""Timezone helpers for the statutory Asia/Manila (Article 296) timeline."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone, tzinfo


def manila_tz() -> tzinfo:
    """Return the Asia/Manila timezone, falling back to a fixed UTC+8 offset."""
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo("Asia/Manila")
    except Exception:
        return timezone(timedelta(hours=8))


MANILA_TZ = manila_tz()


def manila_today() -> date:
    """Current calendar date in the statutory (Asia/Manila) timezone."""
    return datetime.now(MANILA_TZ).date()


__all__ = ["MANILA_TZ", "manila_tz", "manila_today"]
