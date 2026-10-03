"""Database engine, session factory, and declarative base for Performa.

Per ARCHITECTURE.md the backend uses SQLAlchemy 2.0 with the asyncpg driver
against PostgreSQL. Tables are created from ``Base.metadata`` on startup.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings

DEFAULT_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/performa_db"

DATABASE_URL: str = get_settings().database_url

engine = create_async_engine(DATABASE_URL, echo=get_settings().sql_echo)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Lowercase alias for callers (e.g. the seed script) that import
# ``async_session_maker`` by name.
async_session_maker = AsyncSessionLocal


class Base(DeclarativeBase):
    """Declarative base class shared by every ORM model."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a request-scoped ``AsyncSession``.

    The session is rolled back automatically if the request handler raises,
    and is always closed when the request completes.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


__all__ = [
    "DEFAULT_DATABASE_URL",
    "DATABASE_URL",
    "engine",
    "AsyncSessionLocal",
    "async_session_maker",
    "Base",
    "get_db",
]
