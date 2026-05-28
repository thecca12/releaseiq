"""
ReleaseIQ FastAPI application factory.

Startup sequence:
  1. Configure structured logging
  2. Create DB tables (idempotent)
  3. Seed default users + sample data if the DB is empty
  4. Mount middleware, routers, error handlers, and WebSocket placeholder
"""

from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal, init_db
from app.core.logging import configure_logging, get_logger
from app.middleware.auth import AuthMiddleware

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Lifespan (replaces on_event deprecated hooks)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown logic."""
    configure_logging()
    logger.info(
        "startup",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        debug=settings.DEBUG,
    )

    # Initialise database schema
    await init_db()
    logger.info("database_initialised")

    # Seed default data if needed
    try:
        from app.utils.seed_data import seed_if_empty
        async with AsyncSessionLocal() as db:
            await seed_if_empty(db)
    except Exception as exc:
        logger.error("seed_failed", error=str(exc))

    # Initialise DataSourceManager (loads all real datasource files into memory)
    try:
        from app.services.datasource.manager import get_datasource_manager
        ds = get_datasource_manager()
        logger.info("datasource_loaded", stats=ds.get_stats())
    except Exception as exc:
        logger.error("datasource_load_failed", error=str(exc))

    logger.info("application_ready", docs_url="/docs")

    yield  # Application runs here

    logger.info("shutdown", app=settings.APP_NAME)


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "ReleaseIQ Enterprise Platform API — "
            "release management, Jira integration, AI chat, analytics, and more."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ------------------------------------------------------------------
    # CORS
    # ------------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Total-Count", "X-Page", "X-Pages"],
    )

    # ------------------------------------------------------------------
    # JWT Auth middleware
    # ------------------------------------------------------------------
    app.add_middleware(AuthMiddleware)

    # ------------------------------------------------------------------
    # Routers
    # ------------------------------------------------------------------
    app.include_router(api_router)

    # ------------------------------------------------------------------
    # WebSocket – AI streaming chat
    # ------------------------------------------------------------------
    from fastapi import WebSocket

    from app.api.v1.websocket.chat_ws import chat_websocket_handler

    @app.websocket("/ws/chat/{client_id}")
    async def websocket_chat(websocket: WebSocket, client_id: str) -> None:
        """Streaming AI chat over WebSocket."""
        await chat_websocket_handler(websocket, client_id)

    @app.websocket("/ws/{client_id}")
    async def websocket_generic(websocket: WebSocket, client_id: str) -> None:
        """Generic WebSocket – echoes messages (legacy / testing)."""
        from fastapi import WebSocketDisconnect

        await websocket.accept()
        logger.info("websocket_connected", client_id=client_id)
        try:
            while True:
                data = await websocket.receive_text()
                await websocket.send_text(f"Echo [{client_id}]: {data}")
        except WebSocketDisconnect:
            logger.info("websocket_disconnected", client_id=client_id)

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------
    @app.get("/health", tags=["System"], summary="Health check")
    async def health_check() -> dict:
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
        }

    @app.get("/", tags=["System"], summary="Root redirect info")
    async def root() -> dict:
        return {
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "health": "/health",
            "api": "/api/v1",
        }

    # ------------------------------------------------------------------
    # Error handlers
    # ------------------------------------------------------------------

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc: Any) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"detail": f"Resource not found: {request.url.path}"},
        )

    @app.exception_handler(405)
    async def method_not_allowed_handler(request: Request, exc: Any) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            content={"detail": f"Method {request.method} not allowed on {request.url.path}"},
        )

    @app.exception_handler(500)
    async def internal_error_handler(request: Request, exc: Any) -> JSONResponse:
        logger.error(
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
            error=str(exc),
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error. Please try again later."},
        )

    from fastapi.exceptions import RequestValidationError

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = exc.errors()
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Validation error",
                "errors": [
                    {
                        "field": " -> ".join(str(loc) for loc in e["loc"]),
                        "message": e["msg"],
                        "type": e["type"],
                    }
                    for e in errors
                ],
            },
        )

    return app


# ---------------------------------------------------------------------------
# Module-level app instance (used by uvicorn)
# ---------------------------------------------------------------------------

app = create_app()
