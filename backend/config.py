"""Centralized application configuration (pydantic-settings).

Environment variables (and an optional ``.env`` file) are validated into a
single typed settings object. Field names map to upper-case environment
variables automatically (e.g. ``database_url`` -> ``DATABASE_URL``).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "performa-dev-secret-key-32charsmin"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = (
        "sqlite+aiosqlite:///./performa.db"
    )
    secret_key: str = DEFAULT_SECRET_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    gemini_api_key: Optional[str] = None
    cors_origins: str = ""
    log_level: str = "INFO"
    cookie_secure: bool = False
    sql_echo: bool = Field(default=False, alias="SQL_ECHO")

    # Email delivery. The provider is auto-detected from whichever credential is
    # present, or forced with EMAIL_PROVIDER ("sendgrid" | "resend" | "smtp" |
    # "log"). With nothing configured the credentials email is logged, not sent.
    email_provider: Optional[str] = None
    email_from: Optional[str] = None
    app_base_url: Optional[str] = None
    # Self-service password reset: how long a reset link stays valid.
    password_reset_ttl_minutes: int = 30
    # Email verification: how long a verification link stays valid (24h).
    email_verification_ttl_minutes: int = 1440
    sendgrid_api_key: Optional[str] = None
    resend_api_key: Optional[str] = None

    # SMTP provider settings.
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_starttls: bool = True
    smtp_ssl: bool = False


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings singleton."""
    return Settings()


__all__ = ["Settings", "get_settings", "DEFAULT_SECRET_KEY"]
