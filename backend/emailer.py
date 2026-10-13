"""Outbound email for account provisioning and password resets.

Delivery is provider-based and env-driven, chosen in this order:

    1. SendGrid HTTP API   (``SENDGRID_API_KEY``)
    2. Resend HTTP API     (``RESEND_API_KEY``)
    3. SMTP                (``SMTP_HOST``)
    4. Log only            (fallback — dev / unconfigured)

``EMAIL_PROVIDER`` forces one of ``sendgrid`` / ``resend`` / ``smtp`` / ``log``.
HTTP APIs run over port 443, so they are not blocked the way SMTP often is on
PaaS hosts. A send failure is logged and never blocks the caller.
"""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Optional

import httpx

from .config import get_settings

logger = logging.getLogger(__name__)

_SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send"
_RESEND_URL = "https://api.resend.com/emails"
_TIMEOUT = 15.0


def _render(
    to_email: str,
    full_name: str,
    password: str,
    organization_name: Optional[str],
) -> tuple[str, str]:
    """Return ``(subject, body)`` for the credential-provisioning email."""
    org = organization_name or "your organization"
    subject = "Your Performa account credentials"
    lines = [
        f"Hello {full_name},",
        "",
        f"An account has been created for you in Performa ({org}).",
        "",
        f"Email: {to_email}",
        f"Temporary password: {password}",
    ]
    app_url = get_settings().app_base_url
    if app_url:
        lines += ["", f"Sign in at {app_url.rstrip('/')}/login"]
    lines += ["", "For your security, please sign in and change this password."]
    return subject, "\n".join(lines) + "\n"


def _render_reset(full_name: str, reset_link: str, ttl_minutes: int) -> tuple[str, str]:
    """Return ``(subject, body)`` for the password-reset email."""
    subject = "Reset your Performa password"
    lines = [
        f"Hello {full_name},",
        "",
        "A password reset was requested for your Performa account.",
        "",
        f"Reset your password (this link is valid for {ttl_minutes} minutes):",
        reset_link,
        "",
        "If you did not request this, you can ignore this email.",
    ]
    return subject, "\n".join(lines) + "\n"


def _render_milestone(
    full_name: str, employee_name: str, day: int, title: str
) -> tuple[str, str]:
    """Return ``(subject, body)`` for a statutory milestone alert."""
    subject = f"Article 296: {employee_name} reached Day {day}"
    lines = [
        f"Hello {full_name},",
        "",
        f"{employee_name} has reached the Day {day} milestone ({title}) of the "
        "180-day probation timeline.",
        "",
        "Review the record and take the required action before the Day 180 cap.",
    ]
    app_url = get_settings().app_base_url
    if app_url:
        lines += ["", f"Open the dashboard: {app_url.rstrip('/')}/dashboard"]
    return subject, "\n".join(lines) + "\n"


def _render_verify(full_name: str, verify_link: str, ttl_hours: int) -> tuple[str, str]:
    """Return ``(subject, body)`` for the email-verification email."""
    subject = "Verify your Performa email address"
    lines = [
        f"Hello {full_name},",
        "",
        "Confirm your email address to activate your Performa account.",
        "",
        f"Verify now (this link is valid for {ttl_hours} hours):",
        verify_link,
        "",
        "If you did not create this account, you can ignore this email.",
    ]
    return subject, "\n".join(lines) + "\n"


def _sender() -> tuple[str, str]:
    """Return ``(email, name)`` parsed from ``EMAIL_FROM`` (``Name <addr>`` ok)."""
    settings = get_settings()
    raw = (
        settings.email_from
        or settings.smtp_from
        or settings.smtp_user
        or "no-reply@performa.local"
    )
    if "<" in raw and ">" in raw:
        name, _, address = raw.partition("<")
        return address.strip("> ").strip(), name.strip() or "Performa"
    return raw.strip(), "Performa"


def _resolve_provider() -> str:
    settings = get_settings()
    forced = (settings.email_provider or "").strip().lower()
    if forced == "log":
        return "log"
    if forced == "sendgrid":
        return "sendgrid" if settings.sendgrid_api_key else "log"
    if forced == "resend":
        return "resend" if settings.resend_api_key else "log"
    if forced == "smtp":
        return "smtp" if settings.smtp_host else "log"
    if settings.sendgrid_api_key:
        return "sendgrid"
    if settings.resend_api_key:
        return "resend"
    if settings.smtp_host:
        return "smtp"
    return "log"


def _payload_sendgrid(to_email: str, subject: str, body: str) -> dict:
    from_email, from_name = _sender()
    return {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email, "name": from_name},
        "subject": subject,
        "content": [{"type": "text/plain", "value": body}],
    }


def _payload_resend(to_email: str, subject: str, body: str) -> dict:
    from_email, from_name = _sender()
    return {
        "from": f"{from_name} <{from_email}>",
        "to": [to_email],
        "subject": subject,
        "text": body,
    }


# Credential-shaped payload builders (kept for the credentials email + tests).
def _sendgrid_payload(
    to_email: str, full_name: str, password: str, organization_name: Optional[str]
) -> dict:
    subject, body = _render(to_email, full_name, password, organization_name)
    return _payload_sendgrid(to_email, subject, body)


def _resend_payload(
    to_email: str, full_name: str, password: str, organization_name: Optional[str]
) -> dict:
    subject, body = _render(to_email, full_name, password, organization_name)
    return _payload_resend(to_email, subject, body)


async def _post_json(url: str, headers: dict, payload: dict) -> tuple[bool, str]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(url, headers=headers, json=payload)
    if response.status_code < 300:
        return True, ""
    return False, f"{response.status_code} {response.text[:200]}"


async def _send_sendgrid(to_email: str, subject: str, body: str) -> bool:
    settings = get_settings()
    headers = {"Authorization": f"Bearer {settings.sendgrid_api_key}"}
    ok, detail = await _post_json(
        _SENDGRID_URL, headers, _payload_sendgrid(to_email, subject, body)
    )
    if ok:
        logger.info("Email sent to %s via SendGrid", to_email)
    else:
        logger.error("SendGrid delivery failed for %s: %s", to_email, detail)
    return ok


async def _send_resend(to_email: str, subject: str, body: str) -> bool:
    settings = get_settings()
    headers = {"Authorization": f"Bearer {settings.resend_api_key}"}
    ok, detail = await _post_json(
        _RESEND_URL, headers, _payload_resend(to_email, subject, body)
    )
    if ok:
        logger.info("Email sent to %s via Resend", to_email)
    else:
        logger.error("Resend delivery failed for %s: %s", to_email, detail)
    return ok


def _send_smtp_sync(to_email: str, subject: str, body: str) -> bool:
    settings = get_settings()
    from_addr = settings.smtp_from or settings.smtp_user or "no-reply@performa.local"
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = from_addr
    message["To"] = to_email
    message.set_content(body)

    if not settings.smtp_host:
        logger.error("SMTP provider selected but SMTP_HOST is unset; not sending.")
        return False

    try:
        if settings.smtp_ssl:
            client = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15)
        else:
            client = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
        with client:
            if settings.smtp_starttls and not settings.smtp_ssl:
                client.starttls()
            if settings.smtp_user:
                client.login(settings.smtp_user, settings.smtp_password or "")
            client.send_message(message)
    except (smtplib.SMTPException, OSError):
        logger.exception("Failed to send email to %s", to_email)
        return False

    logger.info("Email sent to %s via SMTP", to_email)
    return True


async def _deliver(to_email: str, subject: str, body: str) -> bool:
    """Send ``subject``/``body`` through the resolved provider, or log it.

    Never raises: delivery problems must not block the caller.
    """
    provider = _resolve_provider()
    try:
        if provider == "sendgrid":
            return await _send_sendgrid(to_email, subject, body)
        if provider == "resend":
            return await _send_resend(to_email, subject, body)
        if provider == "smtp":
            return await asyncio.to_thread(_send_smtp_sync, to_email, subject, body)
    except Exception:
        logger.exception("Unexpected error sending email to %s", to_email)
        return False

    logger.warning(
        "No email provider configured; logging the email for %s instead of sending "
        "it. Set SENDGRID_API_KEY (or SMTP_HOST) to deliver real email.\n"
        "Subject: %s\n%s",
        to_email,
        subject,
        body,
    )
    return False


async def send_credentials_email(
    to_email: str,
    full_name: str,
    password: str,
    organization_name: Optional[str] = None,
) -> bool:
    """Send the generated credentials, or log them when no provider is set."""
    subject, body = _render(to_email, full_name, password, organization_name)
    return await _deliver(to_email, subject, body)


async def send_password_reset_email(
    to_email: str,
    full_name: str,
    reset_link: str,
    ttl_minutes: int,
) -> bool:
    """Send a password-reset link, or log it when no provider is set."""
    subject, body = _render_reset(full_name, reset_link, ttl_minutes)
    return await _deliver(to_email, subject, body)


async def send_milestone_alert_email(
    to_email: str,
    full_name: str,
    employee_name: str,
    day: int,
    title: str,
) -> bool:
    """Send a Day 150/165/178 milestone alert, or log it when no provider is set."""
    subject, body = _render_milestone(full_name, employee_name, day, title)
    return await _deliver(to_email, subject, body)


async def send_verification_email(
    to_email: str,
    full_name: str,
    verify_link: str,
    ttl_hours: int,
) -> bool:
    """Send an email-verification link, or log it when no provider is set."""
    subject, body = _render_verify(full_name, verify_link, ttl_hours)
    return await _deliver(to_email, subject, body)


__all__ = [
    "send_credentials_email",
    "send_password_reset_email",
    "send_milestone_alert_email",
    "send_verification_email",
]
