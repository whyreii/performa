"""Performa FastAPI application entrypoint.

Bootstraps the ASGI app, creates database tables from the ORM metadata on
startup (per ARCHITECTURE.md), configures CORS, and mounts the auth, admin,
employees, evaluations, and interventions routers.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from . import models  # noqa: F401  (registers ORM metadata before create_all)
from .database import Base, engine
from .routers.admin import router as admin_router
from .routers.auth import router as auth_router
from .routers.employees import router as employees_router
from .routers.evaluations import router as evaluations_router
from .routers.interventions import router as interventions_router
from .routers.kpi import router as kpi_router

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
] or DEFAULT_CORS_ORIGINS


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create tables on startup and dispose of the engine on shutdown."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="Performa API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(employees_router, prefix="/api/employees")
app.include_router(evaluations_router, prefix="/api/evaluations")
app.include_router(interventions_router)
app.include_router(kpi_router)


@app.get("/", tags=["System"], summary="API Root Information")
async def root() -> dict[str, str]:
    """Root endpoint welcoming clients and referencing documentation."""
    return {
        "service": "Performa API",
        "version": "1.0.0",
        "status": "online",
        "docs_url": "/docs",
        "health_url": "/health",
    }


@app.get("/health", tags=["System"], summary="Service health check")
async def health() -> dict[str, str]:
    """Readiness probe that verifies the database is reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "service": "performa-api",
                "database": "unreachable",
            },
        )
    return {"status": "healthy", "service": "performa-api", "database": "ok"}


__all__ = ["app", "lifespan"]
