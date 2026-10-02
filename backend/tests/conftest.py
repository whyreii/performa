"""Shared test fixtures.

The test suite uses a temporary SQLite (aiosqlite) database so it can run
without a live PostgreSQL instance. ``DATABASE_URL`` must be set before any
backend module is imported, so it is configured at the top of this module.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP_DIR = Path(tempfile.mkdtemp(prefix="performa-tests-"))
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{(_TMP_DIR / 'test.db').as_posix()}"
os.environ.pop("GEMINI_API_KEY", None)

import httpx  # noqa: E402
import pytest_asyncio  # noqa: E402

from backend.database import async_session_maker  # noqa: E402
from backend.main import app  # noqa: E402
from backend.seed import seed  # noqa: E402


@pytest_asyncio.fixture
async def client():
    """Yield an httpx client bound to the app, with a freshly seeded tenant."""
    async with app.router.lifespan_context(app):
        async with async_session_maker() as session:
            await seed(session)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as http_client:
            yield http_client
