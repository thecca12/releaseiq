"""
Authentication endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import AuthService
from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = get_logger(__name__)


@router.post("/login", response_model=TokenResponse, summary="Obtain JWT token pair")
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate with username/email + password.
    Returns an access token and a refresh token.
    """
    auth_service = AuthService(db)
    user = await auth_service.authenticate_user(body.username, body.password)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    tokens = auth_service.create_tokens(user)

    logger.info(
        "user_logged_in",
        user_id=user.id,
        username=user.username,
        ip=request.client.host if request.client else "unknown",
    )

    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", summary="Invalidate session (client-side token drop)")
async def logout(current_user: CurrentUser) -> dict:
    """
    Logout endpoint.
    Since JWTs are stateless, the client is responsible for discarding tokens.
    This endpoint exists for audit-log purposes and to support future token
    revocation (e.g. Redis block-list).
    """
    logger.info("user_logged_out", user_id=current_user.id)
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse, summary="Get current user profile")
async def get_me(current_user: CurrentUser) -> UserResponse:
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
async def refresh_token(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Exchange a valid refresh token for a new token pair.
    """
    auth_service = AuthService(db)
    tokens = await auth_service.refresh_tokens(body.refresh_token)

    if tokens is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # We need the user for the response — re-verify
    from app.core.security import verify_refresh_token
    from app.services.user_service import UserService

    payload = verify_refresh_token(body.refresh_token)
    user_service = UserService(db)
    user = await user_service.get_by_id(payload.sub)  # type: ignore[union-attr]

    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
        user=UserResponse.model_validate(user),
    )


@router.post("/change-password", summary="Change own password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Allow the authenticated user to change their own password."""
    auth_service = AuthService(db)
    success = await auth_service.change_password(
        current_user, body.current_password, body.new_password
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    return {"message": "Password changed successfully"}
