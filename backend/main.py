"""Performa FastAPI application entrypoint.

Bootstraps the ASGI app, creates database tables from the ORM metadata on
startup (per ARCHITECTURE.md), configures CORS for the Vite dev servers, and
mounts the authentication router.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registers ORM metadata before create_all)
from .database import Base, engine
from .routers.admin import router as admin_router
from .routers.auth import router as auth_router
from .routers.employees import router as employees_router
from .routers.evaluations import router as evaluations_router
from .routers.interventions import router as interventions_router


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
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(employees_router, prefix="/api/employees")
app.include_router(evaluations_router, prefix="/api/evaluations")
app.include_router(interventions_router)


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
    """Liveness probe used by orchestrators and uptime checks."""
    return {"status": "healthy", "service": "performa-api"}


__all__ = ["app", "lifespan"]
