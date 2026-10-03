"""Centralized application configuration (pydantic-settings).

Environment variables (and an optional ``.env`` file) are validated into a
single typed settings object. Field names map to upper-case environment
variables automatically (e.g. ``database_url`` -> ``DATABASE_URL``).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "performa-dev-secret-key-32charsmin"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/performa_db"
    )
    secret_key: str = DEFAULT_SECRET_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    gemini_api_key: Optional[str] = None
    cors_origins: str = ""
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings singleton."""
    return Settings()


__all__ = ["Settings", "get_settings", "DEFAULT_SECRET_KEY"]
