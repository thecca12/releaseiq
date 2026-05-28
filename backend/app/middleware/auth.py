"""
JWT Authentication middleware.
Validates Bearer tokens on protected routes and attaches the token payload
to request.state for use by downstream dependencies.
"""

from typing import Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.security import verify_access_token
from app.core.logging import get_logger

logger = get_logger(__name__)

# Routes that do NOT require a valid token
PUBLIC_PATHS = {
    "/",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
}

PUBLIC_PREFIXES = (
    "/docs",
    "/redoc",
    "/openapi",
    "/static",
)


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Lightweight middleware that:
    1. Skips public paths.
    2. Extracts the Bearer token from the Authorization header.
    3. Verifies it and stores the TokenPayload in request.state.token_payload.
    4. If the token is missing or invalid, sets request.state.token_payload = None
       (the dependency layer will raise 401 for protected endpoints).
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        request.state.token_payload = None

        # Skip validation for public paths
        path = request.url.path
        if path in PUBLIC_PATHS or any(path.startswith(p) for p in PUBLIC_PREFIXES):
            return await call_next(request)

        token = _extract_bearer_token(request)
        if token:
            payload = verify_access_token(token)
            if payload:
                request.state.token_payload = payload
            else:
                logger.debug("invalid_token", path=path)

        return await call_next(request)


def _extract_bearer_token(request: Request) -> Optional[str]:
    """Extract raw JWT from 'Authorization: Bearer <token>' header."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[len("Bearer "):]
    return None
