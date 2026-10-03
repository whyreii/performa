"""Timezone helpers for the statutory Asia/Manila (Article 296) timeline."""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone, tzinfo

logger = logging.getLogger(__name__)


def manila_tz() -> tzinfo:
    """Return the Asia/Manila timezone, falling back to a fixed UTC+8 offset."""
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo("Asia/Manila")
    except Exception:
        return timezone(timedelta(hours=8))


MANILA_TZ = manila_tz()


def manila_today() -> date:
    """Current calendar date in the statutory (Asia/Manila) timezone.

    Honors the ``PERFORMA_TODAY`` environment override (``YYYY-MM-DD``) so the
    statutory timeline can be simulated deterministically in development and
    tests (e.g. ``PERFORMA_TODAY=2026-06-15``). Falls back to the real Manila
    date when unset or when the value is not a valid ISO date.
    """
    override = os.getenv("PERFORMA_TODAY")
    if override:
        try:
            return date.fromisoformat(override.strip())
        except ValueError:
            logger.warning(
                "Ignoring invalid PERFORMA_TODAY=%r (expected YYYY-MM-DD); using real date.",
                override,
            )
    return datetime.now(MANILA_TZ).date()


__all__ = ["MANILA_TZ", "manila_tz", "manila_today"]
