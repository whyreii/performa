"""Unit tests for provider-based email delivery (no network)."""
from __future__ import annotations

import pytest

from backend import emailer


class _Settings:
    def __init__(self, **kw):
        self.email_provider = kw.get("email_provider")
        self.email_from = kw.get("email_from")
        self.app_base_url = kw.get("app_base_url")
        self.sendgrid_api_key = kw.get("sendgrid_api_key")
        self.resend_api_key = kw.get("resend_api_key")
        self.smtp_host = kw.get("smtp_host")
        self.smtp_from = kw.get("smtp_from")
        self.smtp_user = kw.get("smtp_user")


def _patch(monkeypatch, **kw):
    monkeypatch.setattr(emailer, "get_settings", lambda: _Settings(**kw))


def test_render_includes_sign_in_link(monkeypatch):
    _patch(monkeypatch, app_base_url="https://app.performa.ph/")
    subject, body = emailer._render("ana@acme.com", "Ana", "Pw123456!", "Acme")
    assert subject == "Your Performa account credentials"
    assert "Sign in at https://app.performa.ph/login" in body
    assert "Temporary password: Pw123456!" in body


def test_render_omits_sign_in_link_without_base_url(monkeypatch):
    _patch(monkeypatch, app_base_url=None)
    _, body = emailer._render("ana@acme.com", "Ana", "Pw123456!", None)
    assert "Sign in at" not in body


@pytest.mark.parametrize(
    "kw, expected",
    [
        (dict(sendgrid_api_key="k"), "sendgrid"),
        (dict(resend_api_key="k"), "resend"),
        (dict(smtp_host="smtp.example.com"), "smtp"),
        (dict(), "log"),
        (dict(email_provider="log", sendgrid_api_key="k"), "log"),
        (dict(email_provider="sendgrid"), "log"),  # forced, but no key
    ],
)
def test_resolve_provider(monkeypatch, kw, expected):
    _patch(monkeypatch, **kw)
    assert emailer._resolve_provider() == expected


def test_sendgrid_payload(monkeypatch):
    _patch(
        monkeypatch,
        sendgrid_api_key="k",
        email_from="Performa <no-reply@acme.ph>",
        app_base_url=None,
    )
    payload = emailer._sendgrid_payload("ana@acme.com", "Ana", "Pw123456!", "Acme")
    assert payload["personalizations"][0]["to"][0]["email"] == "ana@acme.com"
    assert payload["from"] == {"email": "no-reply@acme.ph", "name": "Performa"}
    assert payload["content"][0]["type"] == "text/plain"
    assert "Temporary password: Pw123456!" in payload["content"][0]["value"]


def test_sender_defaults(monkeypatch):
    _patch(monkeypatch)
    assert emailer._sender() == ("no-reply@performa.local", "Performa")
