"""
User-related Pydantic schemas (complement auth.py).
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    role: UserRole = UserRole.user
    is_active: bool = True


class UserInDB(UserBase):
    model_config = {"from_attributes": True}

    id: str
    hashed_password: str
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None


class UserSummary(BaseModel):
    """Lightweight user representation for embedding in other responses."""
    model_config = {"from_attributes": True}

    id: str
    username: str
    full_name: str
    email: str
    role: UserRole


class AuditLogResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    detail: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    user: Optional[UserSummary] = None


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int
    pages: int
