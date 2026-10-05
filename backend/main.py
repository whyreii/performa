"""Performa FastAPI application entrypoint.

Bootstraps the ASGI app, creates database tables from the ORM metadata on
startup (per ARCHITECTURE.md), configures CORS, and mounts the auth, admin,
employees, evaluations, and interventions routers.
"""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from . import models  # noqa: F401  (registers ORM metadata before create_all)
from .config import get_settings
from .database import Base, engine
from .routers.admin import router as admin_router
from .routers.auth import router as auth_router
from .routers.employees import router as employees_router
from .routers.evaluations import router as evaluations_router
from .routers.interventions import router as interventions_router
from .routers.kpi import router as kpi_router
from .routers.notifications import router as notifications_router
from .routers.organization import router as organization_router

_settings = get_settings()

logging.basicConfig(
    level=_settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger("performa.request")

DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
CORS_ORIGINS = [
    origin.strip()
    for origin in _settings.cors_origins.split(",")
    if origin.strip()
] or DEFAULT_CORS_ORIGINS


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create tables on startup and dispose of the engine on shutdown.

    ``create_all`` is idempotent and only creates missing tables, so it is safe
    for local development against a fresh or existing SQLite ``performa.db``.

    Schema migrations are owned by Alembic (``backend/migrations``):
    ``0001_baseline`` materialises the ORM schema and ``0002_unique_constraints``
    adds the per-employee/month and per-org/competency uniqueness guarantees.
    Run ``alembic upgrade head`` to apply them — verified clean against both
    fresh and existing SQLite databases; the migrations use batch mode so they
    are portable to PostgreSQL. For a pre-existing database created by
    ``create_all``, ``0001`` is a no-op and ``0002`` applies the constraints.
    """
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


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Attach a per-request id, time the request, and emit one log line."""
    request_id = uuid.uuid4()
    request.state.request_id = request_id
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        # The 500 is produced by the global exception handler above; log the
        # access line here (the response header is set by that handler) and
        # re-raise so the handler can render the safe body.
        duration_ms = (time.perf_counter() - start) * 1000.0
        logger.info(
            "%s %s -> 500 (%.2fms) [req_id=%s]",
            request.method,
            request.url.path,
            duration_ms,
            request_id,
        )
        raise
    duration_ms = (time.perf_counter() - start) * 1000.0
    response.headers["X-Request-ID"] = str(request_id)
    logger.info(
        "%s %s -> %s (%.2fms) [req_id=%s]",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        request_id,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Log unhandled errors with their request id and return a safe 500 body."""
    request_id = getattr(request.state, "request_id", None)
    logger.error(
        "Unhandled exception [req_id=%s] on %s %s",
        request_id,
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred.",
            "request_id": str(request_id),
        },
        headers={"X-Request-ID": str(request_id)},
    )


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(employees_router, prefix="/api/employees")
app.include_router(evaluations_router, prefix="/api/evaluations")
app.include_router(interventions_router)
app.include_router(kpi_router)
app.include_router(notifications_router)
app.include_router(organization_router)


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
