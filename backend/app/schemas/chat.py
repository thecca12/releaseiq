"""
Chat-related Pydantic schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.chat import MessageRole


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    session_id: Optional[str] = None
    context_type: Optional[str] = None   # "release", "issue", "general"
    context_id: Optional[str] = None


class ChatSource(BaseModel):
    document_id: str
    filename: str
    chunk_text: str
    relevance_score: float


class ChatMessageResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    session_id: str
    role: MessageRole
    content: str
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    sources: Optional[List[Dict[str, Any]]] = None
    is_mock: bool = False
    created_at: datetime


class ChatTurnResponse(BaseModel):
    """A user message + assistant reply pair."""
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
    session_id: str


class ChatSessionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: Optional[str] = None
    title: str
    is_active: bool
    message_count: int
    context_type: Optional[str] = None
    context_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    messages: Optional[List[ChatMessageResponse]] = None


class ChatSessionList(BaseModel):
    items: List[ChatSessionResponse]
    total: int
