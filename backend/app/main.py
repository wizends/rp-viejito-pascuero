"""Aplicación FastAPI del Buzón del Viejito Pascuero."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, children, letters, shipments
from app.core.config import get_settings
from app.core.middleware import SecurityMiddleware
from app.services.retention import purge_expired_images
from app.services.tracking import auto_advance_loop
from app.ws import routes as ws_routes
from app.ws.hub import hub

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await hub.start()
    tasks = [asyncio.create_task(auto_advance_loop())]
    with contextlib.suppress(Exception):
        await asyncio.to_thread(purge_expired_images)
    yield
    for t in tasks:
        t.cancel()
    await hub.stop()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title=s.app_name,
        lifespan=lifespan,
        docs_url=None if s.is_production else "/api/docs",
        openapi_url=None if s.is_production else "/api/openapi.json",
    )
    app.add_middleware(SecurityMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )
    for r in (auth.router, children.router, letters.router, shipments.router):
        app.include_router(r, prefix="/api")
    app.include_router(ws_routes.router)

    @app.get("/api/health", tags=["salud"])
    def health() -> dict[str, str]:
        return {"estado": "jo jo jo"}

    return app


app = create_app()
