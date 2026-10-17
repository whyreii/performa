"""Centralized application configuration (pydantic-settings).

Environment variables (and an optional ``.env`` file) are validated into a
single typed settings object. Field names map to upper-case environment
variables automatically (e.g. ``database_url`` -> ``DATABASE_URL``).
"""
from __future__ import annotations

import re
from functools import lru_cache
from typing import Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "performa-dev-secret-key-32charsmin"

# Environments in which the development secret is acceptable. Any other value
# means a real deployment, where the default key must never be used.
_DEV_ENVIRONMENTS = {"development", "dev", "local", "test", "testing"}


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

    # Deployment environment. Only the dev/test values below allow the default
    # SECRET_KEY; anything else (e.g. "production", "staging") must set a real one.
    environment: str = "development"

    @model_validator(mode="after")
    def _reject_default_secret_outside_dev(self) -> "Settings":
        if (
            self.secret_key == DEFAULT_SECRET_KEY
            and self.environment.strip().lower() not in _DEV_ENVIRONMENTS
        ):
            raise ValueError(
                "SECRET_KEY is still the insecure development default. Set "
                "SECRET_KEY to a strong random value when "
                f"ENVIRONMENT={self.environment!r}."
            )
        return self

    @model_validator(mode="after")
    def _normalize_database_url(self) -> "Settings":
        """Rewrite driver-less database URLs onto their async driver, and
        translate libpq's ``sslmode`` to the driver's ``ssl``.

        Managed Postgres hands out ``postgresql://`` or ``postgres://``, but
        SQLAlchemy's *async* engine refuses a URL with no async driver ("The
        asyncio extension requires an async driver to be used"). Normalising here
        means a deployment can paste the URL the provider gave it verbatim instead
        of remembering to insert ``+asyncpg``. A URL that already names its async
        driver (``postgresql+asyncpg://``, ``sqlite+aiosqlite://``) is left alone.

        ``sslmode`` needs the same treatment: libpq spells it that way, but asyncpg
        only knows ``ssl`` and rejects the whole URL with "connect() got an
        unexpected keyword argument 'sslmode'". Neon (and others) hand out
        ``?sslmode=require``, so translate the key and keep the value and any
        sibling parameters.
        """
        url = self.database_url.strip()
        for prefix, replacement in (
            ("postgres://", "postgresql+asyncpg://"),
            ("postgresql://", "postgresql+asyncpg://"),
            ("sqlite://", "sqlite+aiosqlite://"),
        ):
            if url.startswith(prefix):
                url = replacement + url[len(prefix) :]
                break

        head, separator, query = url.partition("?")
        if separator and "sslmode=" in query.lower():
            query = re.sub(r"(?i)(^|&)sslmode=", r"\1ssl=", query)
            url = f"{head}?{query}"

        self.database_url = url
        return self


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings singleton."""
    return Settings()


__all__ = ["Settings", "get_settings", "DEFAULT_SECRET_KEY"]
