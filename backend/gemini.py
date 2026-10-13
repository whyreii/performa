"""Google Gemini integration for performance summaries and intervention rationales.

Generates exactly two AI artifacts, per ARCHITECTURE.md:

* a two-sentence monthly performance summary, and
* a one-sentence rationale per recommended catalog intervention.

The integration is deliberately resilient: a missing API key, a timeout, or
any API/SDK error degrades to an empty-rationale fallback so the pipeline still
persists catalog interventions.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Optional

from .config import get_settings

try:  # The SDK is optional at import time so the API can still boot without it.
    from google import genai
    from google.genai import types
except ImportError:  # pragma: no cover - exercised only when the SDK is absent
    genai = None  # type: ignore[assignment]
    types = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PRIMARY_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODEL = "gemini-flash-latest"
TEMPERATURE = 0.0
# Per-attempt budget. Gemini's own server deadline can exceed 10s (a 504
# DEADLINE_EXCEEDED lands around ~13s), so a single short budget cancelled the
# primary before it could answer and never let the fallback run. Each model now
# gets its own budget.
PER_ATTEMPT_TIMEOUT_SECONDS = 25.0

FALLBACK_SUMMARY = "Performance summary unavailable."

_client: Any = None
_client_key: Optional[str] = None


def _get_client() -> Any:
    """Lazily construct the Gemini client, or ``None`` if unavailable.

    The API key is read at call time (not import time) so runtime configuration
    changes are honoured.
    """
    global _client, _client_key
    if genai is None:
        logger.warning("google-genai SDK is not installed; returning fallback rationales.")
        return None
    api_key = os.getenv("GEMINI_API_KEY") or get_settings().gemini_api_key
    if not api_key:
        logger.warning("GEMINI_API_KEY is not configured; returning fallback rationales.")
        return None
    if _client is None or _client_key != api_key:
        _client = genai.Client(api_key=api_key)
        _client_key = api_key
    return _client


def _course_id(course: dict[str, Any]) -> str:
    """Resolve the catalog identifier across supported catalog schemas."""
    return str(course.get("catalog_id") or course.get("course_id") or "")


def _course_title(course: dict[str, Any]) -> str:
    return str(course.get("intervention_title") or course.get("title") or "")


def _build_prompt(
    employee_name: str,
    month_number: int,
    status_classification: str,
    competency_scores: dict[str, float],
    recommended_courses: list[dict[str, Any]],
) -> str:
    scores_text = "\n".join(
        f"- {name}: {float(value):.2f}/5.0" for name, value in competency_scores.items()
    )
    course_lines = [
        (
            f"- catalog_id={_course_id(course)}; competency={course.get('competency')}; "
            f"title={_course_title(course)}; description={course.get('description', '')}"
        )
        for course in recommended_courses
    ]
    courses_text = "\n".join(course_lines) if course_lines else "- (none)"

    return (
        "You are an HR performance assistant for a Philippine SME operating under "
        "Article 296 probation rules.\n"
        f"Employee: {employee_name}\n"
        f"Month: {month_number}\n"
        f"Overall classification: {status_classification}\n"
        "Competency averages (1.0-5.0):\n"
        f"{scores_text}\n\n"
        "Recommended catalog interventions:\n"
        f"{courses_text}\n\n"
        "Respond with ONLY compact JSON in exactly this shape:\n"
        '{"summary": "<exactly two sentences>", '
        '"rationales": {"<catalog_id>": "<exactly one sentence>"}}\n'
        "The summary must be exactly two sentences describing the employee's monthly results. "
        "Provide exactly one rationale sentence for every catalog_id listed above, explaining "
        "why that course helps the employee's specific gap."
    )


def _config() -> Any:
    return types.GenerateContentConfig(
        temperature=TEMPERATURE,
        response_mime_type="application/json",
    )


async def _call_model(client: Any, model: str, prompt: str) -> str:
    """Call one model under its own timeout and return the trimmed text."""
    response = await asyncio.wait_for(
        client.aio.models.generate_content(model=model, contents=prompt, config=_config()),
        timeout=PER_ATTEMPT_TIMEOUT_SECONDS,
    )
    return (response.text or "").strip()


async def _request_text(client: Any, prompt: str) -> str:
    """Try the primary model, then the fallback once on any failure or timeout.

    Each attempt gets its own budget, so a slow/hung primary cannot starve the
    fallback (the old single 10s budget did exactly that). Raises only when both
    models fail, so the caller degrades to empty rationales.
    """
    for model in (PRIMARY_MODEL, FALLBACK_MODEL):
        try:
            return await _call_model(client, model, prompt)
        except asyncio.TimeoutError:
            logger.warning(
                "Model %s timed out after %.1fs; trying the next model.",
                model,
                PER_ATTEMPT_TIMEOUT_SECONDS,
            )
        except Exception:
            logger.warning("Model %s failed; trying the next model.", model, exc_info=True)
    raise RuntimeError("Both Gemini models failed")


def _parse_response(
    text: str,
    recommended_courses: list[dict[str, Any]],
) -> tuple[str, dict[str, str]]:
    """Parse the model's JSON into a summary and per-catalog rationales."""
    course_ids = [_course_id(course) for course in recommended_courses]

    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Gemini returned non-JSON output; using it as a fallback summary.")
        summary = text.strip() or FALLBACK_SUMMARY
        return summary, {course_id: "" for course_id in course_ids}

    if not isinstance(payload, dict):
        return FALLBACK_SUMMARY, {course_id: "" for course_id in course_ids}

    summary = str(payload.get("summary") or "").strip() or FALLBACK_SUMMARY

    raw_rationales = payload.get("rationales")
    if not isinstance(raw_rationales, dict):
        raw_rationales = {}

    rationales = {
        course_id: str(raw_rationales.get(course_id) or "").strip()
        for course_id in course_ids
    }
    return summary, rationales


async def generate_performance_rationales(
    employee_name: str,
    month_number: int,
    status_classification: str,
    competency_scores: dict[str, float],
    recommended_courses: list[dict[str, Any]],
) -> tuple[str, dict[str, str]]:
    """Generate a monthly summary and one rationale per recommended course.

    Returns:
        A tuple of the summary text and a mapping of ``catalog_id`` to
        rationale. On any failure the summary is
        ``"Performance summary unavailable."`` and every rationale is an empty
        string, so the caller can still persist catalog interventions.
    """
    fallback: tuple[str, dict[str, str]] = (
        FALLBACK_SUMMARY,
        {_course_id(course): "" for course in recommended_courses},
    )

    client = _get_client()
    if client is None:
        return fallback

    prompt = _build_prompt(
        employee_name,
        month_number,
        status_classification,
        competency_scores,
        recommended_courses,
    )

    try:
        text = await _request_text(client, prompt)
    except Exception:
        logger.warning("Gemini request failed; using the empty-rationale fallback.", exc_info=True)
        return fallback

    if not text:
        logger.warning("Gemini returned an empty response; using fallback.")
        return fallback

    return _parse_response(text, recommended_courses)


__all__ = [
    "GEMINI_API_KEY",
    "PRIMARY_MODEL",
    "FALLBACK_MODEL",
    "TEMPERATURE",
    "PER_ATTEMPT_TIMEOUT_SECONDS",
    "FALLBACK_SUMMARY",
    "generate_performance_rationales",
]
