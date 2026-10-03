"""Shared test fixtures.

The test suite uses a temporary SQLite (aiosqlite) database so it can run
without a live PostgreSQL instance. ``DATABASE_URL`` must be set before any
backend module is imported, so it is configured at the top of this module.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

_TMP_DIR = Path(tempfile.mkdtemp(prefix="performa-tests-"))
# Honor a pre-set DATABASE_URL (e.g. the PostgreSQL CI job); fall back to a
# throwaway SQLite file for local runs. Must be set before any backend import.
os.environ.setdefault(
    "DATABASE_URL", f"sqlite+aiosqlite:///{(_TMP_DIR / 'test.db').as_posix()}"
)
os.environ.pop("GEMINI_API_KEY", None)

import httpx  # noqa: E402
import pytest_asyncio  # noqa: E402

from sqlalchemy import event  # noqa: E402

from backend.database import async_session_maker, engine  # noqa: E402
from backend.main import app  # noqa: E402
from backend.seed import seed  # noqa: E402


@event.listens_for(engine.sync_engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    """Enable SQLite FK enforcement so local runs match PostgreSQL behaviour."""
    if engine.dialect.name == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


@pytest.fixture(autouse=True)
def _clear_performa_today():
    """Guarantee the PERFORMA_TODAY clock override never leaks between tests."""
    os.environ.pop("PERFORMA_TODAY", None)
    yield
    os.environ.pop("PERFORMA_TODAY", None)


@pytest_asyncio.fixture
async def client():
    """Yield an httpx client bound to the app, with a freshly seeded tenant."""
    async with app.router.lifespan_context(app):
        async with async_session_maker() as session:
            await seed(session, with_evaluations=False)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
            yield http_client
