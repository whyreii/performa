"""Gemini integration unit tests (no network).

Cover the parse/fallback behaviour and, specifically, that a failing or slow
*primary* model still lets the *fallback* model be tried — the bug that silently
produced empty rationales.
"""
from __future__ import annotations

import asyncio

import pytest

from backend import gemini


def test_parse_response_maps_rationales_by_catalog_id():
    text = '{"summary": "A. B.", "rationales": {"TC-101": "Because.", "ZZ-9": "x"}}'
    courses = [{"catalog_id": "TC-101"}, {"catalog_id": "TC-102"}]
    summary, rationales = gemini._parse_response(text, courses)
    assert summary == "A. B."
    # Only the requested catalog ids are kept; a missing one is empty.
    assert rationales == {"TC-101": "Because.", "TC-102": ""}


def test_parse_response_non_json_uses_raw_text_as_summary():
    summary, rationales = gemini._parse_response(
        "Plain sentence.", [{"catalog_id": "TC-101"}]
    )
    assert summary == "Plain sentence."
    assert rationales == {"TC-101": ""}


def test_parse_response_empty_text_uses_fallback_summary():
    summary, rationales = gemini._parse_response("", [{"catalog_id": "TC-101"}])
    assert summary == gemini.FALLBACK_SUMMARY
    assert rationales == {"TC-101": ""}


def test_is_transient_classifies_statuses():
    assert gemini._is_transient(asyncio.TimeoutError())
    assert gemini._is_transient(RuntimeError("503 UNAVAILABLE"))
    assert gemini._is_transient(RuntimeError("429 rate limited"))
    assert not gemini._is_transient(RuntimeError("404 NOT_FOUND"))
    assert not gemini._is_transient(RuntimeError("401 unauthorized"))
    assert not gemini._is_transient(RuntimeError("boom"))


@pytest.mark.asyncio
async def test_request_text_falls_back_on_permanent_primary_error(monkeypatch):
    calls = []

    async def fake(client, model, prompt, timeout):
        calls.append(model)
        if model == gemini.PRIMARY_MODEL:
            raise RuntimeError("404 NOT_FOUND")  # permanent -> no retry
        return "ok"

    monkeypatch.setattr(gemini, "_call_model", fake)
    assert await gemini._request_text(object(), "prompt") == "ok"
    assert calls == [gemini.PRIMARY_MODEL, gemini.FALLBACK_MODEL]


@pytest.mark.asyncio
async def test_request_text_retries_transient_then_falls_back(monkeypatch):
    monkeypatch.setattr(gemini, "RETRY_BACKOFF_SECONDS", 0.0)
    calls = []

    async def fake(client, model, prompt, timeout):
        calls.append(model)
        if model == gemini.PRIMARY_MODEL:
            raise RuntimeError("503 UNAVAILABLE")  # transient -> retried
        return "recovered"

    monkeypatch.setattr(gemini, "_call_model", fake)
    assert await gemini._request_text(object(), "prompt") == "recovered"
    # Primary tried twice (retry), then the fallback once.
    assert calls == [gemini.PRIMARY_MODEL, gemini.PRIMARY_MODEL, gemini.FALLBACK_MODEL]


@pytest.mark.asyncio
async def test_request_text_retries_a_transient_error_within_one_model(monkeypatch):
    monkeypatch.setattr(gemini, "RETRY_BACKOFF_SECONDS", 0.0)
    calls = []

    async def fake(client, model, prompt, timeout):
        calls.append(model)
        if len(calls) == 1:
            raise RuntimeError("504 DEADLINE_EXCEEDED")
        return "ok"

    monkeypatch.setattr(gemini, "_call_model", fake)
    assert await gemini._request_text(object(), "prompt") == "ok"
    assert calls == [gemini.PRIMARY_MODEL, gemini.PRIMARY_MODEL]


@pytest.mark.asyncio
async def test_request_text_raises_only_when_both_fail(monkeypatch):
    monkeypatch.setattr(gemini, "RETRY_BACKOFF_SECONDS", 0.0)

    async def fake(client, model, prompt, timeout):
        raise RuntimeError("503 UNAVAILABLE")

    monkeypatch.setattr(gemini, "_call_model", fake)
    with pytest.raises(RuntimeError):
        await gemini._request_text(object(), "prompt")


@pytest.mark.asyncio
async def test_generate_without_client_returns_empty_rationales(monkeypatch):
    monkeypatch.setattr(gemini, "_get_client", lambda: None)
    courses = [{"catalog_id": "TC-101"}, {"catalog_id": "TC-102"}]
    summary, rationales = await gemini.generate_performance_rationales(
        employee_name="Ana",
        month_number=2,
        status_classification="Needs Improvement",
        competency_scores={"task_completion": 2.5},
        recommended_courses=courses,
    )
    assert summary == gemini.FALLBACK_SUMMARY
    assert rationales == {"TC-101": "", "TC-102": ""}
