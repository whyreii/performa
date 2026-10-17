"""Guardrail: a real deployment must not boot with the development secret.

The app used to start with ``SECRET_KEY`` at its development default, so a
deployed instance would sign JWTs with a public, known key. ``Settings`` now
refuses to construct when the environment is not a dev/test value and the
secret is still the default.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.config import DEFAULT_SECRET_KEY, Settings


def test_default_secret_is_rejected_in_production():
    with pytest.raises(ValidationError):
        Settings(environment="production", secret_key=DEFAULT_SECRET_KEY)


def test_default_secret_is_rejected_in_staging():
    with pytest.raises(ValidationError):
        Settings(environment="staging", secret_key=DEFAULT_SECRET_KEY)


def test_default_secret_is_allowed_in_development():
    settings = Settings(environment="development", secret_key=DEFAULT_SECRET_KEY)
    assert settings.secret_key == DEFAULT_SECRET_KEY


def test_a_real_secret_is_allowed_in_production():
    settings = Settings(environment="production", secret_key="a-strong-random-secret-value")
    assert settings.secret_key == "a-strong-random-secret-value"


def test_a_driverless_postgres_url_gains_the_async_driver():
    """Managed Postgres hands out `postgresql://`; the async engine needs +asyncpg."""
    settings = Settings(database_url="postgresql://u:p@host:5432/db")
    assert settings.database_url == "postgresql+asyncpg://u:p@host:5432/db"


def test_the_heroku_style_postgres_scheme_is_rewritten_too():
    settings = Settings(database_url="postgres://u:p@host:5432/db")
    assert settings.database_url == "postgresql+asyncpg://u:p@host:5432/db"


def test_a_driverless_sqlite_url_gains_aiosqlite():
    settings = Settings(database_url="sqlite:///./performa.db")
    assert settings.database_url == "sqlite+aiosqlite:///./performa.db"


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+asyncpg://u:p@host:5432/db",
        "sqlite+aiosqlite:///./performa.db",
    ],
)
def test_a_url_that_already_names_its_async_driver_is_untouched(url):
    assert Settings(database_url=url).database_url == url


def test_neon_style_sslmode_is_translated_to_ssl():
    """libpq spells it `sslmode`; asyncpg only knows `ssl` and rejects the URL."""
    settings = Settings(
        database_url="postgresql://u:p@ep-x.neon.tech/db?sslmode=require"
    )
    assert settings.database_url == (
        "postgresql+asyncpg://u:p@ep-x.neon.tech/db?ssl=require"
    )


def test_libpq_only_parameters_are_dropped_not_forwarded():
    """asyncpg aborts on any connect keyword it does not recognise.

    Neon hands out ``?sslmode=require&channel_binding=require``, and
    ``channel_binding`` is not an asyncpg keyword — it must not reach the driver.
    """
    settings = Settings(
        database_url=(
            "postgresql://u:p@ep-x.neon.tech/db?sslmode=require&channel_binding=require"
        )
    )
    assert settings.database_url == (
        "postgresql+asyncpg://u:p@ep-x.neon.tech/db?ssl=require"
    )


def test_a_url_with_only_unknown_parameters_loses_its_query_string():
    settings = Settings(
        database_url="postgresql://u:p@host:5432/db?application_name=performa"
    )
    assert settings.database_url == "postgresql+asyncpg://u:p@host:5432/db"
