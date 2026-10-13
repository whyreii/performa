"""Deterministic, tamper-evident hash chain for the Evidentiary Labor Score Audit
Trail.

Each audit row hashes its predecessor's hash together with the row's immutable
fields, so editing any past row breaks every later hash. The chain is verified by
recomputing it in ``created_at`` order (``routers/evaluations.py``). Shared by the
live write path and the seed so demo data is verifiable too.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional


def hash_timestamp(value: datetime) -> str:
    """tz-stable ISO form: SQLite drops tzinfo, so normalize everything to UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def audit_record_hash(
    prev_hash: Optional[str],
    organization_id: str,
    employee_id: uuid.UUID,
    evaluator_id: uuid.UUID,
    competency: str,
    prior_score: Optional[float],
    new_score: float,
    created_at: datetime,
) -> str:
    """Deterministic hash of an audit row, chained to its predecessor."""
    payload = "|".join(
        [
            prev_hash or "",
            organization_id,
            str(employee_id),
            str(evaluator_id),
            competency,
            "" if prior_score is None else f"{float(prior_score):.4f}",
            f"{float(new_score):.4f}",
            hash_timestamp(created_at),
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


__all__ = ["audit_record_hash", "hash_timestamp"]
