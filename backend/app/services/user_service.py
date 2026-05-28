"""
UserService: CRUD operations for users with role-based access checks.
"""

import math
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.auth import UserCreate, UserUpdate

logger = get_logger(__name__)


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    async def get_by_id(self, user_id: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def list_users(
        self,
        page: int = 1,
        page_size: int = 20,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> tuple[list[User], int]:
        """
        Return paginated list of users and the total count.
        """
        stmt = select(User)
        count_stmt = select(func.count()).select_from(User)

        if role is not None:
            stmt = stmt.where(User.role == role)
            count_stmt = count_stmt.where(User.role == role)

        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)
            count_stmt = count_stmt.where(User.is_active == is_active)

        if search:
            pattern = f"%{search}%"
            filter_clause = (
                User.username.ilike(pattern)
                | User.email.ilike(pattern)
                | User.full_name.ilike(pattern)
            )
            stmt = stmt.where(filter_clause)
            count_stmt = count_stmt.where(filter_clause)

        total_result = await self.db.execute(count_stmt)
        total: int = total_result.scalar_one()

        offset = (page - 1) * page_size
        stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(page_size)
        result = await self.db.execute(stmt)
        users = list(result.scalars().all())

        return users, total

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    async def create_user(self, data: UserCreate) -> User:
        """Create a new user after checking for duplicate email/username."""
        if await self.get_by_email(data.email):
            raise ValueError(f"Email '{data.email}' is already registered")

        if await self.get_by_username(data.username):
            raise ValueError(f"Username '{data.username}' is already taken")

        user = User(
            email=data.email,
            username=data.username,
            full_name=data.full_name,
            hashed_password=hash_password(data.password),
            role=data.role,
            is_active=True,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        logger.info("user_created", user_id=user.id, username=user.username, role=user.role)
        return user

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    async def update_user(self, user: User, data: UserUpdate) -> User:
        """Partial update — only provided (non-None) fields are changed."""
        update_data = data.model_dump(exclude_none=True)

        if "email" in update_data:
            existing = await self.get_by_email(update_data["email"])
            if existing and existing.id != user.id:
                raise ValueError(f"Email '{update_data['email']}' is already in use")

        for field, value in update_data.items():
            setattr(user, field, value)

        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        logger.info("user_updated", user_id=user.id, fields=list(update_data.keys()))
        return user

    async def toggle_active(self, user: User) -> User:
        """Toggle the is_active flag."""
        user.is_active = not user.is_active
        self.db.add(user)
        await self.db.flush()
        logger.info("user_active_toggled", user_id=user.id, is_active=user.is_active)
        return user

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    async def delete_user(self, user: User) -> None:
        """Soft-delete by deactivating, or hard delete."""
        await self.db.delete(user)
        await self.db.flush()
        logger.info("user_deleted", user_id=user.id)

    # ------------------------------------------------------------------
    # Role helpers
    # ------------------------------------------------------------------

    @staticmethod
    def is_admin(user: User) -> bool:
        return user.role == UserRole.admin

    @staticmethod
    def is_manager_or_above(user: User) -> bool:
        return user.role in (UserRole.admin, UserRole.manager)

    @staticmethod
    def can_manage_users(actor: User) -> bool:
        """Only admins may manage users."""
        return actor.role == UserRole.admin

    # ------------------------------------------------------------------
    # Pagination helper
    # ------------------------------------------------------------------

    @staticmethod
    def total_pages(total: int, page_size: int) -> int:
        return max(1, math.ceil(total / page_size)) if page_size > 0 else 1
