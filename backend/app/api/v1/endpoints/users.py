"""
User management endpoints (admin only).
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import hash_password
from app.models.user import UserRole
from app.schemas.auth import (
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
    ResetPasswordRequest,
)
from app.services.user_service import UserService
from app.utils.dependencies import AdminUser, CurrentUser

router = APIRouter(prefix="/users", tags=["Users"])
logger = get_logger(__name__)


@router.get("", response_model=UserListResponse, summary="List all users (admin)")
async def list_users(
    _: AdminUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[UserRole] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, min_length=1, max_length=100),
    db: AsyncSession = Depends(get_db),
) -> UserListResponse:
    service = UserService(db)
    users, total = await service.list_users(
        page=page,
        page_size=page_size,
        role=role,
        is_active=is_active,
        search=search,
    )
    pages = service.total_pages(total, page_size)
    return UserListResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, summary="Create user (admin)")
async def create_user(
    body: UserCreate,
    _: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    service = UserService(db)
    try:
        user = await service.create_user(body)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse, summary="Get user by ID")
async def get_user(
    user_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    # Users can view themselves; admins can view anyone
    if current_user.id != user_id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    service = UserService(db)
    user = await service.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse, summary="Update user (admin)")
async def update_user(
    user_id: str,
    body: UserUpdate,
    _: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    service = UserService(db)
    user = await service.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    try:
        updated = await service.update_user(user, body)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return UserResponse.model_validate(updated)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete user (admin)")
async def delete_user(
    user_id: str,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> None:
    if admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    service = UserService(db)
    user = await service.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await service.delete_user(user)


@router.post("/{user_id}/reset-password", summary="Reset user password (admin)")
async def reset_password(
    user_id: str,
    body: ResetPasswordRequest,
    _: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.services.auth_service import AuthService

    service = UserService(db)
    user = await service.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    auth_service = AuthService(db)
    await auth_service.reset_password(user, body.new_password)
    return {"message": "Password reset successfully"}


@router.post("/{user_id}/toggle-active", response_model=UserResponse, summary="Toggle user active status (admin)")
async def toggle_user_active(
    user_id: str,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    if admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    service = UserService(db)
    user = await service.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    updated = await service.toggle_active(user)
    return UserResponse.model_validate(updated)
