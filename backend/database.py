"""Database engine, session factory, and declarative base for Performa.

Per ARCHITECTURE.md the backend uses SQLAlchemy 2.0 with the asyncpg driver
against PostgreSQL. Tables are created from ``Base.metadata`` on startup.
"""
from __future__ import annotations

import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

DEFAULT_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/performa_db"

DATABASE_URL: str = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


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
    "Base",
    "get_db",
]
