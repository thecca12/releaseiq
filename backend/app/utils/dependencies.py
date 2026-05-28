"""
FastAPI dependency functions for authentication and authorization.
"""

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_access_token
from app.models.user import User, UserRole
from app.services.user_service import UserService

# OAuth2 / Bearer token extractor
_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(_bearer)] = None,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency that returns the authenticated User or raises 401.
    The token may arrive either via the middleware (request.state) or
    through the HTTPBearer dependency (OpenAPI Swagger UI).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Try state set by middleware
    payload = getattr(request.state, "token_payload", None)

    # 2. Fallback: extract directly from the Authorization header
    if payload is None and credentials is not None:
        payload = verify_access_token(credentials.credentials)

    if payload is None:
        raise credentials_exception

    user_service = UserService(db)
    user = await user_service.get_by_id(payload.sub)

    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def get_current_user_optional(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(_bearer)] = None,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user but returns None instead of raising 401."""
    try:
        return await get_current_user(request, credentials, db)
    except HTTPException:
        return None


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Dependency that requires the current user to have the 'admin' role."""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def require_manager(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Dependency that requires admin or manager role."""
    if current_user.role not in (UserRole.admin, UserRole.manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required",
        )
    return current_user


# Convenience type aliases for use in endpoint signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
ManagerUser = Annotated[User, Depends(require_manager)]
