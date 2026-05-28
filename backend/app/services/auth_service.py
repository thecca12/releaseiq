"""
AuthService: user authentication, token creation and verification.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    TokenPair,
    TokenPayload,
    create_token_pair,
    hash_password,
    verify_access_token,
    verify_password,
    verify_refresh_token,
)
from app.core.logging import get_logger
from app.models.user import User

logger = get_logger(__name__)


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    async def authenticate_user(
        self, username_or_email: str, password: str
    ) -> Optional[User]:
        """
        Verify credentials and return the matching User, or None on failure.
        Accepts either username or email for the first argument.
        """
        # Try username first, then email
        stmt = select(User).where(
            (User.username == username_or_email) | (User.email == username_or_email)
        )
        result = await self.db.execute(stmt)
        user: Optional[User] = result.scalar_one_or_none()

        if user is None:
            logger.info("authentication_failed", reason="user_not_found", identifier=username_or_email)
            return None

        if not user.is_active:
            logger.info("authentication_failed", reason="user_inactive", user_id=user.id)
            return None

        if not verify_password(password, user.hashed_password):
            logger.info("authentication_failed", reason="wrong_password", user_id=user.id)
            return None

        # Update last_login timestamp
        user.last_login = datetime.now(timezone.utc)
        self.db.add(user)
        await self.db.flush()

        logger.info("authentication_success", user_id=user.id, username=user.username)
        return user

    # ------------------------------------------------------------------
    # Token management
    # ------------------------------------------------------------------

    def create_tokens(self, user: User) -> TokenPair:
        """Create access + refresh token pair for the given user."""
        return create_token_pair(user.id, user.email, user.role.value)

    def verify_token(self, token: str, token_type: str = "access") -> Optional[TokenPayload]:
        """
        Verify a JWT token.

        Args:
            token: Raw JWT string.
            token_type: "access" or "refresh".

        Returns:
            TokenPayload if valid, None otherwise.
        """
        if token_type == "access":
            return verify_access_token(token)
        if token_type == "refresh":
            return verify_refresh_token(token)
        return None

    async def refresh_tokens(self, refresh_token: str) -> Optional[TokenPair]:
        """
        Use a valid refresh token to issue a new token pair.
        Returns None if the refresh token is invalid.
        """
        payload = verify_refresh_token(refresh_token)
        if payload is None:
            return None

        # Ensure user still exists and is active
        result = await self.db.execute(select(User).where(User.id == payload.sub))
        user: Optional[User] = result.scalar_one_or_none()

        if user is None or not user.is_active:
            return None

        return self.create_tokens(user)

    # ------------------------------------------------------------------
    # Password management
    # ------------------------------------------------------------------

    async def change_password(
        self, user: User, current_password: str, new_password: str
    ) -> bool:
        """
        Verify current_password and update to new_password.
        Returns True on success, False if current_password is wrong.
        """
        if not verify_password(current_password, user.hashed_password):
            return False

        user.hashed_password = hash_password(new_password)
        self.db.add(user)
        await self.db.flush()
        logger.info("password_changed", user_id=user.id)
        return True

    async def reset_password(self, user: User, new_password: str) -> None:
        """Admin-initiated password reset (no current_password required)."""
        user.hashed_password = hash_password(new_password)
        self.db.add(user)
        await self.db.flush()
        logger.info("password_reset", user_id=user.id)
